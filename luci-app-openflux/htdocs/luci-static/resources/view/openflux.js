'use strict';
'require form';
'require rpc';
'require view';

var callGetStatus = rpc.declare({
	object: 'luci.openflux',
	method: 'getStatus'
});

var callGetLog = rpc.declare({
	object: 'luci.openflux',
	method: 'getLog',
	params: ['lines']
});

var callSetAction = rpc.declare({
	object: 'luci.openflux',
	method: 'setAction',
	params: ['action']
});

var callSetSecret = rpc.declare({
	object: 'luci.openflux',
	method: 'setSecret',
	params: ['secret']
});

var callWipeDoc = rpc.declare({
	object: 'luci.openflux',
	method: 'wipeDoc'
});

var callGetSecret = rpc.declare({
	object: 'luci.openflux',
	method: 'getSecret'
});

function randomSecret() {
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var out = '';
	var rnd = new Uint32Array(48);
	crypto.getRandomValues(rnd);
	for (var i = 0; i < rnd.length; i++)
		out += chars[rnd[i] % chars.length];
	return out;
}

function stateTitle(state) {
	switch (state) {
		case 'connected': return _('Сессия активна');
		case 'waiting': return _('Подключена, ждет вторую сторону');
		case 'captcha': return _('Нужна проверка доступа (см. раздел ниже)');
		case 'starting': return _('Запускается…');
		case 'error': return _('Ошибка запуска (смотри лог)');
		case 'stopped': return _('Остановлена');
		default: return _('Нет данных — обновите страницу');
	}
}

function captchaTitle(c) {
	switch (c) {
		case 'required': return _('Проверка: требуется подтверждение');
		case 'passed': return _('Проверка: пройдена');
		default: return _('Проверка: нет данных');
	}
}

function stateColor(state) {
	switch (state) {
		case 'connected': return '#12805c';
		case 'waiting': return '#8a6d00';
		case 'captcha': return '#b35400';
		case 'starting': return '#1a6fb5';
		case 'error': return '#b52a1a';
		default: return '#666';
	}
}

	var TRANSPORT_URLS = {
	'yandex':     { hosts: ['disk.yandex.ru', 'docs.yandex.ru'], ph: 'https://disk.yandex.ru/i/asdfghjklzxcvb',
		help: 'Формат: disk.yandex.ru/i/… (пример: disk.yandex.ru/i/asdfghjklzxcvb). Подойдет и длинная docs.yandex.ru/edit/… — редирект проходится сам. Нужно право редактирования. Часто запрашивает проверку — см. раздел ниже.' },
	'vyandex':    { hosts: ['volga.yandex'], ph: 'https://volga.yandex.ru/...',
		help: 'Ссылка на документ Volga (HTTP relay + WS) с правом редактирования.' },
	'boards':     { hosts: ['boards.yandex'], ph: 'https://boards.yandex.ru/whiteboard/?hash=…',
		help: 'Формат: boards.yandex.ru/whiteboard/?hash=… (пример: …?hash=1234567890qwertyuiopasdfghjklzxc) с правом редактирования.' },
	'oneme':      { hosts: [], ph: '— (нужны токен/UID, панелью пока не настраиваются)',
		help: 'MAX/OneMe работает по токену и UID, а не по ссылке. Панелью пока не настраивается — см. README upstream.' },
	'cupsonline': { hosts: ['cups.online'], ph: 'https://interview.cups.online/live-coding/?room=...',
		help: 'Ссылка на комнату Cups.online — в ней встречаются обе стороны.' },
	'mailru':     { hosts: ['cloud.mail.ru/public/'], ph: 'https://cloud.mail.ru/public/qwer/tyuiopasd',
		help: 'Формат: cloud.mail.ru/public/XXXX/YYYY (пример: cloud.mail.ru/public/qwer/tyuiopasd). Публичная ссылка с правом редактирования: файл → Поделиться → всем → Редактировать документ → Скопировать.' }
};

function transportOfUrl(url) {
	for (var t in TRANSPORT_URLS) {
		var hs = TRANSPORT_URLS[t].hosts;
		for (var i = 0; i < hs.length; i++)
			if (url.indexOf(hs[i]) !== -1) return t;
	}
	return '';
}

