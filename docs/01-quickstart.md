# 01. Быстрый старт: от чистой прошивки до запущенной ноды

Время: ~15 минут. Нужны: роутер OpenWrt с интернетом и SSH.

## Шаг 1. Установка одной командой

На роутере:

```sh
cd /tmp
wget -qO- https://github.com/HuntezWOTB/openwrt-openflux-node/archive/refs/heads/main.tar.gz | tar -xz
cd openwrt-openflux-node-main
sh openflux_owrt_install.sh
```

Это и есть вся установка: скачается `openflux-linux-*` под архитектуру
(`uname -m`: `aarch64` -> `arm64`), создастся `/etc/openflux/secret.txt`,
поставится панель `Службы -> OpenFlux`, сервис встанет в автозапуск.
Чужие файлы установщик не трогает.

Запасной путь (если на роутере нет выхода на GitHub): передать файлы с ПК.
Без `sftp-server` в прошивке обычный `scp -r` падает с
`ash: /usr/libexec/sftp-server: not found` — передавайте через `tar`.
На ПК, из корня репозитория:

```powershell
cd OpenFlux_Noda_OpenWRT
tar -cf - openflux_owrt_install.sh openflux_owrt_uninstall.sh check.sh client.conf.example luci-app-openflux | ssh root@192.168.1.1 "mkdir -p /tmp/oflux-setup; tar -xf - -C /tmp/oflux-setup; ls /tmp/oflux-setup"
```

затем на роутере `cd /tmp/oflux-setup` и `sh openflux_owrt_install.sh`.
Либо почините `scp`: `apk update; apk add openssh-sftp-server`.

Для `mips/mipsle` готового билда нет — соберите на ПК вручную:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=mipsle GOMIPS=softfloat \
  go build -ldflags="-s -w" -trimpath -o openflux-mipsle .
```

и повторите установку с `BIN_FILE=/usr/bin/openflux sh openflux_owrt_install.sh`.

## Шаг 2. Откройте панель

Разлогиньтесь/залогиньтесь в LuCI. Должен появиться пункт
`Службы -> OpenFlux`. Если нет — `docs/05-troubleshoot.md`, раздел про меню.

## Шаг 3. Дальше без SSH

1. `docs/02-mailru-doc.md` — создайте документ и вставьте URL на вкладке
   `Подключение`, нажмите `Сохранить`.
2. Секрет — кнопкой `Новый секрет` (покажется один раз для копирования)
   или глазком `👁 Секрет` посмотреть текущий.
3. Кнопка `Подключить` — бейдж должен стать зеленым.
4. `docs/03-second-side.md` — подключите телефон/ноутбук тем же URL и секретом.
