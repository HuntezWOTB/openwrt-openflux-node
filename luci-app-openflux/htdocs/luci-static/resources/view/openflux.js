'use strict';
'require form';
'require view';

return view.extend({
	load: function() {
		return L.uci.load('openflux');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('openflux', _('OpenFlux'),
			_('Домашний роутер как выходная нода OpenFlux (режим l4). Нода сама подключается к общему документу/комнате, публичный IP и входящие порты не нужны.'));

		s = m.section(form.NamedSection, 'main', 'openflux', _('Настройки ноды'));
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.Flag, 'enabled', _('Включено'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Режим'));
		o.value('l4', 'l4 (gVisor-прокси, для роутера)');
		o.value('proxy', 'proxy (алиас l4)');
		o.default = 'l4';

		o = s.option(form.ListValue, 'transport', _('Транспорт'));
		o.value('yandex', 'yandex — Yandex Docs (WS)');
		o.value('vyandex', 'vyandex — Volga');
		o.value('boards', 'boards — Yandex Board');
		o.value('oneme', 'oneme — MAX/OneMe');
		o.value('cupsonline', 'cupsonline — Cups.online');
		o.value('mailru', 'mailru — Mail.ru Docs');
		o.default = 'yandex';

		o = s.option(form.Value, 'url', _('URL общего документа/комнаты'));
		o.placeholder = 'https://cloud.mail.ru/public/...';
		o.rmempty = false;
		o.description = _('Тот же URL указывается на второй стороне.');

		o = s.option(form.Value, 'transports', _('Мультитранспорт'));
		o.placeholder = 'yandex:50,mailru:40';
		o.optional = true;
		o.description = _('Пусто = одиночный транспорт выше.');

		o = s.option(form.Flag, 'negotiate', _('Шифрованная сессия (--negotiate)'));
		o.default = '1';
		o.description = _('Включено на обеих сторонах + одинаковый секрет.');

		o = s.option(form.ListValue, 'debug', _('Логирование'));
		o.value('0', '- (тихо)');
		o.value('1', '-d (строка на пакет)');
		o.value('2', '-dd (+ операционные логи)');
		o.value('3', '-ddd (+ hexdump)');
		o.default = '1';

		o = s.option(form.Value, 'cookie_store', _('Файл кук'));
		o.default = '/tmp/cookies-yandex.json';
		o.description = _('Держим в /tmp (RAM), чтобы не тереть флеш.');

		o = s.option(form.Value, 'encryption_key_file', _('Файл секрета'));
		o.default = '/etc/openflux/secret.txt';
		o.rmempty = false;
		o.description = _('Сам ключ лежит в этом файле (0600), в UCI только путь.');

		s = m.section(form.NamedSection, 'main', 'openflux', _('Проверка доступа к документу'));
		s.addremove = false;
		s.anonymous = false;

		o = s.option(form.DummyValue, '_captcha_hint', _('Как пройти'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var url = L.uci.get('openflux', 'main', 'url') || '';
			return _('1. Открой этот же URL в браузере <b>из домашней сети</b> (тот же внешний адрес, что у роутера).<br/>2. Если сервис покажет проверку — пройди ее.<br/>3. DevTools → Application → Cookies → скопируй значения.<br/>4. Вставь ниже и нажми Сохранить+Применить — нода запишет cookie-store и перезапустится.<br/><br/>Документ: ') + '<a href="' + url + '" target="_blank">' + url + '</a><br/>' +
				_('Подсказка: в системном журнале ищи строки SmartCaptcha.');
		};

		o = s.option(form.TextValue, 'cookies_paste', _('Куки для документа'));
		o.rows = 5;
		o.optional = true;
		o.placeholder = 'i=ABC123...; yandexuid=123456...';
		o.description = _('Форматы: "a=b; c=d" (из document.cookie), построчно "a=b", Netscape cookies.txt целиком или JSON {"a":"b"}. Запишется в cookie_store под текущий URL при старте сервиса.');

		return m.render();
	}
});
