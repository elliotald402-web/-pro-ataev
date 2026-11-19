let activeModalDealIdx = null;
let activeModalPayIdx = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dealDate').valueAsDate = new Date();
    document.getElementById('companyName').value = settings.company || 'Pro Ataev';
    document.getElementById('sellerFio').value = settings.sellerFio || '';
    document.getElementById('sellerPhone').value = settings.phone || '+7 (929) 891-88-82 ДЕНАЛБЕК';
    document.getElementById('sellerCity').value = settings.city || 'г. Грозный';
    document.getElementById('tgToken').value = settings.tgToken || '';
    document.getElementById('tgChatId').value = settings.tgChatId || '';

    recalcPrice();
    updateCount();

    const todayStr = new Date().toISOString().slice(0, 10);
    if (settings.lastAutoNotifyDate !== todayStr) {
        sendTelegramOverdueReport(false);
    }
});

function switchTab(tab) {
    ['new', 'db', 'blacklist', 'settings'].forEach(t => {
        document.getElementById('view-' + t).classList.add('hidden');
        document.getElementById('tab-' + t).classList.remove('active');
    });
    document.getElementById('view-' + tab).classList.remove('hidden');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'db') renderTable();
    if (tab === 'blacklist') renderBlacklist();
}

function saveSettings() {
    saveSettingsToDB({
        company: document.getElementById('companyName').value,
        sellerFio: document.getElementById('sellerFio').value,
        phone: document.getElementById('sellerPhone').value,
        city: document.getElementById('sellerCity').value,
        tgToken: document.getElementById('tgToken').value.trim(),
        tgChatId: document.getElementById('tgChatId').value.trim()
    });
    updateAll();
    alert('Настройки сохранены!');
}

function checkBlacklistAndUpdate() {
    const cName = document.getElementById('clientName').value;
    const cPhone = document.getElementById('clientPhone').value;
    const gName = document.getElementById('guarantorName').value;
    const gPhone = document.getElementById('guarantorPhone').value;

    const foundClient = findInBlacklist(cName, cPhone);
    const foundGuarantor = findInBlacklist(gName, gPhone);
    const alertBox = document.getElementById('blacklist-alert');

    if (foundClient || foundGuarantor) {
        const match = foundClient || foundGuarantor;
        const role = foundClient ? 'ПОКУПАТЕЛЬ' : 'ПОРУЧИТЕЛЬ';
        alertBox.innerHTML = `🚫 <b>ВНИМАНИЕ! ${role} В ЧЁРНОМ СПИСКЕ!</b><br>
            <b>${match.name}</b> (${match.phone})<br>
            Причина: <b>${match.reason || 'не указана'}</b> (внесён ${match.date})`;
        alertBox.classList.remove('hidden');
    } else {
        alertBox.classList.add('hidden');
    }
    updateAll();
}

function recalcPrice() {
    const baseRaw = document.getElementById('basePrice').value;
    const base = parseFloat(baseRaw) || 0;
    const down = parseFloat(document.getElementById('downPayment').value) || 0;
    const months = parseInt(document.getElementById('months').value) || 6;
    const hasDown = down > 0;

    let percent = 0;
    let label = '';

    if (!hasDown) {
        if (months === 6) { percent = 29; label = 'Без взноса • 6 мес'; }
        else if (months === 7) { percent = 32; label = 'Без взноса • 7 мес'; }
        else if (months === 8) { percent = 35; label = 'Без взноса • 8 мес'; }
        else { percent = 35; label = 'Без взноса • ручной %'; }
    } else {
        if (months === 6) { percent = 24; label = 'Со взносом • 6 мес'; }
        else if (months === 7) { percent = 26; label = 'Со взносом • 7 мес'; }
        else if (months === 8) { percent = 30; label = 'Со взносом • 8 мес'; }
        else { percent = 30; label = 'Со взносом • ручной %'; }
    }

    document.getElementById('markupPercent').value = percent;
    document.getElementById('tariffHint').innerText = label;

    if (baseRaw !== '' && base > 0) {
        document.getElementById('totalPrice').value = Math.round(base + (base * percent / 100));
    }
    updateAll();
}

function manualMarkupChange() {
    const base = parseFloat(document.getElementById('basePrice').value) || 0;
    const percent = parseFloat(document.getElementById('markupPercent').value) || 0;
    document.getElementById('tariffHint').innerText = 'Ручной %';
    if (base > 0) {
        document.getElementById('totalPrice').value = Math.round(base + (base * percent / 100));
    }
    updateAll();
}

