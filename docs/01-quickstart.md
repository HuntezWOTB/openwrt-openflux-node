# 01. Быстрый старт: от чистой прошивки до запущенной ноды

Время: ~15 минут. Нужны: роутер OpenWrt с интернетом, ПК с SSH.

## Шаг 1. Положите репозиторий на роутер

Без `sftp-server` в прошивке обычный `scp -r` падает с
`ash: /usr/libexec/sftp-server: not found`. Тогда передавайте через `tar`
(ему сервер не нужен). На ПК, из корня репозитория:

```powershell
cd OpenFlux_Noda_OpenWRT
tar -cf - install.sh install_openflux.sh check.sh client.conf.example luci-app-openflux | ssh root@192.168.1.1 "mkdir -p /tmp/oflux-setup; tar -xf - -C /tmp/oflux-setup; ls /tmp/oflux-setup"
```

Либо почините `scp` пакетом на роутере: `apk update; apk add openssh-sftp-server`.

## Шаг 2. Установка одной командой

На роутере:

```sh
cd /tmp/oflux-setup
sh install.sh
```

Что произойдет: скачается `openflux-linux-*` под архитектуру
(`uname -m`: `aarch64` -> `arm64`), создастся `/etc/openflux/secret.txt`,
поставится панель `Службы -> OpenFlux`, сервис встанет в автозапуск.

Для `mips/mipsle` готового билда нет — соберите на ПК вручную:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=mipsle GOMIPS=softfloat \
  go build -ldflags="-s -w" -trimpath -o openflux-mipsle .
```

и скопируйте в `/usr/bin/openflux`, затем перезапустите `install.sh`.

## Шаг 3. Откройте панель

Разлогиньтесь/залогиньтесь в LuCI. Должен появиться пункт
`Службы -> OpenFlux`. Если нет — `docs/05-troubleshoot.md`, раздел про меню.

## Шаг 4. Дальше

1. `docs/02-mailru-doc.md` — создайте и вставьте URL.
2. `docs/03-second-side.md` — подключите телефон/ноутбук тем же URL и секретом.

Сохраните общий секрет из `cat /etc/openflux/secret.txt` — он понадобится
на второй стороне.
