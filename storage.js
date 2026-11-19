let deals = JSON.parse(localStorage.getItem('pro_ataev_deals') || '[]');
let settings = JSON.parse(localStorage.getItem('pro_ataev_settings') || JSON.stringify({
    company: "Pro Ataev",
    sellerFio: "Атаев Деналбек",
    phone: "+7 (929) 891-88-82 ДЕНАЛБЕК",
    city: "г. Грозный",
    tgToken: "",
    tgChatId: "",
    lastAutoNotifyDate: ""
}));

function saveSettingsToDB(newSettings) {
    settings = { ...settings, ...newSettings };
    localStorage.setItem('pro_ataev_settings', JSON.stringify(settings));
}

function addDealToDB(deal) {
    deals.unshift(deal);
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function updatePaymentInDB(dealIdx, payIdx, paidAmount, paidDate) {
    const item = deals[dealIdx].schedule[payIdx];
    item.paidAmount = paidAmount;
    item.paidDate = paidDate;
    item.paid = paidAmount >= item.amount;
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function deleteDealFromDB(dealIdx) {
    deals.splice(dealIdx, 1);
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function getDaysOverdue(dateIsoStr, isPaid) {
    if (isPaid || !dateIsoStr) return 0;
    const due = new Date(dateIsoStr);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today - due;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function analyzeDeal(deal) {
    let maxOverdueDays = 0;
    let overdueSum = 0;
    let totalPaid = deal.downPayment || 0;

    deal.schedule.forEach(s => {
        const paidNow = s.paidAmount !== undefined ? s.paidAmount : (s.paid ? s.amount : 0);
        totalPaid += paidNow;
        const isFullyPaid = paidNow >= s.amount;
        const days = getDaysOverdue(s.isoDate, isFullyPaid);
        if (days > 0) {
            if (days > maxOverdueDays) maxOverdueDays = days;
            overdueSum += (s.amount - paidNow);
        }
    });

    const isClosed = deal.schedule.every(s => (s.paidAmount !== undefined ? s.paidAmount >= s.amount : s.paid));
    const remainingDebt = Math.max(0, deal.totalPrice - totalPaid);

    return {
        maxOverdueDays,
        overdueSum,
        totalPaid,
        remainingDebt,
        isClosed
    };
}

function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ deals, settings }));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "ProAtaev_Baza_" + new Date().toLocaleDateString('ru-RU') + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.deals) {
                deals = parsed.deals;
                localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
            }
            if (parsed.settings) {
                settings = { ...settings, ...parsed.settings };
                localStorage.setItem('pro_ataev_settings', JSON.stringify(settings));
            }
            updateCount();
            renderTable();
            alert('База успешно загружена!');
        } catch (err) {
            alert('Ошибка при чтении файла!');
        }
    };
    reader.readAsText(file);
}
