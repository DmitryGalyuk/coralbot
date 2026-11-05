#!/usr/bin/env bash
set -Eeuo pipefail

ANALYTICS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ANALYTICS_DIR/.env"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SCHEDULE="02:00"
BACPac_ARG=""
SQL_CONTAINER=""

usage() {
    cat <<'EOF'
Usage: deploy-home-linux.sh [--bacpac FILE] [--schedule HH:MM]

Builds and starts Coral Analytics, restores a SQL Server BACPAC, starts
Superset, and installs a daily user-level systemd timer (default 02:00).
EOF
}

fail() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

cleanup() {
    if [[ -n "$SQL_CONTAINER" ]] && docker inspect "$SQL_CONTAINER" >/dev/null 2>&1; then
        docker rm -f "$SQL_CONTAINER" >/dev/null
    fi
}

while (($#)); do
    case "$1" in
        --bacpac)
            (($# >= 2)) || fail "--bacpac needs a file path"
            BACPAC_ARG="$2"
            shift 2
            ;;
        --schedule)
            (($# >= 2)) || fail "--schedule needs HH:MM"
            SCHEDULE="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            fail "Unknown option: $1"
            ;;
    esac
done

[[ "$(uname -s)" == Linux ]] || fail "Run this script on the home Linux server"
[[ "$(uname -m)" == x86_64 ]] || fail "The temporary SQL Server container requires Linux x86_64"
[[ "$SCHEDULE" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || fail "Schedule must be HH:MM, for example 02:00"
[[ "$ANALYTICS_DIR" != *[[:space:]]* ]] || fail "Move the checkout to a path without spaces"

for command_name in docker psql python3 openssl systemctl; do
    command -v "$command_name" >/dev/null 2>&1 || fail "Install '$command_name' first"
done
docker compose version >/dev/null 2>&1 || fail "Install Docker Compose v2"
systemctl --user show-environment >/dev/null 2>&1 || fail "Run from a login session with a systemd user manager"

if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ANALYTICS_DIR/.env.example" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    fail "Created .env. Set Coral credentials and local passwords there, then rerun this script"
fi
chmod 600 "$ENV_FILE"

read_env_value() {
    local key="$1"
    local line value
    line="$(grep -m1 "^${key}=" "$ENV_FILE" || true)"
    value="${line#*=}"
    if [[ "$value" == \"*\" && ${#value} -ge 2 ]]; then
        value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && ${#value} -ge 2 ]]; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

POSTGRES_DB="$(read_env_value POSTGRES_DB)"
POSTGRES_USER="$(read_env_value POSTGRES_USER)"
POSTGRES_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
POSTGRES_LOCAL_PORT="$(read_env_value POSTGRES_LOCAL_PORT)"
CORAL_LOGIN="$(read_env_value CORAL_LOGIN)"
CORAL_PASSWORD="$(read_env_value CORAL_PASSWORD)"

for key in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD CORAL_LOGIN CORAL_PASSWORD SUPERSET_SECRET_KEY SUPERSET_ADMIN_PASSWORD; do
    value="$(read_env_value "$key")"
    [[ -n "$value" && "$value" != replace-me && "$value" != replace-with-* ]] || \
        fail "Set $key in .env before deploying"
done

[[ -n "$POSTGRES_LOCAL_PORT" ]] || POSTGRES_LOCAL_PORT=5432
[[ -n "$BACPAC_ARG" ]] || {
    shopt -s nullglob
    bacpac_files=("$ANALYTICS_DIR"/azure_db_backup/*.bacpac)
    ((${#bacpac_files[@]} == 1)) || \
        fail "Copy exactly one .bacpac file into coralAnalytics/azure_db_backup or use --bacpac"
    BACPAC_ARG="${bacpac_files[0]}"
}
BACPAC="$(realpath -e -- "$BACPAC_ARG")"
[[ "${BACPAC,,}" == *.bacpac ]] || fail "Input must be a .bacpac file"

compose() {
    docker compose \
        --project-directory "$ANALYTICS_DIR" \
        --env-file "$ENV_FILE" \
        -f "$ANALYTICS_DIR/docker-compose.yml" \
        "$@"
}

compose config -q
compose --profile bi build superset
compose --profile jobs build importer
compose up -d --wait db

db_container="$(compose ps -q db)"
[[ -n "$db_container" ]] || fail "PostgreSQL container did not start"
docker_network="$(docker inspect --format '{{range $name, $value := .NetworkSettings.Networks}}{{$name}}{{end}}' "$db_container")"
[[ -n "$docker_network" ]] || fail "Could not determine the Compose network"

SQL_CONTAINER="coral-bacpac-sql-$$"
sql_alias="coral-bacpac-$$"
sql_password="CoralTmp_$(openssl rand -hex 16)!A1"
trap cleanup EXIT

docker run -d \
    --platform linux/amd64 \
    --name "$SQL_CONTAINER" \
    --network "$docker_network" \
    --network-alias "$sql_alias" \
    -e ACCEPT_EULA=Y \
    -e MSSQL_PID=Developer \
    -e "MSSQL_SA_PASSWORD=$sql_password" \
    mcr.microsoft.com/mssql/server:2022-latest >/dev/null

ready=0
for _ in $(seq 1 90); do
    if docker logs "$SQL_CONTAINER" 2>&1 | grep -q 'SQL Server is now ready for client connections'; then
        ready=1
        break
    fi
    if [[ "$(docker inspect --format '{{.State.Running}}' "$SQL_CONTAINER")" != true ]]; then
        docker logs "$SQL_CONTAINER" >&2
        fail "Temporary SQL Server exited during startup"
    fi
    sleep 2
done
((ready)) || {
    docker logs "$SQL_CONTAINER" >&2
    fail "Temporary SQL Server did not become ready in time"
}

docker exec -i -e "SA_PASSWORD=$sql_password" "$SQL_CONTAINER" sh -c \
    '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -b -i /dev/stdin' <<'SQL'
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'contained database authentication', 1;
RECONFIGURE;
SQL

POSTGRES_URL="$(POSTGRES_USER="$POSTGRES_USER" POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB="$POSTGRES_DB" POSTGRES_LOCAL_PORT="$POSTGRES_LOCAL_PORT" python3 -c 'import os; from urllib.parse import quote; print("postgresql://{}:{}@localhost:{}/{}".format(quote(os.environ["POSTGRES_USER"], safe=""), quote(os.environ["POSTGRES_PASSWORD"], safe=""), os.environ["POSTGRES_LOCAL_PORT"], quote(os.environ["POSTGRES_DB"], safe="")))')"
SQLSERVER_URL="mssql://sa:${sql_password}@${sql_alias}:1433/master" \
POSTGRES_URL="$POSTGRES_URL" \
RESTORE_DOCKER_NETWORK="$docker_network" \
PGLOADER_POSTGRES_HOST=db \
python3 "$ANALYTICS_DIR/restore_bacpac.py" "$BACPAC" --confirm-database "$POSTGRES_DB"

compose --profile bi up -d --build superset

docker_bin="$(command -v docker)"
mkdir -p "$SYSTEMD_USER_DIR"
cat > "$SYSTEMD_USER_DIR/coral-import.service" <<EOF
[Unit]
Description=Import the latest Coral report into PostgreSQL
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=$ANALYTICS_DIR
ExecStart=$docker_bin compose --project-directory $ANALYTICS_DIR --env-file $ENV_FILE -f $ANALYTICS_DIR/docker-compose.yml --profile jobs run --rm importer
UMask=0077
EOF

cat > "$SYSTEMD_USER_DIR/coral-import.timer" <<EOF
[Unit]
Description=Daily Coral report import

[Timer]
OnCalendar=*-*-* $SCHEDULE:00
Persistent=true
RandomizedDelaySec=300
Unit=coral-import.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now coral-import.timer

printf '\nDeployment complete. Superset: http://127.0.0.1:%s\n' "$(read_env_value SUPERSET_LOCAL_PORT)"
printf 'Daily import timer: systemctl --user status coral-import.timer\n'
printf 'Import logs: journalctl --user -u coral-import.service\n'
if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || true)" != yes ]]; then
    printf 'To run the timer while logged out, enable lingering once: sudo loginctl enable-linger %s\n' "$USER"
fi