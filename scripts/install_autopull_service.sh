#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/suo-autopull.service"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Запустите скрипт от имени root (sudo): sudo $0"
  exit 1
fi

CURRENT_USER="${SUDO_USER:-root}"

echo "⚙️  Установка службы suo-autopull.service..."

cat << EOF > "$SERVICE_FILE"
[Unit]
Description=SUO Digital Queue Auto-Pull Deployment Service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$REPO_DIR
ExecStart=/bin/bash $REPO_DIR/scripts/autopull.sh --loop 30
Restart=always
RestartSec=10
StandardOutput=append:/var/log/suo-autopull.log
StandardError=append:/var/log/suo-autopull.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now suo-autopull.service

echo "✅ Служба suo-autopull успешно установлена и запущена!"
echo "📋 Проверка статуса: systemctl status suo-autopull"
echo "📜 Просмотр логов:   tail -f /var/log/suo-autopull.log"
