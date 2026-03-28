#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export SOLID_PORT_OPEN="${SOLID_PORT_OPEN:-3400}"
export SOLID_PORT_AUTH="${SOLID_PORT_AUTH:-3500}"
export SOLID_OPEN_BASE_URL="${SOLID_OPEN_BASE_URL:-http://localhost:${SOLID_PORT_OPEN}/}"
export SOLID_AUTH_BASE_URL="${SOLID_AUTH_BASE_URL:-http://localhost:${SOLID_PORT_AUTH}/}"

cleanup() {
  docker compose -f docker-compose.solid.yml down -v --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

docker compose -f docker-compose.solid.yml down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f docker-compose.solid.yml up -d

npx vitest run --config vitest.pod.config.ts