function buildSchedule(months, monthlyAmount, startDateIso) {
    const list = [];
    const base = startDateIso ? new Date(startDateIso) : new Date();
    for (let i = 1; i <= months; i++) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        list.push({
            num: i,
            isoDate: `${yyyy}-${mm}-${dd}`,
            ruDate: `${dd}.${mm}.${yyyy}`,
            amount: monthlyAmount,
            paidAmount: 0,
            paidDate: '',
            paid: false
        });
    }
    return list;
}
function updateAll(customDeal = null) {
    const d = customDeal || {
        id: Math.floor(1000 + Math.random() * 9000),
        dateIso: document.getElementById('dealDate').value || new Date().toISOString().slice(0, 10),
        clientName: document.getElementById('clientName').value.trim(),
        clientPhone: document.getElementById('clientPhone').value.trim(),
        clientExtraPhone: document.getElementById('clientExtraPhone').value.trim(),
        guarantorName: document.getElementById('guarantorName').value.trim(),
        guarantorPhone: document.getElementById('guarantorPhone').value.trim(),
        phoneModel: document.getElementById('phoneModel').value.trim(),
        imei: document.getElementById('imei').value.trim(),
        basePrice: parseFloat(document.getElementById('basePrice').value) || 0,
        downPayment: parseFloat(document.getElementById('downPayment').value) || 0,
        months: parseInt(document.getElementById('months').value) || 6,
        markupPercent: parseFloat(document.getElementById('markupPercent').value) || 0,
        totalPrice: parseFloat(document.getElementById('totalPrice').value) || 0,
        pledge: document.getElementById('pledgeStatus').value
    };

    const remainder = Math.max(0, d.totalPrice - d.downPayment);
    const monthly = Math.ceil(remainder / d.months);
    const schedule = d.schedule || buildSchedule(d.months, monthly, d.dateIso);
    const formattedDate = d.dateIso.split('-').reverse().join('.');
    const markupRub = d.basePrice > 0 ? Math.max(0, d.totalPrice - d.basePrice) : 0;

    if (!customDeal) {
        document.getElementById('calcSummary').innerHTML = `
            <strong>Итоговая сумма:</strong> ${d.totalPrice.toLocaleString('ru-RU')} ₽${markupRub > 0 ? ` (наценка +${markupRub.toLocaleString('ru-RU')} ₽)` : ''}<br>
            <strong>Остаток долга:</strong> ${remainder.toLocaleString('ru-RU')} ₽ | 
            <strong>Платеж в месяц (${d.months} мес.):</strong> ${monthly.toLocaleString('ru-RU')} ₽
        `;
    }

    const half = Math.ceil(schedule.length / 2);
    let col1 = '';
    let col2 = '';

    schedule.forEach((s, idx) => {
        const parts = s.ruDate.split('.');
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        const line = `<div class="schedule-item"><b>${s.num}-й платеж</b> «<u><b>${day}</b></u>» <u><b>${month}</b></u> <u><b>${year}</b></u> г. — ______________ руб.</div>`;
        if (idx < half) col1 += line;
        else col2 += line;
    });

    const productFull = d.phoneModel ? `${d.phoneModel}${d.imei ? ' (IMEI: ' + d.imei + ')' : ''}` : '';
    const clientContacts = [d.clientPhone, d.clientExtraPhone].filter(Boolean).join(', ');

    document.getElementById('contract-area').innerHTML = `
        <div class="doc-header-brand">${settings.company}</div>
        <div class="doc-title">Договор купли-продажи № <u>${d.id}</u></div>
        <div class="doc-city-date">
            <div>${settings.city}</div>
            <div>Дата: <u>${formattedDate} г.</u></div>
        </div>
        <div class="doc-line-row">ФИО <span class="doc-underline">${settings.sellerFio || ''}</span> («Продавец»)</div>
        <div class="doc-line-row">ФИО <span class="doc-underline">${d.clientName || ''}</span> («Покупатель»)</div>

        <div class="doc-section-title">1. Предмет договора</div>
        <div class="doc-p">1.1. Продавец передает в собственность Покупателя Товар, указанный в настоящем пункте:</div>
        <table class="doc-table">
            <thead>
                <tr>
                    <th style="width:30px;">№</th>
                    <th>Наименование товара / IMEI</th>
                    <th style="width:55px;">Кол-во</th>
                    <th style="width:95px;">Цена за ед.</th>
                    <th style="width:105px;">Общая стоимость (руб)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1.</td>
                    <td class="left"><b>${productFull || '&nbsp;'}</b></td>
                    <td>${productFull ? '1' : ''}</td>
                    <td>${d.totalPrice ? d.totalPrice.toLocaleString('ru-RU') : ''}</td>
                    <td><b>${d.totalPrice ? d.totalPrice.toLocaleString('ru-RU') : ''}</b></td>
                </tr>
            </tbody>
        </table>

        <div class="doc-p">1.2. Право собственности на Товар переходит от Продавца к Покупателю с момента подписания данного договора. Все риски Товара переходят к Покупателю с момента передачи Товара Покупателю.</div>
        <div class="doc-p">1.3. Подписанием Договора и получением Товара во владение Покупатель подтверждает, что Товар полностью отвечает требованиям и ожиданиям Покупателя; Покупатель не вправе предъявлять претензии и требования к Продавцу, касающиеся качества Товара в связи с непричастностью Продавца к недостаткам Товара; все подобные требования должны быть адресованы Покупателем к первоначальному поставщику и (или) производителю при содействии Продавца.</div>

        <div class="doc-section-title">2. Цена договора и порядок расчетов</div>
        <div class="doc-p">2.1. Цена товара составляет ( <b>${d.totalPrice.toLocaleString('ru-RU')}</b> ) рублей.</div>
        <div class="doc-p">2.2. Предоплата составляет ( <b>${d.downPayment.toLocaleString('ru-RU')}</b> ) рублей.</div>
        <div class="doc-p">2.3. Оплата товара производится равными частями помесячно (${d.months} мес.). <b>Ежемесячный платеж составляет: ${monthly.toLocaleString('ru-RU')} рублей.</b></div>

        <div class="schedule-grid">
            <div>${col1}</div>
            <div>${col2}</div>
        </div>

        <div class="doc-section-title">3. Обеспечение обязательств и связь сторон</div>
        <div class="doc-p">Покупатель предоставляет Товар в залог для обеспечения своих обязательств по Договору: <b>(${d.pledge})</b>.</div>
        <div class="doc-p">3.1. За выполнение Покупателем своих обязательств по Договору Поручителем выступает гражданин, подписавшийся ниже в графе: Поручитель.</div>
        <div class="doc-p">3.2. При подписании Договора на Поручителя возникают те же обязательства перед Продавцом, которые возникли на Покупателе. При первом требовании Продавца Поручитель обязуется выплатить оставшуюся задолженность Покупателя по Договору.</div>
        <div class="doc-p">3.3. <b>Договорённость по средствам связи:</b> Стороны признают юридическую силу уведомлений, звонков и сообщений (включая мессенджеры WhatsApp и Telegram), направленных по номерам телефонов, указанным в настоящем Договоре. Покупатель и Поручитель обязуются оставаться на связи и уведомлять Продавца о смене номера телефона в течение 24 часов.</div>

        <div class="doc-section-title">4. Заключительные положения</div>
        <div class="doc-p">4.1. Настоящий Договор составлен и подписан в двух подлинных (идентичных) экземплярах, имеющих одинаковую юридическую силу, по одному экземпляру для каждой из Сторон.</div>

        <div class="doc-section-title">5. Адреса, реквизиты и подписи сторон</div>
        <div class="requisites-grid">
            <div class="req-box">
                <div class="req-box-title">Продавец (${settings.company})</div>
                <div class="req-row">Тел: <b>${settings.phone}</b></div>
                <div class="req-row">ФИО: <b>${settings.sellerFio}</b></div>
                <div class="req-row" style="margin-top:10px;">Подпись: _______________ / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /</div>
            </div>
            <div class="req-box">
                <div class="req-box-title">Покупатель</div>
                <div class="req-row">Тел: <b>${clientContacts || '____________________'}</b></div>
                <div class="req-row">ФИО: <b>${d.clientName || '____________________'}</b></div>
                <div class="req-row" style="margin-top:10px;">Подпись: _______________ / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /</div>
            </div>
        </div>
        <div class="requisites-grid" style="grid-template-columns: 1fr;">
            <div class="req-box">
                <div class="req-box-title">Поручитель</div>
                <div class="req-row">Тел: <b>${d.guarantorPhone || '____________________'}</b> &nbsp;&nbsp;&nbsp; ФИО: <b>${d.guarantorName || '____________________________'}</b> &nbsp;&nbsp;&nbsp; Подпись: _____________ / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /</div>
            </div>
        </div>

        <div class="doc-footer-pay">ДЛЯ ОПЛАТЫ СВЯЗАТЬСЯ ПО НОМЕРУ ${settings.phone}</div>
    `;

    return { ...d, remainder, monthly, schedule };
}
function saveDeal() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const model = document.getElementById('phoneModel').value.trim();
    if (!name || !model) {
        alert('Укажите ФИО Покупателя и наименование товара!');
        return;
    }

    const inBL = findInBlacklist(name, phone);
    if (inBL) {
        const proceed = confirm(`⚠️ ВНИМАНИЕ! Этот человек (${inBL.name}) находится в ЧЁРНОМ СПИСКЕ!\nПричина: ${inBL.reason}\n\nВсё равно сохранить договор?`);
        if (!proceed) return;
    }

    const deal = updateAll();
    addDealToDB(deal);
    updateCount();
    alert(`Договор №${deal.id} (${name}) сохранен в базу!`);
}

