#!/bin/sh
# Установка бинарника OpenFlux на OpenWrt (любая архитектура, автоопределение).
# Запуск на роутере из корня репозитория: sh install_openflux.sh
# Нужен только исходящий интернет, публичный IP и входящие порты не требуются.
set -eu

UPSTREAM="${UPSTREAM:-https://github.com/p1neappleXpress/OpenFlux}"
BIN="/usr/bin/openflux"
CONF_DIR="/etc/openflux"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)          SUFFIX="openflux-linux-amd64" ;;
  aarch64|arm64)   SUFFIX="openflux-linux-arm64" ;;
  armv7*|armv8l)   SUFFIX="openflux-linux-arm" ;;
  mipsel|mips)     SUFFIX="" ;; # для mips соберите бинарь вручную, см. docs/01-быстрый-старт.md
  *)               SUFFIX="" ;;
esac

echo "[*] arch: $ARCH"
echo "[*] ram:"; free -m | head -3
echo "[*] disk:"; df -h / /tmp | head -5

mkdir -p "$CONF_DIR"
chmod 700 "$CONF_DIR"

if [ -x "$BIN" ]; then
  echo "[*] binary already exists: $BIN, пропускаем загрузку"
else
  if [ -z "$SUFFIX" ]; then
    echo "[!] Нет готового билда под $ARCH."
    echo "    Соберите на ПК: CGO_ENABLED=0 GOOS=linux GOARCH=mipsle GOMIPS=softfloat go build -ldflags=\"-s -w\" -trimpath -o openflux-mipsle ."
    echo "    Затем скопируйте на роутер в $BIN и перезапустите этот скрипт."
    exit 1
  fi
  BIN_URL="${BIN_URL:-$UPSTREAM/releases/latest/download/$SUFFIX}"
  echo "[*] downloading $BIN_URL"
  wget -O "$BIN.tmp" "$BIN_URL"
  chmod +x "$BIN.tmp"
  mv "$BIN.tmp" "$BIN"
fi
"$BIN" --help 2>&1 | head -5 || true

if [ ! -f "$CONF_DIR/secret.txt" ]; then
  echo "[*] generating secret (tr, без base64 — его часто нет в прошивке)"
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48 > "$CONF_DIR/secret.txt"
  chmod 600 "$CONF_DIR/secret.txt"
  echo "!!! Сохраните этот общий секрет — он же вводится на второй стороне:"
  cat "$CONF_DIR/secret.txt"; echo
else
  echo "[*] secret exists, not overwriting: $CONF_DIR/secret.txt"
fi

echo ""
echo "Готово. Дальше:"
echo "1. sh luci-app-openflux/install_luci.sh  (панель Службы -> OpenFlux)"
echo "2. В панели укажите общий документ и сохраните"
echo "3. /etc/init.d/openflux enable && /etc/init.d/openflux start"
echo "4. sh check.sh"
