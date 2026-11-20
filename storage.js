const DEFAULT_SETTINGS = {
    company: "Pro Ataev",
    sellerFio: "Атаев Деналбек",
    phone: "+7 (929) 891-88-82 ДЕНАЛБЕК",
    city: "г. Грозный",
    tgToken: "",
    tgChatId: "",
    lastAutoNotifyDate: ""
};

let deals = JSON.parse(localStorage.getItem('pro_ataev_deals') || '[]');
let blacklist = JSON.parse(localStorage.getItem('pro_ataev_blacklist') || '[]');
let settings = {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(localStorage.getItem('pro_ataev_settings') || '{}')
};

function getLocalIsoDate(dateObj = new Date()) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function parseLocalIsoDate(isoStr) {
    if (!isoStr) return new Date();
    const parts = isoStr.split('-').map(Number);
    return new Date(parts.at(0), (parts.at(1) || 1) - 1, parts.at(2) || 1, 0, 0, 0, 0);
}

function saveSettingsToDB(newSettings) {
    settings = { ...settings, ...newSettings };
    localStorage.setItem('pro_ataev_settings', JSON.stringify(settings));
}

function addDealToDB(deal) {
    deals.unshift(deal);
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function updatePaymentInDB(dealIdx, payIdx, paidAmount, paidDate) {
    const deal = deals.at(dealIdx);
    if (!deal || !deal.schedule.at(payIdx)) return;
    const item = deal.schedule.at(payIdx);
    item.paidAmount = Math.max(0, paidAmount);
    item.paidDate = paidDate;
    item.paid = item.paidAmount >= item.amount;
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function deleteDealFromDB(dealIdx) {
    deals.splice(dealIdx, 1);
    localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
}

function addToBlacklistDB(entry) {
    blacklist.unshift(entry);
    localStorage.setItem('pro_ataev_blacklist', JSON.stringify(blacklist));
}

function deleteFromBlacklistDB(idx) {
    blacklist.splice(idx, 1);
    localStorage.setItem('pro_ataev_blacklist', JSON.stringify(blacklist));
}

function findInBlacklist(name, phone) {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const cleanName = (name || '').trim().toLowerCase();
    if (cleanPhone.length < 7 && cleanName.length < 4) return null;

    return blacklist.find(item => {
        const itemPhone = (item.phone || '').replace(/\D/g, '').slice(-10);
        const itemName = (item.name || '').trim().toLowerCase();
        const phoneMatch = cleanPhone.length >= 7 && itemPhone.length >= 7 && cleanPhone === itemPhone;
        const nameMatch = cleanName.length >= 4 && itemName.length >= 4 && (itemName.includes(cleanName) || cleanName.includes(itemName));
        return phoneMatch || nameMatch;
    });
}

function getDaysOverdue(dateIsoStr, isPaid) {
    if (isPaid || !dateIsoStr) return 0;
    const due = parseLocalIsoDate(dateIsoStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today - due;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function analyzeDeal(deal) {
    let maxOverdueDays = 0;
    let overdueSum = 0;
    let schedulePaid = 0;

    deal.schedule.forEach(s => {
        const paidNow = s.paidAmount !== undefined ? s.paidAmount : (s.paid ? s.amount : 0);
        schedulePaid += paidNow;
        const isFullyPaid = paidNow >= s.amount;
        const days = getDaysOverdue(s.isoDate, isFullyPaid);
        if (days > 0) {
            if (days > maxOverdueDays) maxOverdueDays = days;
            overdueSum += Math.max(0, s.amount - paidNow);
        }
    });

    const totalPaid = (deal.downPayment || 0) + schedulePaid;
    const isClosed = deal.schedule.every(s => {
        const paidNow = s.paidAmount !== undefined ? s.paidAmount : (s.paid ? s.amount : 0);
        return paidNow >= s.amount;
    });
    const remainingDebt = isClosed ? 0 : Math.max(0, deal.totalPrice - totalPaid);

    return { maxOverdueDays, overdueSum, totalPaid, remainingDebt, isClosed };
}

function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ deals, blacklist, settings }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "ProAtaev_Baza_" + getLocalIsoDate() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importBackup(event) {
    const file = event.target.files.item(0);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (Array.isArray(parsed.deals)) {
                deals = parsed.deals;
                localStorage.setItem('pro_ataev_deals', JSON.stringify(deals));
            }
            if (Array.isArray(parsed.blacklist)) {
                blacklist = parsed.blacklist;
                localStorage.setItem('pro_ataev_blacklist', JSON.stringify(blacklist));
            }
            if (parsed.settings && typeof parsed.settings === 'object') {
                settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
                localStorage.setItem('pro_ataev_settings', JSON.stringify(settings));
            }
            updateCount();
            renderTable();
            renderBlacklist();
            alert('База и чёрный список успешно загружены!');
        } catch (err) {
            alert('Ошибка при чтении файла!');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}