function renderTable() {
    const query = (document.getElementById('searchInput').value || '').toLowerCase();
    const filter = document.getElementById('filterStatus').value;
    const tbody = document.getElementById('dealsTableBody');

    let overdueClientsCount = 0;

    tbody.innerHTML = deals.map((d, dIdx) => {
        const info = analyzeDeal(d);
        if (!info.isClosed && info.maxOverdueDays > 0) overdueClientsCount++;

        if (filter === 'overdue' && (info.isClosed || info.maxOverdueDays === 0)) return '';
        if (filter === 'active' && info.isClosed) return '';
        if (filter === 'done' && !info.isClosed) return '';

        const searchStr = `${d.clientName} ${d.clientPhone} ${d.imei} ${d.phoneModel} ${d.id}`.toLowerCase();
        if (query && !searchStr.includes(query)) return '';

        const pills = d.schedule.map((s, pIdx) => {
            const paidNow = s.paidAmount !== undefined ? s.paidAmount : (s.paid ? s.amount : 0);
            const isFull = paidNow >= s.amount;
            const isPart = paidNow > 0 && paidNow < s.amount;
            const lateDays = getDaysOverdue(s.isoDate, isFull);

            let cls = 'payment-pill';
            if (isFull) cls += ' paid';
            else if (isPart) cls += ' partial';
            else if (lateDays > 0) cls += ' late';

            return `<span class="${cls}" onclick="openPayModal(${dIdx}, ${pIdx})" title="Нажмите, чтобы отметить оплату">
                ${s.num} мес (${s.ruDate.slice(0, 5)}): ${paidNow > 0 ? paidNow.toLocaleString() + '/' : ''}${s.amount.toLocaleString()}₽
            </span>`;
        }).join('');

        let statusHtml = `<span class="badge badge-active">Активен</span>`;
        if (info.isClosed) {
            statusHtml = `<span class="badge badge-done">Закрыт</span>`;
        } else if (info.maxOverdueDays > 0) {
            statusHtml = `<span class="badge badge-overdue">⚠️ Просрочка: ${info.maxOverdueDays} дн.</span><br><small style="color:#dc2626;font-weight:bold;">Долг: ${info.overdueSum.toLocaleString()} ₽</small>`;
        }

        return `<tr class="${(!info.isClosed && info.maxOverdueDays > 0) ? 'row-overdue' : ''}">
            <td><strong>№${d.id}</strong><br><small>${d.dateIso.split('-').reverse().join('.')}</small></td>
            <td><strong>${d.clientName}</strong><br><small>${d.clientPhone}</small>${d.guarantorName ? `<br><small>Поруч: ${d.guarantorName}</small>` : ''}</td>
            <td>${d.phoneModel}<br><small>IMEI: ${d.imei || '-'}</small></td>
            <td>Цена: ${d.totalPrice.toLocaleString()} ₽<br>Взнос: ${d.downPayment.toLocaleString()} ₽<br><strong>Остаток: ${info.remainingDebt.toLocaleString()} ₽</strong></td>
            <td>${pills}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="loadDealToPrint(${dIdx})">📄 Бланк</button>
                <button class="btn btn-warning btn-sm" onclick="sendClientToBlacklist(${dIdx})" title="Отправить в Чёрный список">🚫 В ЧС</button>
                <button class="btn btn-danger btn-sm" onclick="deleteDeal(${dIdx})">🗑️</button>
            </td>
        </tr>`;
    }).join('');

    updateOverdueBadge(overdueClientsCount);
}

