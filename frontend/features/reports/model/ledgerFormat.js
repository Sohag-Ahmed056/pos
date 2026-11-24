import Decimal from 'decimal.js';

export const ledgerAmount = (value) => {
    const [integer, fraction] = new Decimal(value || 0).toFixed(2).split('.');
    return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
};
export const ledgerDate = (value, fullYear = false) => {
    const [year, month, day] = String(value || '')
        .slice(0, 10)
        .split('-');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return year && month && day
        ? `${day}-${months[Number(month) - 1]}-${fullYear ? year : year.slice(-2)}`
        : '';
};
export const ledgerTransaction = (value) =>
    ({
        SALES: 'Sales',
        RECEIPTS: 'Receipts',
        SALES_RETURNS: 'Sales Return',
        OPENING_BALANCE: 'Opening Balance',
        ADJUSTMENT: 'Adjustment',
        REVERSAL: 'Reversal',
        GRNS: 'Goods Receipt',
        PAYMENTS: 'Supplier Payment',
        PURCHASE_RETURNS: 'Purchase Return',
        EXPENSES: 'Expense',
        ADJUSTMENTS: 'Stock Adjustment',
        OPENING: 'Opening Stock',
        GRN: 'Goods Receipt',
        SALE: 'Sale',
        SALE_RETURN: 'Sales Return',
        PURCHASE_RETURN: 'Purchase Return',
        ADJUST_IN: 'Stock Increase',
        ADJUST_OUT: 'Stock Decrease'
    })[value] || value;
export const ledgerPrintDate = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(value);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${ledgerDate(`${part('year')}-${part('month')}-${part('day')}`, true)} ${part('hour')}:${part('minute')}`;
};
export const ledgerAmounts = [
    'Debit — Sales',
    'Debit — Adjustment',
    'Credit — Collection',
    'Credit — Return',
    'Credit — Adjustment',
    'Closing Balance'
];
