const { D } = require('../../shared/financial');

const amountColumns = [
    'Debit — Sales',
    'Debit — Adjustment',
    'Credit — Collection',
    'Credit — Return',
    'Credit — Adjustment',
    'Closing Balance'
];
const zero = () => Object.fromEntries(amountColumns.map((column) => [column, D(0)]));
const serialize = (values) =>
    Object.fromEntries(amountColumns.map((column) => [column, values[column].toFixed(2)]));
const add = (total, row) => {
    for (const column of amountColumns.slice(0, -1)) total[column] = total[column].plus(row[column] || 0);
    total['Closing Balance'] = total[amountColumns[0]]
        .plus(total[amountColumns[1]])
        .minus(total[amountColumns[2]])
        .minus(total[amountColumns[3]])
        .minus(total[amountColumns[4]]);
};
const customerLabel = (customer) => `${customer.name || customer.shop_name} (${customer.id})`;
const buildCustomerLedgerLayout = ({ records, rows, customers, company, filters }) => {
    const byId = new Map(customers.map((customer) => [String(customer.id), customer]));
    const groups = new Map();
    const scopes = new Map();
    const summaries = Object.fromEntries(
        ['customer', 'party', 'area', 'sales_channel'].map((key) => [key, new Map()])
    );
    const totals = zero();
    for (const [index, record] of records.entries()) {
        const customer = byId.get(String(record.party_id)) || {
            id: String(record.party_id),
            name: record.company
        };
        const path = [
            record.sales_channel_snapshot || 'Unassigned',
            record.area_snapshot || 'Unassigned',
            record.party_snapshot || 'Unassigned'
        ];
        const id = JSON.stringify([...path, String(customer.id)]);
        if (!groups.has(id))
            groups.set(id, {
                id,
                channel: path[0],
                area: path[1],
                party: path[2],
                customer: customerLabel(customer),
                address: customer.address || '—',
                indexes: [],
                values: zero(),
                path
            });
        const group = groups.get(id);
        group.indexes.push(index);
        add(group.values, rows[index]);
        add(totals, rows[index]);
        for (let level = 1; level <= 3; level++) {
            const scope = JSON.stringify(path.slice(0, level));
            if (!scopes.has(scope)) scopes.set(scope, zero());
            add(scopes.get(scope), rows[index]);
        }
        for (const [kind, name] of Object.entries({
            customer: customerLabel(customer),
            party: path[2],
            area: path[1],
            sales_channel: path[0]
        })) {
            if (!summaries[kind].has(name)) summaries[kind].set(name, zero());
            add(summaries[kind].get(name), rows[index]);
        }
    }
    const sections = [...groups.values()]
        .sort((a, b) => {
            for (let index = 0; index < 3; index++) {
                const order = a.path[index].localeCompare(b.path[index], 'en');
                if (order) return order;
            }
            return a.customer.localeCompare(b.customer, 'en') || a.id.localeCompare(b.id, 'en');
        })
        .map((group) => ({ ...group, totals: serialize(group.values) }));
    for (const [index, section] of sections.entries()) {
        const next = sections[index + 1];
        section.trailers = [{ label: `Customer (${section.customer}) Sub Total:`, totals: section.totals }];
        for (const [level, title] of [
            [3, 'Party'],
            [2, 'Area'],
            [1, 'Sales Channel']
        ]) {
            const scope = JSON.stringify(section.path.slice(0, level));
            if (!next || JSON.stringify(next.path.slice(0, level)) !== scope)
                section.trailers.push({
                    label: `${title} (${section.path[level - 1]}) Sub Total:`,
                    totals: serialize(scopes.get(scope))
                });
        }
        delete section.values;
        delete section.path;
    }
    const selected = filters.customer_id
        ? byId.get(String(filters.customer_id)) || { id: filters.customer_id, name: 'Customer' }
        : customers.length === 1
          ? customers[0]
          : null;
    const common = (field, fallback) => {
        const values = [...new Set(sections.map((section) => section[field]))];
        return values.length === 1 ? values[0] : values.length ? 'Multiple' : fallback || 'All';
    };
    return {
        company: { name: company?.company_name || 'BatteryPOS', code: company?.company_code || 'POS' },
        heading: {
            channel: common('channel', filters.channel || selected?.sales_channel),
            area: common('area', filters.area || selected?.area_name),
            party: common('party', filters.party || selected?.party_name),
            address: selected?.address || (selected ? '—' : 'All customer addresses'),
            customer: selected ? customerLabel(selected) : 'All customers'
        },
        sections,
        summaries: Object.fromEntries(
            Object.entries(summaries).map(([kind, values]) => [
                kind,
                [...values].map(([name, amounts]) => ({ name, totals: serialize(amounts) }))
            ])
        ),
        totals: serialize(totals)
    };
};
const formatAmount = (value) => {
    const [integer, fraction] = D(value || 0)
        .toFixed(2)
        .split('.');
    return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
};
const formatDate = (value, fullYear = false) => {
    const [year, month, day] = String(value).slice(0, 10).split('-');
    if (!year || !month || !day) return String(value || '');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${day}-${months[Number(month) - 1]}-${fullYear ? year : year.slice(-2)}`;
};
const transactionLabel = (value) =>
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

module.exports = { amountColumns, buildCustomerLedgerLayout, formatAmount, formatDate, transactionLabel };
