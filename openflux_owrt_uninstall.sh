#!/bin/sh
# openflux_owrt_uninstall.sh — аккуратный снос ноды OpenFlux с роутера.
#
# Удаляет ТОЛЬКО то, что ставил openflux_owrt_install.sh (список в
# /etc/openflux/install.manifest). Помеченное keep: (чужой бинарь, который
# был на месте до нас) не трогает. Пакеты, чужие конфиги и службы — никогда.
set -eu

CONF_DIR="/etc/openflux"
MANIFEST="$CONF_DIR/install.manifest"
MARKER="OpenFlux: домашний роутер"

log() { echo "[openflux-uninstall] $*"; }

# сначала останавливаем и снимаем с автозапуска (пока init еще на месте)
if [ -x /etc/init.d/openflux ] && { [ -f "$MANIFEST" ] || grep -q "$MARKER" /etc/init.d/openflux 2>/dev/null; }; then
  /etc/init.d/openflux stop 2>/dev/null || true
  /etc/init.d/openflux disable 2>/dev/null || true
elif [ -x /etc/init.d/openflux ]; then
  log "чужой /etc/init.d/openflux — сервис не трогаем"
fi

FALLBACK="\
/www/luci-static/resources/view/openflux.js
/usr/share/luci/menu.d/luci-app-openflux.json
/usr/share/rpcd/acl.d/luci-app-openflux.json
/usr/libexec/rpcd/luci.openflux
/etc/init.d/openflux
/etc/config/openflux
/usr/bin/openflux
/etc/openflux/secret.txt
/etc/openflux/install.manifest"

LIST=""
if [ -f "$MANIFEST" ]; then
  log "manifest found, removing exactly what was installed"
  LIST="$(cat "$MANIFEST")"
else
  log "no manifest — fallback list (secret only if ours is unknown: skipping it)"
  LIST="$FALLBACK"
fi

CHANGED=0
for entry in $LIST; do
  case "$entry" in
    keep:*)
      log "чужое, пропускаем: ${entry#keep:}"
      continue
      ;;
    legacy:*)
      f="${entry#legacy:}"
      if grep -q "luci.controller.openflux\|cbi(\"openflux\")\|cbi('openflux')" "$f" 2>/dev/null; then
        rm -f "$f" && log "removed legacy $f" && CHANGED=1
      else
        log "чужое/измененное, пропускаем: $f"
      fi
      continue
      ;;
  esac
  case "$entry" in
    # секрет: трем только если это наш формат (48 символов A-Za-z0-9),
    # чужой файл с секретами не трогаем
    */secret.txt)
      if [ -f "$entry" ] && grep -q "^[A-Za-z0-9][A-Za-z0-9]*$" "$entry" 2>/dev/null \
        && [ "$(wc -c < "$entry" | tr -d ' ')" = "49" ]; then
        rm -f "$entry" && log "removed $entry" && CHANGED=1
      elif [ -f "$MANIFEST" ]; then
        rm -f "$entry" && log "removed $entry (ours per manifest)" && CHANGED=1
      else
        log "неизвестный secret.txt без манифеста — пропускаем"
      fi
      continue
      ;;
  esac
  if [ -e "$entry" ]; then
    # init-скрипт: чужой (без нашей метки) — только бэкап, не удаление
    if [ "$entry" = "/etc/init.d/openflux" ] && ! grep -q "$MARKER" "$entry" 2>/dev/null; then
      log "чужой /etc/init.d/openflux — не трогаем"
      continue
    fi
    rm -f "$entry" && log "removed $entry" && CHANGED=1
  fi
done

[ -f "$MANIFEST" ] && rm -f "$MANIFEST"
rmdir "$CONF_DIR" 2>/dev/null || true

if [ "$CHANGED" = "1" ]; then
  rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
  /etc/init.d/rpcd restart 2>/dev/null || true
  /etc/init.d/uhttpd restart 2>/dev/null || true
fi

echo "--- проверка ---"
pgrep -af openflux || echo "процессов нет"
ls /etc/openflux 2>&1 || true
ls /etc/config/openflux 2>&1 || true
echo "Готово."
