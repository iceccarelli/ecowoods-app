#!/bin/bash
set -e
cd /workspaces/ecowoods-app

# 1. Recreate mobile .env with the current Codespace URL
echo "EXPO_PUBLIC_API_URL=https://${CODESPACE_NAME}-8000.app.github.dev" > apps/mobile/.env

# 2. Start backend (SQLite), seed if empty
cd backend
export DATABASE_URL="sqlite+aiosqlite:///./ecowoods.db"
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
sleep 4
python seed_products.py || true

# 3. Make backend port public
gh codespace ports visibility 8000:public -c "$CODESPACE_NAME" 2>/dev/null || true
echo "Startup complete"
