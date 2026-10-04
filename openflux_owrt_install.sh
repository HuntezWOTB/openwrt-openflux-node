#!/bin/sh
# openflux_owrt_install.sh — установка ноды OpenFlux на OpenWrt одной командой.
#
# Использование:
#   sh openflux_owrt_install.sh                    # из корня репозитория
#   sh openflux_owrt_install.sh --from-github      # скачать дерево с GitHub
#   REPO=... REF=... sh openflux_owrt_install.sh --from-github
#   BIN_FILE=/tmp/openflux-mipsle sh openflux_owrt_install.sh   # свой бинарь (mips)
#
# Что делает: бинарь под архитектуру -> общий секрет -> панель
# Службы -> OpenFlux -> автозапуск. Существующие конфиги и чужие файлы
# не затирает. Все поставленное пишет в /etc/openflux/install.manifest.
set -eu

REPO="${REPO:-https://github.com/HuntezWOTB/openwrt-openflux-node}"
REF="${REF:-main}"
UPSTREAM="${UPSTREAM:-https://github.com/p1neappleXpress/OpenFlux}"
BIN="${BIN:-/usr/bin/openflux}"
CONF_DIR="/etc/openflux"
MANIFEST="$CONF_DIR/install.manifest"
MARKER="OpenFlux: домашний роутер"

SRC=""
FROM_GITHUB=0
for a in "$@"; do
  case "$a" in --from-github) FROM_GITHUB=1 ;; esac
done

log() { echo "[openflux-install] $*"; }
remember() { printf '%s\n' "$1" >> "$MANIFEST.tmp"; }

# --- 1. дерево репозитория ---
if [ "$FROM_GITHUB" = "1" ]; then
  log "downloading $REPO@$REF"
  rm -rf /tmp/oflux-src
  mkdir -p /tmp/oflux-src
  wget -qO- "$REPO/archive/refs/heads/$REF.tar.gz" | tar -xz -C /tmp/oflux-src
  SRC="$(echo /tmp/oflux-src/*/)"
elif [ -d "luci-app-openflux" ]; then
  SRC="$(pwd)/"
elif [ -n "${SRC_DIR:-}" ] && [ -d "$SRC_DIR/luci-app-openflux" ]; then
  SRC="$SRC_DIR/"
else
  log "ERROR: дерево репозитория не найдено."
  log "Запустите из корня репозитория или добавьте --from-github."
  exit 1
fi
log "source: $SRC"

mkdir -p "$CONF_DIR"
chmod 700 "$CONF_DIR"
: > "$MANIFEST.tmp"

# --- 2. бинарь под архитектуру ---
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)        SUFFIX="openflux-linux-amd64" ;;
  aarch64|arm64) SUFFIX="openflux-linux-arm64" ;;
  armv7*|armv8l) SUFFIX="openflux-linux-arm" ;;
  *)             SUFFIX="" ;;
esac
log "arch: $ARCH"

if grep -qxF "$BIN" "$MANIFEST" 2>/dev/null; then
  log "binary is ours, keeping: $BIN"
  remember "$BIN"
elif [ -x "$BIN" ]; then
  log "чужой $BIN уже есть — не трогаем, используем его"
  printf 'keep:%s\n' "$BIN" >> "$MANIFEST.tmp"
elif [ -n "${BIN_FILE:-}" ] && [ -f "$BIN_FILE" ]; then
  log " installing custom binary $BIN_FILE -> $BIN"
  cp "$BIN_FILE" "$BIN"
  chmod +x "$BIN"
  remember "$BIN"
elif [ -n "$SUFFIX" ]; then
  BIN_URL="${BIN_URL:-$UPSTREAM/releases/latest/download/$SUFFIX}"
  log "downloading $BIN_URL"
  wget -O "$BIN.tmp" "$BIN_URL"
  chmod +x "$BIN.tmp"
  mv "$BIN.tmp" "$BIN"
  remember "$BIN"
