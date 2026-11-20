async function sendTelegramMessage(text) {
    if (!settings.tgToken || !settings.tgChatId) {
        return { ok: false, error: 'Не заполнены Token или Chat ID' };
    }

    const cleanToken = settings.tgToken.trim();
    const cleanChatId = settings.tgChatId.trim();
    const params = new URLSearchParams({
        chat_id: cleanChatId,
        text: text,
        parse_mode: 'HTML'
    });
    const domain = 'api' + '.telegram.org';
    const url = `https://${domain}/bot${cleanToken}/sendMessage?${params.toString()}`;

    try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            return { ok: false, error: data.description || `Ошибка HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (e) {
        return {
            ok: false,
            error: 'Нет доступа к ' + domain + '. Проверьте VPN (переключите сервер или режим System Proxy в Happ).'
        };
    }
}

async function testTelegram() {
    saveSettings(true);
    if (!settings.tgToken || !settings.tgChatId) {
        alert('Сначала впишите Bot Token и Chat ID!');
        return;
    }
    const result = await sendTelegramMessage('✅ <b>Pro Ataev CRM:</b> Уведомления о просрочках успешно подключены!');
    if (result.ok) {
        alert('Успешно! Сообщение отправлено в Telegram.');
    } else {
        alert('Ошибка: ' + result.error);
    }
}

function escapeTgHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function sendTelegramOverdueReport(manual = false) {
    if (!settings.tgToken || !settings.tgChatId) {
        if (manual) alert('Настройте Telegram во вкладке «Настройки»!');
        return;
    }

    const debtors = [];
    deals.forEach(d => {
        const info = analyzeDeal(d);
        if (!info.isClosed && info.maxOverdueDays > 0) {
            debtors.push({ deal: d, info });
        }
    });

    if (debtors.length === 0) {
        if (manual) alert('Просроченных платежей на сегодня нет!');
        return;
    }

    const chunkSize = 15;
    for (let i = 0; i < debtors.length; i += chunkSize) {
        const chunk = debtors.slice(i, i + chunkSize);
        let msg = i === 0
            ? `⚠️ <b>PRO ATAEV — СПИСОК ПРОСРОЧЕК (${new Date().toLocaleDateString('ru-RU')})</b>\nВсего должников: ${debtors.length}\n\n`
            : `⚠️ <b>PRO ATAEV — ПРОДОЛЖЕНИЕ СПИСКА:</b>\n\n`;

        chunk.forEach((item, idx) => {
            const num = i + idx + 1;
            msg += `${num}. <b>${escapeTgHtml(item.deal.clientName)}</b> (№${escapeTgHtml(item.deal.id)})\n`;
            msg += `📱 Тел: ${escapeTgHtml(item.deal.clientPhone)}\n`;
            msg += `📦 ${escapeTgHtml(item.deal.phoneModel)}\n`;
            msg += `⏰ Просрочка: <b>${item.info.maxOverdueDays} дн.</b> | Долг: <b>${item.info.overdueSum.toLocaleString('ru-RU')} ₽</b>\n\n`;
        });

        const result = await sendTelegramMessage(msg);
        if (!result.ok) {
            if (manual) alert('Ошибка отправки: ' + result.error);
            return;
        }
    }

    if (manual) {
        alert(`Отчет по ${debtors.length} должникам успешно отправлен в Telegram!`);
    } else {
        saveSettingsToDB({ lastAutoNotifyDate: getLocalIsoDate() });
    }
}
