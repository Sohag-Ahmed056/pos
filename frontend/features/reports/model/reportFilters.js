import { today } from '../../../lib/format.js';
export const initialReportFilters = (params) => {
    return {
        from: params.get('from') || `${today().slice(0, 7)}-01`,
        to: params.get('to') || today(),
        customer_id: params.get('customer_id') || '',
        supplier_id: params.get('supplier_id') || '',
        account_id: params.get('account_id') || '',
        party: params.get('party') || '',
        area: params.get('area') || '',
        channel: params.get('channel') || '',
        product_id: params.get('product_id') || '',
        warehouse_id: params.get('warehouse_id') || '',
        expense_name: params.get('expense_name') || '',
        payment_account_id: params.get('payment_account_id') || ''
    };
};
export const isPartyLedger = (name) => ['customer-ledger', 'supplier-ledger'].includes(name);
export const reportFilters = (name, form) => {
    const filters = { from: form.from, to: form.to };
    if (name === 'customer-ledger' || name === 'customer-outstanding') filters.customer_id = form.customer_id;
    if (name === 'supplier-ledger' || name === 'supplier-outstanding') filters.supplier_id = form.supplier_id;
    if (name === 'customer-ledger')
        Object.assign(filters, { party: form.party, area: form.area, channel: form.channel });
    if (['stock', 'valuation', 'low-stock', 'stock-movements'].includes(name))
        Object.assign(filters, { product_id: form.product_id, warehouse_id: form.warehouse_id });
    if (name === 'expenses')
        Object.assign(filters, {
            expense_name: form.expense_name,
            payment_account_id: form.payment_account_id
        });
    if (name === 'general-ledger') filters.account_id = form.account_id;
    if (name === 'cash-bank') filters.payment_account_id = form.payment_account_id;
    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
};
