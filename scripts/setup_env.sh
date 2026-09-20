#!/usr/bin/env bash
set -euo pipefail

# Generates .env with random secure passwords from .env.example
if [ -f .env ]; then
  echo "⚠️  .env already exists. Remove or rename it first if you want to regenerate."
  exit 1
fi

cp .env.example .env

# Generate secure random passwords
PGPASS=$(openssl rand -hex 16)
GRAFANAPASS=$(openssl rand -hex 12)

# Replace placeholders
sed -i '' "s/POSTGRES_PASSWORD=local-development-only/POSTGRES_PASSWORD=${PGPASS}/" .env 2>/dev/null || \
sed -i "s/POSTGRES_PASSWORD=local-development-only/POSTGRES_PASSWORD=${PGPASS}/" .env

sed -i '' "s/GRAFANA_PASSWORD=admin/GRAFANA_PASSWORD=${GRAFANAPASS}/" .env 2>/dev/null || \
sed -i "s/GRAFANA_PASSWORD=admin/GRAFANA_PASSWORD=${GRAFANAPASS}/" .env

echo "✅ Generated .env with randomized POSTGRES_PASSWORD and GRAFANA_PASSWORD."
