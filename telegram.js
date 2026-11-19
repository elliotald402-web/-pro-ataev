async function sendTelegramMessage(text) {
    if (!settings.tgToken || !settings.tgChatId) {
        return false;
    }
    const url = `https://telegram.org{settings.tgToken}/sendMessage`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: settings.tgChatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return res.ok;
    } catch (e) {
        console.error('Ошибка отправки в Telegram:', e);
        return false;
    }
}

async function testTelegram() {
    saveSettings();
    if (!settings.tgToken || !settings.tgChatId) {
        alert('Сначала впишите Bot Token и Chat ID!');
        return;
    }
    const ok = await sendTelegramMessage('✅ <b>Pro Ataev CRM:</b> Уведомления о просрочках успешно подключены!');
    if (ok) {
        alert('Тестовое сообщение отправлено в Telegram!');
    } else {
        alert('Ошибка! Проверьте правильность Token и Chat ID, а также нажмите /start в самом боте.');
    }
}

async function sendTelegramOverdueReport(manual = false) {
    if (!settings.tgToken || !settings.tgChatId) {
        if (manual) alert('Настройте Telegram во вкладке «Настройки и Telegram»!');
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

    let msg = `⚠️ <b>PRO ATAEV — СПИСОК ПРОСРОЧЕК (${new Date().toLocaleDateString('ru-RU')})</b>\n\n`;
    debtors.forEach((item, idx) => {
        msg += `${idx + 1}. <b>${item.deal.clientName}</b> (Договор №${item.deal.id})\n`;
        msg += `📱 Тел: ${item.deal.clientPhone}\n`;
        msg += `📦 Товар: ${item.deal.phoneModel}\n`;
        msg += `⏰ Просрочка: <b>${item.info.maxOverdueDays} дн.</b> | Долг по графику: <b>${item.info.overdueSum.toLocaleString('ru-RU')} ₽</b>\n\n`;
    });

    const ok = await sendTelegramMessage(msg);
    if (manual) {
        alert(ok ? 'Список должников отправлен в Telegram!' : 'Не удалось отправить сообщение.');
    } else if (ok) {
        saveSettingsToDB({ lastAutoNotifyDate: new Date().toISOString().slice(0, 10) });
    }
}
