#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
  # --reload leaves a child watcher; catch stragglers
  pkill -f "[u]vicorn server:app" 2>/dev/null || true
}

trap cleanup EXIT INT TERM HUP

if [[ ! -x "${ROOT}/backend/.venv/bin/python" ]]; then
  echo "Missing backend venv. Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  docker compose up -d
  echo "MongoDB container started (or already running)."
else
  echo "Docker not available — expecting MongoDB at mongodb://127.0.0.1:27017"
fi

"${ROOT}/backend/.venv/bin/python" <<'PY'
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    for _ in range(60):
        try:
            c = AsyncIOMotorClient(
                "mongodb://127.0.0.1:27017",
                serverSelectionTimeoutMS=2000,
            )
            await c.admin.command("ping")
            c.close()
            print("MongoDB is reachable.")
            return
        except Exception:
            await asyncio.sleep(1)
    print("Timed out waiting for MongoDB on 127.0.0.1:27017", file=sys.stderr)
    sys.exit(1)

asyncio.run(main())
PY

(
  cd "${ROOT}/backend"
  exec .venv/bin/uvicorn server:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/ >/dev/null; then
    echo "API: http://localhost:8000"
    break
  fi
  sleep 1
done

if ! curl -sf http://127.0.0.1:8000/ >/dev/null; then
  echo "Timed out waiting for API at http://localhost:8000" >&2
  exit 1
fi

cd "${ROOT}/frontend"
export REACT_APP_BACKEND_URL=http://localhost:8000
export BROWSER=none

echo "App: http://localhost:3000 (Ctrl+C stops dev servers)"
yarn start
