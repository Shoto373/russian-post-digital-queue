#!/usr/bin/env bash
set -euo pipefail

# Режим бесконечного цикла (для запуска в фоне/systemd/screen)
if [ "${1:-}" = "--loop" ] || [ "${1:-}" = "-d" ]; then
  INTERVAL="${2:-30}"
  echo "🚀 Запущен автопулл-демон для $(pwd) (интервал: ${INTERVAL}с)"
  while true; do
    "$0" --check || true
    sleep "$INTERVAL"
  done
  exit 0
fi

# Защита от одновременного запуска нескольких процессов деплоя
LOCKFILE="/tmp/suo_autopull.lock"
exec 200>"$LOCKFILE"
flock -n 200 || {
  # Если уже идет предыдущий пулл/пересборка — пропускаем тик
  exit 0
}

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Определяем текущую активную ветку
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
if [ "$BRANCH" = "HEAD" ] || [ -z "$BRANCH" ]; then
  BRANCH="feature/monitoring-prometheus-grafana"
fi

# Получаем свежие метаданные из удаленного репозитория
if ! git fetch origin "$BRANCH" --quiet 2>/dev/null; then
  exit 0
fi

LOCAL_HASH="$(git rev-parse HEAD)"
REMOTE_HASH="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "$LOCAL_HASH")"

# Если новых коммитов нет — завершаем работу тихо
if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
  exit 0
fi

echo "========================================================"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Обнаружены обновления в ветке '$BRANCH'!"
echo "Текущий локальный коммит: $LOCAL_HASH"
echo "Новый удаленный коммит:  $REMOTE_HASH"
echo "========================================================"

echo "📥 Подтягиваем изменения (git pull)..."
git pull origin "$BRANCH"

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

echo "🧪 Предварительная сборка образов (pre-build check)..."
if ! $COMPOSE build backend frontend; then
  echo "❌ Ошибка сборки образов! Выполняем откат к $LOCAL_HASH..."
  git reset --hard "$LOCAL_HASH"
  exit 1
fi

echo "🐳 Запуск обновленных контейнеров..."
$COMPOSE up -d --build
$COMPOSE exec -T backend /app/api migrate up || true

echo "⏳ Проверка работоспособности сервиса (/ready)..."
HEALTHY=false
for i in {1..12}; do
  if curl -sf http://127.0.0.1:8080/ready >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 2
done

if [ "$HEALTHY" = false ]; then
  echo "❌ Backend health-check провален! Выполняем автоматический откат к $LOCAL_HASH..."
  git reset --hard "$LOCAL_HASH"
  $COMPOSE up -d --build
  exit 1
fi

echo "🧹 Удаление устаревших промежуточных docker-образов..."
docker image prune -f

echo "✅ [$(date '+%Y-%m-%d %H:%M:%S')] Деплой успешно завершен и проверен!"
echo ""