function addManualBlacklist() {
    const name = document.getElementById('blName').value.trim();
    const phone = document.getElementById('blPhone').value.trim();
    const reason = document.getElementById('blReason').value.trim();

    if (!name && !phone) {
        alert('Укажите ФИО или номер телефона!');
        return;
    }

    addToBlacklistDB({
        date: new Date().toLocaleDateString('ru-RU'),
        name: name || 'Без имени',
        phone: phone || '-',
        reason: reason || 'Не указана'
    });

    document.getElementById('blName').value = '';
    document.getElementById('blPhone').value = '';
    document.getElementById('blReason').value = '';

    updateCount();
    renderBlacklist();
    alert('Запись добавлена в Чёрный список!');
}

function sendClientToBlacklist(dealIdx) {
    const d = deals[dealIdx];
    const reason = prompt(`Укажите причину добавления ${d.clientName} в Чёрный список:`, 'Просрочка / невыплата по договору №' + d.id);
    if (reason === null) return;

    addToBlacklistDB({
        date: new Date().toLocaleDateString('ru-RU'),
        name: d.clientName,
        phone: d.clientPhone,
        reason: reason || 'Просрочка по договору №' + d.id
    });

    updateCount();
    alert(`${d.clientName} добавлен в Чёрный список!`);
}

