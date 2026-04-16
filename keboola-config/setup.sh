#!/bin/bash
set -Eeuo pipefail

# Install Python backend dependencies
cd /app/backend && uv sync &

# Install and build Next.js frontend (standalone output)
cd /app/frontend && npm install && npm run build &

# Wait for both to finish
wait
