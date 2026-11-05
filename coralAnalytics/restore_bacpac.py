import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit


PROTECTED_DATABASES = {"postgres", "template0", "template1", "superset"}
PROJECT_DIR = Path(__file__).resolve().parent


def parse_url(value: str, schemes: set[str], label: str):
    parsed = urlsplit(value)
    if parsed.scheme not in schemes or not parsed.hostname or not parsed.path.strip("/"):
        raise ValueError(f"{label} must be a URL with scheme, host, and database name")
    database = unquote(parsed.path.strip("/"))
    if "/" in database:
        raise ValueError(f"{label} must contain exactly one database name")
    return parsed, database


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def database_url(
    parsed, database: str, *, include_password: bool = True, host_override: str | None = None
) -> str:
    username = quote(unquote(parsed.username or ""), safe="")
    password = unquote(parsed.password or "")
    credentials = username
    if include_password and parsed.password is not None:
        credentials += ":" + quote(password, safe="")
    host = host_override or parsed.hostname or ""
    if ":" in host:
        host = f"[{host}]"
    netloc = credentials + "@" + host
    if parsed.port:
        netloc += f":{parsed.port}"
    scheme = "postgresql" if parsed.scheme in {"postgres", "postgresql"} else parsed.scheme
    return urlunsplit((scheme, netloc, "/" + quote(database, safe=""), parsed.query, ""))


def sql_connection_value(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def run(
    command: list[str], *, env: dict[str, str] | None = None, cwd: Path | None = None
) -> None:
    subprocess.run(command, check=True, env=env, cwd=cwd)


def psql(admin_url: str, password: str, sql: str) -> None:
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    run(["psql", admin_url, "-X", "-v", "ON_ERROR_STOP=1", "-c", sql], env=env)


def run_sqlpackage(
    sqlpackage: str | None,
    bacpac: Path,
    connection_string: str,
    docker_network: str | None,
) -> None:
    if not docker_network:
        run(
            [
                sqlpackage,
                "/Action:Import",
                f"/SourceFile:{bacpac}",
                f"/TargetConnectionString:{connection_string}",
            ]
        )
        return

    import_command = (
        "dotnet tool install --tool-path /tmp/tools microsoft.sqlpackage "
        "--version 170.5.96 >/dev/null && /tmp/tools/sqlpackage "
        f"/Action:Import /SourceFile:/bacpac/{shlex.quote(bacpac.name)} "
        f"/TargetConnectionString:{shlex.quote(connection_string)}"
    )
    env = os.environ.copy()
    env["DOCKER_DEFAULT_PLATFORM"] = "linux/amd64"
    run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            docker_network,
            "-v",
            f"{bacpac.parent}:/bacpac:ro",
            "mcr.microsoft.com/dotnet/sdk:10.0",
            "bash",
            "-lc",
            import_command,
        ],
        env=env,
    )


def run_pgloader(
    pgloader: str | None,
    load_file: Path,
    docker_network: str | None,
    postgres_password: str,
) -> None:
    if not docker_network:
        run([pgloader, str(load_file)])
        return

    env = os.environ.copy()
    env["DOCKER_DEFAULT_PLATFORM"] = "linux/amd64"
    env["PGPASSWORD"] = postgres_password
    run(
        [
            "docker",
            "run",
            "--rm",
            "--network",
            docker_network,
            "-e",
            "PGPASSWORD",
            "-v",
            f"{load_file.parent}:/work:ro",
            "dimitri/pgloader:latest",
            "pgloader",
            f"/work/{load_file.name}",
        ],
        env=env,
    )


def prepare_postgres_stage(stage_url: str, password: str) -> None:
    psql(
        stage_url,
        password,
        "BEGIN; "
        "ALTER TABLE dbo.dailystats SET SCHEMA public; "
        "ALTER TABLE dbo.structure SET SCHEMA public; "
        "ALTER TABLE dbo.testtable SET SCHEMA public; "
        "ALTER TABLE dbo.titles SET SCHEMA public; "
        "ALTER TABLE public.dailystats RENAME COLUMN parentid TO parent_id; "
        "ALTER TABLE public.dailystats RENAME COLUMN groupvolume TO group_volume; "
        "ALTER TABLE public.dailystats RENAME COLUMN dateadded TO date_added; "
        "ALTER TABLE public.dailystats RENAME COLUMN structurepending TO structure_pending; "
        "CREATE UNIQUE INDEX titles_rank_uq ON public.titles (rank); "
        "DROP SCHEMA dbo; COMMIT",
    )


