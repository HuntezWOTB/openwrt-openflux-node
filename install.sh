#!/bin/sh
# Одна команда для установки всего на роутер.
# Использование (на роутере, нужен исходящий интернет):
#   sh install.sh
# Скрипт должен лежать в корне этого репозитория (рядом luci-app-openflux/).
# Что делает: бинарь под архитектуру -> секрет -> LuCI-панель -> автозапуск.
set -eu
cd "$(dirname "$0")"

echo "=== 1/3 бинарь и секрет ==="
sh install_openflux.sh

echo "=== 2/3 панель Службы -> OpenFlux ==="
sh luci-app-openflux/install_luci.sh

echo "=== 3/3 автозапуск ==="
/etc/init.d/openflux enable
/etc/init.d/openflux stop 2>/dev/null || true
sleep 2
/etc/init.d/openflux start || echo "[!] Сервис не стартовал — скорее всего не задан URL документа. Откройте Службы -> OpenFlux."
sleep 3
pgrep -af openflux || echo "[!] Процесс не найден, смотрите logread -e openflux | tail -30"

echo ""
echo "Дальше по docs/01-быстрый-старт.md: привяжите общий документ Mail.ru и тот же секрет на второй стороне."
