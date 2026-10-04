# 05. Диагностика

Быстрый сбор состояния (есть `check.sh`):

```sh
pgrep -af openflux
cat /etc/config/openflux
wc -c /etc/openflux/secret.txt
ls -l /tmp/cookies-*.json
logread -e openflux | tail -40
```

## Пункта Службы -> OpenFlux нет

```sh
ls -l /www/luci-static/resources/view/openflux.js \
      /usr/share/luci/menu.d/luci-app-openflux.json \
      /usr/share/rpcd/acl.d/luci-app-openflux.json
```

Файлов нет — не выполнен `openflux_owrt_install.sh`.
Файлы есть, пункта нет — разлогиньтесь/залогиньтесь в LuCI, перезапустите
`rpcd` и `uhttpd`. Прямая ссылка для проверки:
`http://192.168.1.1/cgi-bin/luci/admin/services/openflux`.

Симптом `Lua controller ... no Lua runtime` в логе — на роутере современный
LuCI, а когда-то ставилась старая Lua-версия панели. Установщик
`openflux_owrt_install.sh` такие остатки чистит сам (только свои, по метке);
вручную: удалите файлы из `/usr/lib/lua/luci/{controller,model/cbi}/openflux*`
и переустановите.

## Проверка бэкенда панели (статус/лог/кнопки)

```sh
ubus -S call luci.openflux getStatus
ubus -S call luci.openflux getLog '{"lines":"15"}'
ubus -S call luci.openflux getSecret
ubus -S call luci.openflux setAction '{"action":"restart"}'
sleep 5
ubus -S call luci.openflux getStatus
```

Секрет тоже можно задать без SSH (мин. 16 символов A-Za-z0-9):

```sh
ubus -S call luci.openflux setSecret '{"secret":"ЗАМЕНИТЕ_НА_СВОЙ"}'
```

Зачистка данных документа перед долгим простоем (сотрет URL, вставку кук,
файл кук и остановит ноду):

```sh
ubus -S call luci.openflux setAction '{"action":"stop"}'
ubus -S call luci.openflux wipeDoc
```

Если `ubus` отвечает `Not found` — не встал бэкенд: проверьте
`/usr/libexec/rpcd/luci.openflux` (+x) и перезапустите `rpcd`.
Если в браузере бейдж `Бэкенд недоступен` — та же причина или не хватает
прав: сверьте `/usr/share/rpcd/acl.d/luci-app-openflux.json` и перелогиньтесь.

## Сервис падает в crash loop

- `secret ... missing` / `too short` — нет `/etc/openflux/secret.txt`
  или он пустой. Создается установщиком. В прошивке часто нет
  `base64`, поэтому секрет генерируем через `tr` (уже учтено в скрипте).
- `URL is empty` — не задан URL в панели.
- `restart` отвечает `Command failed: Not found` — пользуйтесь парой
  `stop` / `start`, это штатно для этого init-скрипта.

## Стороны не договариваются

- `classic-mode frames, but this side serves Session peers only` —
  на второй стороне не включена шифрованная сессия. Включите `--negotiate`.
- Контекст шифрования не совпал — URL на сторонах различаются хоть одним
  символом. Сверьте `uci get openflux.main.url` с URL второй стороны.
- Счетчики `packets=0`, `waiting for a client` долго — вторая сторона еще
  не подключалась или уперлась в проверку документа (см. `docs/04-access-check.md`).

## Куки не применяются

- Файл появляется только на старте сервиса: после вставки в UI сделайте
  `stop/start`, одного `Сохранить` мало.
- `uci get openflux.main.cookies_paste | wc -c` показывает длину вставки.
  Если там меньше ожидаемого — вставка обрезалась, вставьте еще раз.