def run_project_initializer(database: str) -> None:
    run(
        [
            "docker",
            "compose",
            "--profile",
            "bi",
            "run",
            "--rm",
            "--no-deps",
            "--build",
            "-e",
            f"POSTGRES_DB={database}",
            "schema-init",
        ],
        env=os.environ.copy(),
        cwd=PROJECT_DIR,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Restore a SQL Server BACPAC into a PostgreSQL database."
    )
    parser.add_argument("bacpac", type=Path, help="Path to the .bacpac file")
    parser.add_argument(
        "--confirm-database",
        required=True,
        help="Must exactly match the PostgreSQL database to replace",
    )
    args = parser.parse_args()

    try:
        bacpac = args.bacpac.expanduser().resolve(strict=True)
        if bacpac.suffix.lower() != ".bacpac" or not zipfile.is_zipfile(bacpac):
            raise ValueError("Input must be a valid .bacpac archive")
        with zipfile.ZipFile(bacpac) as archive:
            corrupt_entry = archive.testzip()
        if corrupt_entry:
            raise ValueError(f"BACPAC archive is corrupt at {corrupt_entry}")

        sqlserver_value = os.environ.get("SQLSERVER_URL", "")
        postgres_value = os.environ.get("POSTGRES_URL", "")
        sqlserver, _ = parse_url(sqlserver_value, {"mssql", "sqlserver"}, "SQLSERVER_URL")
        postgres, target_database = parse_url(
            postgres_value, {"postgres", "postgresql"}, "POSTGRES_URL"
        )
        if target_database != args.confirm_database:
            raise ValueError(
                f"Confirmation mismatch: POSTGRES_URL targets {target_database!r}, "
                f"not {args.confirm_database!r}"
            )
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", target_database):
            raise ValueError("Target database name must use ASCII letters, digits, and underscores")
        if target_database.lower() in PROTECTED_DATABASES:
            raise ValueError(f"Refusing to replace protected database {target_database!r}")
        if not postgres.username or postgres.password is None:
            raise ValueError("POSTGRES_URL must include a PostgreSQL username and password")
        if not sqlserver.username or sqlserver.password is None:
            raise ValueError("SQLSERVER_URL must include a SQL Server username and password")

        docker_network = os.environ.get("RESTORE_DOCKER_NETWORK")
        sqlpackage = shutil.which("sqlpackage") or shutil.which("SqlPackage")
        pgloader = shutil.which("pgloader")
        psql_path = shutil.which("psql")
        required_tools = [("psql", psql_path)]
        if docker_network:
            required_tools.append(("docker", shutil.which("docker")))
        else:
            required_tools.extend((("sqlpackage", sqlpackage), ("pgloader", pgloader)))
        missing = [name for name, path in required_tools if not path]
        if missing:
            raise RuntimeError("Required tools not found on PATH: " + ", ".join(missing))

        suffix = uuid.uuid4().hex[:8]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        sqlserver_stage = f"coral_bacpac_{timestamp}_{suffix}"
        postgres_stage = f"coral_restore_{suffix}"
        sql_host = sqlserver.hostname or ""
        if ":" in sql_host:
            sql_host = f"[{sql_host}]"
        if sqlserver.port:
            sql_host += f",{sqlserver.port}"
        connection_string = ";".join(
            (
                f"Server=tcp:{sql_host}",
                f"Initial Catalog={sqlserver_stage}",
                f"User ID={sql_connection_value(unquote(sqlserver.username or ''))}",
                f"Password={sql_connection_value(unquote(sqlserver.password or ''))}",
                "Encrypt=True",
                "TrustServerCertificate=" + ("True" if docker_network else "False"),
                "Connection Timeout=30",
            )
        )
        sqlserver_stage_url = urlunsplit(
            (
                "mssql",
                sqlserver.netloc,
                "/" + quote(sqlserver_stage, safe=""),
                "",
                "",
            )
        )
        postgres_admin_url = database_url(postgres, "postgres", include_password=False)
        postgres_stage_admin_url = database_url(postgres, postgres_stage)
        pgloader_host = os.environ.get("PGLOADER_POSTGRES_HOST")
        postgres_stage_url = database_url(
            postgres,
            postgres_stage,
            include_password=not docker_network,
            host_override=pgloader_host if docker_network else None,
        )
        password = unquote(postgres.password or "")

        print(f"BACPAC: {bacpac}")
        print(f"PostgreSQL database to replace: {target_database}")
        print(f"Temporary PostgreSQL database: {postgres_stage}")
        print(f"Temporary SQL Server database: {sqlserver_stage}")
        if not sys.stdin.isatty():
            raise RuntimeError("Run interactively so the destructive replacement can be confirmed")
        confirmation = input(f"Type {target_database} to replace that database: ")
        if confirmation != target_database:
            print("Confirmation did not match; no database was changed.", file=sys.stderr)
            return 2

        psql(postgres_admin_url, password, "SELECT 1")
        run_sqlpackage(sqlpackage, bacpac, connection_string, docker_network)

        psql(
            postgres_admin_url,
            password,
            f"CREATE DATABASE {quote_identifier(postgres_stage)} "
            f"OWNER {quote_identifier(unquote(postgres.username or ''))}",
        )
        migration_started = False
        try:
            load_command = (
                "LOAD DATABASE\n"
                f"     FROM {sqlserver_stage_url}\n"
                f"     INTO {postgres_stage_url};\n"
            )
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", suffix=".load", prefix="coral-restore-"
            ) as load_file:
                os.chmod(load_file.name, 0o600)
                load_file.write(load_command)
                load_file.flush()
                run_pgloader(pgloader, Path(load_file.name), docker_network, password)

            migration_started = True
            prepare_postgres_stage(postgres_stage_admin_url, password)
            run_project_initializer(postgres_stage)
            psql(postgres_stage_admin_url, password, "SELECT 1 FROM public.coralview LIMIT 0")
            psql(
                postgres_admin_url,
                password,
                f"DROP DATABASE IF EXISTS {quote_identifier(target_database)} WITH (FORCE)",
            )
            psql(
                postgres_admin_url,
                password,
                f"ALTER DATABASE {quote_identifier(postgres_stage)} "
                f"RENAME TO {quote_identifier(target_database)}",
            )
        except Exception:
            if not migration_started:
                psql(
                    postgres_admin_url,
                    password,
                    f"DROP DATABASE IF EXISTS {quote_identifier(postgres_stage)} WITH (FORCE)",
                )
            raise

        print(f"Restore completed. SQL Server staging database retained: {sqlserver_stage}")
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Restore failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())