#!/bin/sh
# Быстрая диагностика ноды на роутере: sh check.sh
set -eu
echo "== proc =="; pgrep -af openflux || echo "openflux NOT running"
echo "== порты (нода ходит наружу сама, слушать ничего не должна) =="
netstat -tulpn 2>/dev/null | grep -i oflux || ss -tulpn 2>/dev/null | grep -i oflux || echo "(ничего не слушает — это нормально)"
echo "== исходящие соединения =="; netstat -tunp 2>/dev/null | head -20 || ss -tunp 2>/dev/null | head -20
echo "== конфиг =="; cat /etc/config/openflux 2>/dev/null || echo "no /etc/config/openflux"
echo "== секрет =="; wc -c /etc/openflux/secret.txt 2>/dev/null || echo "no secret (создастся в install_openflux.sh)"
echo "== куки =="; ls -l /tmp/cookies-*.json 2>/dev/null || echo "(куки пока нет — появятся после подключения к документу)"
echo "== логи =="; logread -e openflux 2>/dev/null | tail -50 || echo "лог пуст"
echo "== память =="; free -m | head -3