function removeBlacklistItem(idx) {
    if (confirm('Убрать человека из Чёрного списка?')) {
        deleteFromBlacklistDB(idx);
        updateCount();
        renderBlacklist();
    }
}

function renderBlacklist() {
    const query = (document.getElementById('blSearchInput').value || '').toLowerCase();
    const tbody = document.getElementById('blTableBody');

    tbody.innerHTML = blacklist.map((item, idx) => {
        const searchStr = `${item.name} ${item.phone} ${item.reason}`.toLowerCase();
        if (query && !searchStr.includes(query)) return '';

        return `<tr class="row-overdue">
            <td>${item.date}</td>
            <td><strong>${item.name}</strong></td>
            <td><strong>${item.phone}</strong></td>
            <td>${item.reason}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="removeBlacklistItem(${idx})">✅ Убрать из ЧС</button></td>
        </tr>`;
    }).join('');
}

function openPayModal(dealIdx, payIdx) {
    activeModalDealIdx = dealIdx;
    activeModalPayIdx = payIdx;
    const deal = deals[dealIdx];
    const item = deal.schedule[payIdx];
    const paidNow = item.paidAmount !== undefined ? item.paidAmount : (item.paid ? item.amount : 0);

    document.getElementById('modalMonthNum').innerText = item.num;
    document.getElementById('modalClientInfo').innerText = `${deal.clientName} • Договор №${deal.id} • Дата по графику: ${item.ruDate}`;
    document.getElementById('modalPlanAmount').innerText = item.amount.toLocaleString('ru-RU');
    document.getElementById('modalPaidInput').value = paidNow > 0 ? paidNow : item.amount;
    document.getElementById('modalPaidDate').value = item.paidDate || new Date().toISOString().slice(0, 10);

    document.getElementById('payModal').classList.remove('hidden');
}

function closePayModal() {
    document.getElementById('payModal').classList.add('hidden');
}

function confirmPayment() {
    const amount = parseFloat(document.getElementById('modalPaidInput').value) || 0;
    const date = document.getElementById('modalPaidDate').value;
    updatePaymentInDB(activeModalDealIdx, activeModalPayIdx, amount, date);
    closePayModal();
    renderTable();
}

function resetPayment() {
    updatePaymentInDB(activeModalDealIdx, activeModalPayIdx, 0, '');
    closePayModal();
    renderTable();
}

function loadDealToPrint(dealIdx) {
    switchTab('new');
    updateAll(deals[dealIdx]);
}

function deleteDeal(dealIdx) {
    if (confirm('Удалить этот договор из базы?')) {
        deleteDealFromDB(dealIdx);
        updateCount();
        renderTable();
    }
}

function updateOverdueBadge(count) {
    const badge = document.getElementById('overdue-badge');
    if (count > 0) {
        badge.innerText = `⚠️ Просрочек: ${count}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function updateCount() {
    document.getElementById('deals-count').innerText = deals.length;
    document.getElementById('bl-count').innerText = blacklist.length;
    let overdueCount = 0;
    deals.forEach(d => {
        const info = analyzeDeal(d);
        if (!info.isClosed && info.maxOverdueDays > 0) overdueCount++;
    });
    updateOverdueBadge(overdueCount);
}
