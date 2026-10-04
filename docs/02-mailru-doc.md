# 02. Общий документ Mail.ru: создание и привязка

Почему Mail.ru: подключается с первого раза, встроенных проверок заметно
меньше, чем у alternatives. Транспорт двусторонний — документу нужны права
на изменение, иначе стороны не смогут записывать сообщения друг другу.

## Создание

1. Откройте `cloud.mail.ru`, загрузите любой файл (содержимое не важно).
2. `Поделиться` -> доступ `всем` -> `Редактировать документ`.
   Без права редактирования нода не сможет положить ответ в документ.
3. `Скопировать` ссылку вида `https://cloud.mail.ru/public/XXXX/YYYY`.

## Привязка на роутере

В `Службы -> OpenFlux`:

- `Транспорт = mailru`
- `URL общего документа =` вставленная ссылка
- `Мультитранспорт =` пусто (пока один документ)
- `Шифрованная сессия =` включено
- `Файл кук = /tmp/cookies-mailru.json`
- `Логирование = -dd` на время настройки, потом `0`

`Сохранить + Применить`. Или через SSH:

```sh
uci set openflux.main.transport='mailru'
uci set openflux.main.url='https://cloud.mail.ru/public/XXXX/YYYY'
uci set openflux.main.transports=''
uci set openflux.main.cookie_store='/tmp/cookies-mailru.json'
uci set openflux.main.negotiate='1'
uci commit openflux
```

## Перезапуск и проверка

```sh
/etc/init.d/openflux enable
/etc/init.d/openflux stop; sleep 2; /etc/init.d/openflux start
sleep 15
pgrep -af openflux
logread -e openflux | grep -E "M-DOCS|SESSION|Running|Auth" | tail -20
```

Ожидаем: `WebSocket connected`, `Auth OK`, `waiting for a client`,
без строк про проверки. Если документ запросил проверку — `docs/04-access-check.md`.