function urlError(tr, url) {
	if (!url) return '';
	var found = transportOfUrl(url);
	if (found && found !== tr)
		return _('Похоже, это ссылка транспорта «%s», а выбран «%s». Вставьте ссылку нужного сервиса или смените транспорт.').format(found, tr);
	if (!found && TRANSPORT_URLS[tr] && TRANSPORT_URLS[tr].hosts.length)
		return _('Ссылка не похожа на адрес транспорта «%s». Проверьте, что скопировали ее целиком.').format(tr);
	return '';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.uci.load('openflux'),
			callGetStatus().then(
				function(res) { return (res && res.openflux) || null; },
				function() { return null; }
			),
			callGetLog('25').then(
				function(res) { return (res && res.openflux && res.openflux.lines) || null; },
				function() { return null; }
			)
		]);
	},

	render: function(data) {
		var m, s, o;
		var badgeEl, infoEl, extraEl, logEl, secretEl, toggleBtn;
		var lastStatus = data[1];
		var secretShown = false;

		function captchaLine(st) {
			var parts = [captchaTitle(st.captcha)];
			if (st.account)
				parts.push(_('Аккаунт: ') + st.account);
			return parts.join(' · ');
		}

		function refreshStatus() {
			return callGetStatus().then(
				function(res) { paintStatus((res && res.openflux) || null); },
				function() { paintStatus(null); }
			);
		}

		function refreshLog() {
			return callGetLog('25').then(
				function(res) {
					var lines = (res && res.openflux && res.openflux.lines) || null;
					logEl.textContent = lines ? lines.join('\n') : _('Лог недоступен');
				},
				function() { logEl.textContent = _('Лог недоступен'); }
			);
		}

		function paintStatus(st) {
			lastStatus = st;
			var state = st ? st.state : 'unknown';
			badgeEl.textContent = stateTitle(state);
			badgeEl.style.backgroundColor = stateColor(state);
			if (toggleBtn) {
				var running = !!(st && st.running);
				toggleBtn.textContent = running ? _('Отключить') : _('Подключить');
				toggleBtn.setAttribute('class', running ? 'btn cbi-button cbi-button-reset' : 'btn cbi-button cbi-button-apply');
				toggleBtn.style.fontWeight = 'bold';
			}
			if (!st) {
				infoEl.textContent = _('Бэкенд luci.openflux недоступен. Выполните на роутере openflux_owrt_install.sh');
				return;
			}
			infoEl.textContent = _('Транспорт: ') + (st.transport || '?') +
				' · ' + _('документ: ') + (st.url_host || _('не задан')) +
				' · ' + _('секрет: ') + (+st.secret_len >= 16 ? _('задан') : _('НЕ ЗАДАН')) +
				' · ' + _('куки: ') + (+st.cookie_ok ? _('есть') : _('нет'));
			extraEl.textContent = captchaLine(st);
			extraEl.style.color = st.captcha === 'required' ? '#f0a13c' : '#ccc';
		}

		function doShowSecret() {
			if (secretEl.style.display === 'block' && secretShown) {
				secretEl.style.display = 'none';
				secretEl.textContent = '';
				secretShown = false;
				return Promise.resolve();
			}
			return callGetSecret().then(function(res) {
				secretEl.style.display = 'block';
				if (res && res.ok) {
					secretEl.textContent = _('Текущий секрет (скопируйте на вторую сторону): ') + res.secret;
					secretShown = true;
				} else {
					secretEl.textContent = _('Секрет не задан.');
					secretShown = false;
				}
			});
		}

		function doWipeDoc() {
			if (!confirm(_('Стереть URL, вставленные куки и файл кук, остановить ноду?')))
				return Promise.resolve();
			secretEl.style.display = 'block';
			secretEl.textContent = _('Зачищаю…');
			return callWipeDoc().then(function() {
				secretEl.textContent = _('Готово: данные документа стерты, нода остановлена.');
				return refreshStatus().then(refreshLog);
			});
		}

		function doOpenDoc() {
			var url = L.uci.get('openflux', 'main', 'url') || '';
			if (!url) {
				secretEl.style.display = 'block';
				secretEl.textContent = _('URL не задан — вставьте его ниже и сохраните.');
				return;
			}
			window.open(url, '_blank');
		}

		function doAction(action) {
			badgeEl.textContent = _('Выполняю…');
			return callSetAction(action).then(function() {
				return new Promise(function(resolve) { setTimeout(resolve, 3000); });
			}).then(refreshStatus).then(refreshLog);
		}

		function doToggle() {
			if (lastStatus && lastStatus.running) {
				badgeEl.textContent = _('Выполняю…');
				return callSetAction('stop').then(function() {
					return callSetAction('disable');
				}).then(function() {
					return new Promise(function(resolve) { setTimeout(resolve, 2000); });
				}).then(refreshStatus).then(refreshLog);
			}
			secretEl.style.display = 'block';
			var liveInput = document.querySelector('[id="cbid.openflux.main.url"] input');
			var liveUrl = liveInput ? liveInput.value : '';
			var url = L.uci.get('openflux', 'main', 'url') || '';
			if (liveUrl && liveUrl !== url) {
				secretEl.textContent = _('Похоже, URL изменен, но не сохранен. Нажмите «Сохранить» внизу страницы, потом снова «Подключить».');
				return Promise.resolve();
			}
			if (!url || /ЗАМЕНИ|XXXX/.test(url)) {
				secretEl.textContent = _('Сначала вставьте URL общего документа ниже и нажмите Сохранить.');
				return Promise.resolve();
			}
			if (!lastStatus || +lastStatus.secret_len < 16) {
				secretEl.textContent = _('Сначала задайте секрет кнопкой «Новый секрет» ниже.');
				return Promise.resolve();
			}
			badgeEl.textContent = _('Выполняю…');
			return callSetAction('enable').then(function() {
				return callSetAction('restart');
			}).then(function() {
				return new Promise(function(resolve) { setTimeout(resolve, 3000); });
			}).then(refreshStatus).then(refreshLog);
		}

		function doNewSecret() {
			var s = randomSecret();
			return callSetSecret(s).then(function(res) {
				if (res && res.ok) {
					secretEl.textContent = _('Новый секрет (скопируйте на вторую сторону): ') + s;
					return doAction('restart');
				}
				secretEl.textContent = _('Ошибка записи секрета.');
			});
		}

		function doEnterSecret() {
			var s = prompt(_('Вставьте общий секрет (мин. 16 символов A-Za-z0-9):'), '');
			if (!s) return Promise.resolve();
			return callSetSecret(s).then(function(res) {
				if (res && res.ok) {
					secretEl.textContent = _('Секрет сохранен.');
					return doAction('restart');
				}
				secretEl.textContent = _('Не подходит: нужно мин. 16 символов A-Za-z0-9.');
			});
		}

		badgeEl = E('span', {
			'style': 'display:inline-block;padding:4px 12px;border-radius:4px;color:#fff;font-weight:bold;background-color:#666;'
		}, _('…'));

		infoEl = E('div', { 'style': 'margin:6px 0;color:#ccc;' }, '');

		extraEl = E('div', { 'style': 'margin:2px 0 6px 0;color:#ccc;font-size:12px;' }, '');

		logEl = E('pre', {
			'style': 'max-height:180px;overflow:auto;background:#111;color:#bbb;padding:8px;font-size:11px;white-space:pre-wrap;'
		}, (data[2] && data[2].join('\n')) || _('Лог недоступен'));

		paintStatus(data[1]);

		secretEl = E('div', {
			'style': 'margin:6px 0;padding:6px 8px;background:#111;color:#8f8;word-break:break-all;font-size:12px;display:none;'
		}, '');

		toggleBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'style': 'font-weight:bold;',
			'click': function() { doToggle(); }
		}, _('Подключить'));

		var moreBox = E('details', { 'style': 'margin:8px 0;' }, [
			E('summary', { 'style': 'cursor:pointer;color:#999;' }, _('Еще действия')),
			E('div', { 'style': 'margin:8px 0;' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function() { doAction('restart'); }
				}, _('Перезапустить')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function() { doOpenDoc(); }
				}, _('Открыть документ')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function() {
						secretEl.style.display = 'block';
						doNewSecret();
					}
				}, _('Новый секрет')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function() {
						secretEl.style.display = 'block';
						doEnterSecret();
					}
				}, _('Ввести секрет')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function() { doShowSecret(); }
				}, _('👁 Секрет')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-reset',
					'click': function() { doWipeDoc(); }
				}, _('Очистить данные'))
			])
		]);

		var box = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Состояние ноды')),
			E('div', {}, [badgeEl]),
			infoEl,
			extraEl,
			E('div', { 'style': 'margin:8px 0;' }, [toggleBtn]),
			moreBox,
			secretEl,
			E('h4', {}, _('Последние события')),
			logEl
		]);

		L.Poll.add(refreshStatus, 10);

		m = new form.Map('openflux', _('OpenFlux'),
			_('Домашний роутер как выходная нода OpenFlux (режим l4). Нода сама подключается к общему документу/комнате, публичный IP и входящие порты не нужны.'));

		s = m.section(form.NamedSection, 'main', 'openflux', _('Настройки ноды'));
		s.addremove = false;
		s.anonymous = false;
		s.tab('connect', _('Подключение'));
		s.tab('advanced', _('Дополнительно'));

		o = s.taboption('connect', form.Flag, 'enabled', _('Включено'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('advanced', form.ListValue, 'mode', _('Режим'));
		o.value('l4', 'l4 (gVisor-прокси, для роутера)');
		o.value('proxy', 'proxy (алиас l4)');
		o.default = 'l4';

		o = s.taboption('connect', form.ListValue, 'transport', _('Транспорт'));
		o.value('mailru', 'mailru — Mail.ru Docs');
		o.value('yandex', 'yandex — Yandex Docs (WS)');
		o.value('boards', 'boards — Yandex Board');
		// Скрыты до проверки: vyandex, oneme, cupsonline.
		// Вернуть: o.value('vyandex', …); o.value('oneme', …); o.value('cupsonline', …);
		o.default = 'mailru';

		o = s.taboption('connect', form.Value, 'url', _('URL общего документа/комнаты'));
		o.placeholder = 'https://cloud.mail.ru/public/...';
		o.optional = true;
		o.description = _('Можно оставить пустым на время простоя. Тот же URL указывается на второй стороне.');
		o.validate = function(sid, val) {
			if (!val) return true;
			var sel = document.querySelector('[id="cbid.openflux.main.transport"] select');
			var tr = (sel && sel.value) || L.uci.get('openflux', 'main', 'transport') || '';
			return urlError(tr, val) || true;
		};

		o = s.taboption('advanced', form.Value, 'transports', _('Мультитранспорт'));
		o.placeholder = 'yandex:50,mailru:40';
		o.optional = true;
		o.description = _('Пусто = одиночный транспорт выше.');

		o = s.taboption('connect', form.Flag, 'negotiate', _('Шифрованная сессия (--negotiate)'));
		o.default = '1';
		o.description = _('Включено на обеих сторонах + одинаковый секрет.');

		o = s.taboption('advanced', form.ListValue, 'debug', _('Логирование'));
		o.value('0', '- (тихо)');
		o.value('1', '-d (строка на пакет)');
		o.value('2', '-dd (+ операционные логи)');
		o.value('3', '-ddd (+ hexdump)');
		o.default = '1';

		o = s.taboption('advanced', form.Value, 'cookie_store', _('Файл кук'));
		o.default = '/tmp/cookies-mailru.json';
		o.description = _('Держим в /tmp (RAM), чтобы не тереть флеш.');

		o = s.taboption('advanced', form.Value, 'encryption_key_file', _('Файл секрета'));
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
				_('Подсказка: свежие события видны в блоке выше.');
		};

		o = s.option(form.TextValue, 'cookies_paste', _('Куки для документа'));
		o.rows = 5;
		o.optional = true;
		o.placeholder = 'i=ABC123...; yandexuid=123456...';
		o.description = _('Форматы: "a=b; c=d" (из document.cookie), построчно "a=b", Netscape cookies.txt целиком или JSON {"a":"b"}. Запишется в cookie_store под текущий URL при старте сервиса.');

		return m.render().then(function(mapNode) {
			var wrap = E('div', {}, [box, mapNode]);
			var trSel = wrap.querySelector('[id="cbid.openflux.main.transport"] select');
			var urlBox = wrap.querySelector('[id="cbid.openflux.main.url"]');
			var urlInput = urlBox ? urlBox.querySelector('input[type="text"], input:not([type])') : null;
			var errEl = E('div', { 'style': 'color:#f0a13c;font-size:12px;margin-top:2px;display:none;' }, '');
			var helpEl = E('div', { 'style': 'color:#999;font-size:12px;margin-top:2px;' }, '');
			if (urlBox) { urlBox.appendChild(helpEl); urlBox.appendChild(errEl); }
			function syncUrlHint() {
				if (!trSel || !urlInput) return;
				var meta = TRANSPORT_URLS[trSel.value];
				if (meta && meta.ph) urlInput.placeholder = meta.ph;
				helpEl.textContent = (meta && meta.help) || '';
				var err = urlError(trSel.value, urlInput.value);
				errEl.textContent = err;
				errEl.style.display = err ? 'block' : 'none';
			}
			if (trSel) trSel.addEventListener('change', syncUrlHint);
			if (urlInput) urlInput.addEventListener('input', syncUrlHint);
			syncUrlHint();
			return wrap;
		});
	}
});