else
  log "ERROR: нет готового билда под $ARCH."
  log "Соберите на ПК: CGO_ENABLED=0 GOOS=linux GOARCH=mipsle GOMIPS=softfloat"
  log "  go build -ldflags=\"-s -w\" -trimpath -o openflux-mipsle ."
  log "и повторите с BIN_FILE=/путь/к/бинарю sh openflux_owrt_install.sh"
  exit 1
fi

# --- 3. общий секрет (только если нет) ---
if [ -f "$CONF_DIR/secret.txt" ]; then
  log "secret exists, not overwriting"
else
  log "generating secret"
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48 > "$CONF_DIR/secret.txt"
  chmod 600 "$CONF_DIR/secret.txt"
  log "сохраните этот секрет — он же вводится на второй стороне:"
  cat "$CONF_DIR/secret.txt"; echo
fi
remember "$CONF_DIR/secret.txt"

# --- 4. панель LuCI ---
LUCI="$SRC/luci-app-openflux"
log "installing LuCI panel"
if grep -q "luci.controller.openflux" /usr/lib/lua/luci/controller/openflux.lua 2>/dev/null; then
  rm -f /usr/lib/lua/luci/controller/openflux.lua
  remember "legacy:/usr/lib/lua/luci/controller/openflux.lua"
fi
if grep -q "cbi(\"openflux\")\|cbi('openflux')" /usr/lib/lua/luci/model/cbi/openflux.lua 2>/dev/null; then
  rm -f /usr/lib/lua/luci/model/cbi/openflux.lua
  remember "legacy:/usr/lib/lua/luci/model/cbi/openflux.lua"
fi
mkdir -p /usr/share/luci/menu.d
cp "$LUCI/menu.d/luci-app-openflux.json" /usr/share/luci/menu.d/luci-app-openflux.json
remember "/usr/share/luci/menu.d/luci-app-openflux.json"
mkdir -p /usr/share/rpcd/acl.d
cp "$LUCI/rpcd/luci-app-openflux.json" /usr/share/rpcd/acl.d/luci-app-openflux.json
remember "/usr/share/rpcd/acl.d/luci-app-openflux.json"
mkdir -p /usr/libexec/rpcd
cp "$LUCI/rpcd-exec/luci.openflux" /usr/libexec/rpcd/luci.openflux
chmod +x /usr/libexec/rpcd/luci.openflux
remember "/usr/libexec/rpcd/luci.openflux"
mkdir -p /www/luci-static/resources/view
cp "$LUCI/htdocs/luci-static/resources/view/openflux.js" /www/luci-static/resources/view/openflux.js
remember "/www/luci-static/resources/view/openflux.js"
if [ ! -f /etc/config/openflux ]; then
  cp "$LUCI/root/etc/config/openflux" /etc/config/openflux
  remember "/etc/config/openflux"
else
  log "/etc/config/openflux exists — не затираем"
fi
if [ -f /etc/init.d/openflux ] && ! grep -q "$MARKER" /etc/init.d/openflux 2>/dev/null; then
  log "чужой /etc/init.d/openflux — бэкап и замена"
  cp /etc/init.d/openflux "/etc/init.d/openflux.bak-$(date +%Y%m%d%H%M%S)"
else
  log "installing procd service"
fi
cp "$LUCI/root/etc/init.d/openflux" /etc/init.d/openflux
chmod +x /etc/init.d/openflux
remember "/etc/init.d/openflux"

# --- 5. финал ---
mv "$MANIFEST.tmp" "$MANIFEST"
chmod 600 "$MANIFEST"
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/rpcd restart 2>/dev/null || true
/etc/init.d/uhttpd restart 2>/dev/null || true
/etc/init.d/openflux enable
/etc/init.d/openflux stop 2>/dev/null || true
sleep 2
/etc/init.d/openflux start || log "не стартовал — скорее всего не задан URL. Откройте Службы -> OpenFlux."
sleep 3
pgrep -af openflux || log "процесс не найден: logread -e openflux | tail -30"
log "готово. Панель: разлогиньтесь/залогиньтесь, Службы -> OpenFlux."
