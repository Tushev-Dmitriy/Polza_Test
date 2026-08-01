#!/usr/bin/env bash
set -Eeuo pipefail

PG_BIN="$(dirname "$(find /usr/lib/postgresql -type f -name initdb -print -quit)")"

if [[ -z "${PG_BIN}" ]]; then
  echo "PostgreSQL binaries were not found" >&2
  exit 1
fi

mkdir -p "${PGDATA}"
chown -R postgres:postgres "${PGDATA}"
chmod 700 "${PGDATA}"

if [[ ! -s "${PGDATA}/PG_VERSION" ]]; then
  echo "Initializing PostgreSQL data directory..."
  runuser -u postgres -- "${PG_BIN}/initdb" \
    --pgdata="${PGDATA}" \
    --encoding=UTF8 \
    --locale=C.UTF-8 \
    --auth=trust
fi

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${WEB_PID:-}" ]] && kill -0 "${WEB_PID}" 2>/dev/null; then
    kill -TERM "${WEB_PID}" 2>/dev/null || true
    wait "${WEB_PID}" 2>/dev/null || true
  fi

  if [[ -n "${POSTGRES_PID:-}" ]] && kill -0 "${POSTGRES_PID}" 2>/dev/null; then
    kill -TERM "${POSTGRES_PID}" 2>/dev/null || true
    wait "${POSTGRES_PID}" 2>/dev/null || true
  fi

  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

echo "Starting PostgreSQL..."
setpriv --reuid=postgres --regid=postgres --init-groups \
  "${PG_BIN}/postgres" \
  --data-directory="${PGDATA}" \
  --config-file="${PGDATA}/postgresql.conf" \
  -c listen_addresses=127.0.0.1 \
  -c port=5432 &
POSTGRES_PID=$!

for attempt in {1..30}; do
  if runuser -u postgres -- "${PG_BIN}/pg_isready" \
    --host=127.0.0.1 --port=5432 --dbname=postgres --quiet; then
    break
  fi

  if ! kill -0 "${POSTGRES_PID}" 2>/dev/null; then
    echo "PostgreSQL exited before becoming ready" >&2
    exit 1
  fi

  if [[ "${attempt}" -eq 30 ]]; then
    echo "PostgreSQL did not become ready in time" >&2
    exit 1
  fi

  sleep 1
done

echo "Applying schema and importing data..."
runuser -u nextjs --preserve-environment -- pnpm db:migrate
runuser -u nextjs --preserve-environment -- pnpm db:import

echo "Starting Next.js on port ${PORT}..."
setpriv --reuid=nextjs --regid=nodejs --init-groups \
  node .next/standalone/server.js &
WEB_PID=$!

wait "${WEB_PID}"
