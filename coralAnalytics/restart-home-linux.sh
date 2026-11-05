#!/usr/bin/env bash
set -Eeuo pipefail

ANALYTICS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ANALYTICS_DIR/.env"

usage() {
    cat <<'EOF'
Usage: restart-home-linux.sh [--build]

Default: restart the running PostgreSQL and Superset containers.
--build: rebuild images and ensure both services are up.
Neither mode restores or resets database data.
EOF
}

if (($# > 1)) || { (($# == 1)) && [[ "$1" != --build && "$1" != --help && "$1" != -h ]]; }; then
    usage >&2
    exit 2
fi

if (($# == 1)) && [[ "$1" == --help || "$1" == -h ]]; then
    usage
    exit 0
fi

command -v docker >/dev/null 2>&1 || {
    printf 'Error: docker is not installed or not on PATH\n' >&2
    exit 1
}
docker compose version >/dev/null 2>&1 || {
    printf 'Error: Docker Compose v2 is required\n' >&2
    exit 1
}
[[ -f "$ENV_FILE" ]] || {
    printf 'Error: missing %s\n' "$ENV_FILE" >&2
    exit 1
}

compose=(
    docker compose
    --project-directory "$ANALYTICS_DIR"
    --env-file "$ENV_FILE"
    -f "$ANALYTICS_DIR/docker-compose.yml"
    --profile bi
)
"${compose[@]}" config -q

if (($# == 1)) && [[ "$1" == --build ]]; then
    "${compose[@]}" up -d --build db superset
else
    "${compose[@]}" restart db superset
fi

"${compose[@]}" ps db superset