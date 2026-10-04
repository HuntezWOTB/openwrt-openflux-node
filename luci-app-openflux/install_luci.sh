#!/bin/sh
# Установка панели Службы -> OpenFlux (современный LuCI на ucode/JS).
# Запуск на роутере из каталога luci-app-openflux: sh install_luci.sh
set -eu
cd "$(dirname "$0")"

echo "[*] remove legacy lua app if present"
rm -f /usr/lib/lua/luci/controller/openflux.lua
rm -f /usr/lib/lua/luci/model/cbi/openflux.lua

echo "[*] menu"
mkdir -p /usr/share/luci/menu.d
cp menu.d/luci-app-openflux.json /usr/share/luci/menu.d/luci-app-openflux.json

echo "[*] acl"
mkdir -p /usr/share/rpcd/acl.d
cp rpcd/luci-app-openflux.json /usr/share/rpcd/acl.d/luci-app-openflux.json

echo "[*] view"
mkdir -p /www/luci-static/resources/view
cp htdocs/luci-static/resources/view/openflux.js /www/luci-static/resources/view/openflux.js

echo "[*] uci config (не затираем существующий)"
if [ ! -f /etc/config/openflux ]; then
  mkdir -p /etc/config
  cp root/etc/config/openflux /etc/config/openflux
fi

echo "[*] init script (UCI-версия)"
cp root/etc/init.d/openflux /etc/init.d/openflux
chmod +x /etc/init.d/openflux

echo "[*] reload"
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/rpcd restart 2>/dev/null || true
/etc/init.d/uhttpd restart 2>/dev/null || true

echo "Готово: разлогинься/залогинься в LuCI, смотри Службы -> OpenFlux"
