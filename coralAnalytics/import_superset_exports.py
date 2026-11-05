import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote_plus
from zipfile import ZIP_DEFLATED, ZipFile

EXPORT_ROOT = Path("/app/superset")


def postgres_uri() -> str:
    username = quote_plus(os.environ["POSTGRES_USER"])
    password = quote_plus(os.environ["POSTGRES_PASSWORD"])
    database = quote_plus(os.environ["POSTGRES_DB"])
    host = os.environ.get("POSTGRES_HOST", "db")
    port = os.environ.get("POSTGRES_PORT", "5432")
    return f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"


def rewrite_sql(value: str) -> str:
    replacements = (
        (
            r"REPLICATE\(\s*'--'\s*,\s*gen\s*\)\s*\+\s*' '\s*\+\s*Name",
            "repeat('--', gen) || ' ' || \"Name\"",
        ),
        (
            r"concat\(\s*DATENAME\(\s*month\s*,\s*DateAdded\s*\)\s*,\s*' '\s*,\s*DATENAME\(\s*Year\s*,\s*DateAdded\s*\)\s*\)",
            "to_char(\"DateAdded\", 'FMMonth YYYY')",
        ),
        (r"\bDAY\(\s*DateAdded\s*\)", 'EXTRACT(DAY FROM "DateAdded")'),
        (
            r"\bround\(\s*(Overall|StructurePending|Personal|Pending)\s*,\s*0\s*\)",
            r'round("\1"::numeric, 0)',
        ),
        (
            r"DateAdded\s*=\s*\(SELECT\s+max\(DateAdded\)\s+from\s+CoralView\)",
            '"IsLatestDate" = 1',
        ),
    )
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value, flags=re.IGNORECASE)
    return value


def rewrite_value(value):
    if isinstance(value, dict):
        return {key: rewrite_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [rewrite_value(item) for item in value]
    if isinstance(value, str):
        if not value.lstrip().startswith(("{", "[")):
            return rewrite_sql(value)
        try:
            parsed = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return rewrite_sql(value)
        return json.dumps(rewrite_value(parsed), ensure_ascii=False, separators=(",", ":"))
    return value


def prepare_export(source: Path, destination: Path) -> None:
    import yaml

    shutil.copytree(source, destination)

    for database_file in (destination / "databases").glob("*.yaml"):
        database = yaml.safe_load(database_file.read_text(encoding="utf-8"))
        database["sqlalchemy_uri"] = postgres_uri()
        database.pop("configuration_method", None)
        database.pop("impersonate_user", None)
        database_file.write_text(
            yaml.safe_dump(database, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )

    for dataset_file in (destination / "datasets").rglob("*.yaml"):
        dataset = yaml.safe_load(dataset_file.read_text(encoding="utf-8"))
        dataset["table_name"] = "coralview"
        dataset["schema"] = "public"
        for key in ("partition_mapped_column", "folders", "partition_column", "currency_code_column"):
            dataset.pop(key, None)
        for column in dataset.get("columns", []):
            for key in (
                "partition_value_transform",
                "partition_transform_is_monotonic",
                "datetime_format",
                "uuid",
            ):
                column.pop(key, None)
        for metric in dataset.get("metrics", []):
            metric.pop("uuid", None)
        dataset["columns"].append(
            {
                "column_name": "IsLatestDate",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "advanced_data_type": None,
                "groupby": True,
                "filterable": True,
                "expression": None,
                "description": None,
                "python_date_format": None,
                "extra": {},
            }
        )
        dataset_file.write_text(
            yaml.safe_dump(dataset, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )

    for chart_file in (destination / "charts").glob("*.yaml"):
        chart = yaml.safe_load(chart_file.read_text(encoding="utf-8"))
        chart = rewrite_value(chart)
        chart.pop("tags", None)
        chart_file.write_text(
            yaml.safe_dump(chart, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )

    for dashboard_file in (destination / "dashboards").glob("*.yaml"):
        dashboard = yaml.safe_load(dashboard_file.read_text(encoding="utf-8"))
        dashboard.pop("theme_uuid", None)
        dashboard.pop("tags", None)
        dashboard_file.write_text(
            yaml.safe_dump(dashboard, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )


def zip_export(source: Path, archive: Path) -> None:
    with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
        for path in source.rglob("*"):
            if path.is_file():
                bundle.write(path, path.relative_to(source.parent))


def run_import(command: str, archive: Path) -> None:
    subprocess.run(
        ["superset", command, "--path", str(archive), "--username", "admin"],
        check=True,
    )


def main() -> None:
    dataset_exports = sorted(EXPORT_ROOT.glob("dataset_export_*"))
    dashboard_exports = sorted(EXPORT_ROOT.glob("dashboard_export_*"))
    if not dataset_exports or not dashboard_exports:
        logging.warning(
            "Superset dataset/dashboard exports are missing in %s; "
            "skipping export import",
            EXPORT_ROOT,
        )
        return
    dataset_export = dataset_exports[-1]

    with tempfile.TemporaryDirectory(prefix="coral-superset-") as temp_dir:
        temp_root = Path(temp_dir)
        dataset_dir = temp_root / dataset_export.name
        prepare_export(dataset_export, dataset_dir)
        dataset_zip = temp_root / "dataset.zip"
        zip_export(dataset_dir, dataset_zip)
        run_import("import-datasources", dataset_zip)

        for source in dashboard_exports:
            dashboard_dir = temp_root / source.name
            prepare_export(source, dashboard_dir)
            dashboard_zip = temp_root / f"{source.name}.zip"
            zip_export(dashboard_dir, dashboard_zip)
            run_import("import-dashboards", dashboard_zip)


if __name__ == "__main__":
    main()