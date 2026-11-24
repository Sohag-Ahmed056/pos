const { D, assert } = require('../../shared/financial');
const { formatAmount, formatDate, transactionLabel } = require('./customerLedger.layout');

const column = (key, title, width, type = 'text', group) => ({
    key,
    title,
    width,
    type,
    ...(group ? { group } : {})
});
const reportDefinitions = {
    'general-ledger': {
        title: 'General Ledger Accounts',
        groupFields: ['code', 'name'],
        groupKey: 'code',
        columns: [
            column('gl_date', 'GL Date', 55, 'date'),
            column('voucher_no', 'Voucher', 100, 'voucher'),
            column('code', 'Account Code', 65),
            column('name', 'Account Name', 125),
            column('source_type', 'Transaction Type', 90, 'transaction'),
            column('reference_no', 'Reference', 110),
            column('debit', 'Amount', 85, 'money', 'Debit'),
            column('credit', 'Amount', 85, 'money', 'Credit'),
            column('net_movement', 'Movement (Dr − Cr)', 95, 'money')
        ],
        aggregate: 'SUM(debit) debit,SUM(credit) credit',
        metrics: ['debit', 'credit', 'net_movement']
    },
    'cash-bank': {
        title: 'Cash and Bank Ledger',
        groupFields: ['payment_account_id', 'payment_account'],
        groupKey: 'payment_account_id',
        columns: [
            column('gl_date', 'GL Date', 60, 'date'),
            column('voucher_no', 'Voucher', 115, 'voucher'),
            column('payment_account', 'Payment Account', 135),
            column('source_type', 'Transaction Type', 100, 'transaction'),
            column('reference_no', 'Reference', 135),
            column('debit', 'Receipts / In', 90, 'money', 'Debit'),
            column('credit', 'Payments / Out', 90, 'money', 'Credit'),
            column('net_movement', 'Net Movement', 95, 'money')
        ],
        aggregate: 'SUM(debit) debit,SUM(credit) credit',
        metrics: ['debit', 'credit', 'net_movement']
    },
    'stock-movements': {
        title: 'Stock Movement Ledger',
        groupFields: ['warehouse_id', 'warehouse', 'product_id', 'sku', 'product'],
        groupKey: 'stock_group',
        columns: [
            column('occurred_at', 'Date / Time (UTC)', 85, 'datetime'),
            column('sku', 'SKU', 85),
            column('product', 'Product', 130),
            column('warehouse', 'Warehouse', 100),
            column('movement_type', 'Movement', 80, 'transaction'),
            column('movement_reference', 'Source Reference', 100),
            column('quantity_in', 'In', 65, 'quantity', 'Quantity (PCS)'),
            column('quantity_out', 'Out', 65, 'quantity', 'Quantity (PCS)'),
            column('quantity_delta_pcs', 'Net', 65, 'quantity', 'Quantity (PCS)'),
            column('unit_cost', 'Unit Cost (BDT)', 90, 'cost')
        ],
        aggregate:
            'SUM(GREATEST(quantity_delta_pcs,0)) quantity_in,SUM(GREATEST(-quantity_delta_pcs,0)) quantity_out,SUM(quantity_delta_pcs) quantity_delta_pcs',
        metrics: ['quantity_in', 'quantity_out', 'quantity_delta_pcs']
    }
};
const companyDetails = (company) => ({
    name: company?.company_name || 'BatteryPOS',
    code: company?.company_code || 'POS'
});
const stockKey = (row) => `${row.warehouse_id}:${row.product_id}`;
const detailsFor = (name, group) =>
    name === 'general-ledger'
        ? [
              ['Account Code', group.code || 'All accounts'],
              ['Account Name', group.name || 'All accounts'],
              ['Amounts', 'BDT'],
              ['Balance Basis', 'Period debit less credit']
          ]
        : name === 'cash-bank'
          ? [
                ['Payment Account', group.payment_account || 'All cash and bank accounts'],
                ['Amounts', 'BDT'],
                ['Report Scope', 'Posted receipts, payments and adjustments'],
                ['Balance Basis', 'Movement within selected dates']
            ]
          : [
                ['Warehouse', group.warehouse || 'All warehouses'],
                ['Product', group.product || 'All products'],
                ['SKU', group.sku || 'All SKUs'],
                ['Movement Time', 'UTC · Whole PCS quantities']
            ];
const groupLabel = (name, group) =>
    name === 'general-ledger'
        ? `${group.code} — ${group.name}`
        : name === 'cash-bank'
          ? group.payment_account
          : `${group.warehouse} / ${group.sku}`;
const numberString = (value, quantity = false) => D(value || 0).toFixed(quantity ? 0 : 2);
const buildReportStatement = ({ name, rows, groups, company, selection = {} }) => {
    const definition = reportDefinitions[name];
    assert(definition, 'Unknown ledger statement');
    const quantity = name === 'stock-movements';
    for (const row of rows) {
        if (quantity) {
            row.stock_group = stockKey(row);
            const quantity = D(row.quantity_delta_pcs);
            row.quantity_in = quantity.gt(0) ? quantity.toFixed(0) : '0';
            row.quantity_out = quantity.lt(0) ? quantity.negated().toFixed(0) : '0';
            row.movement_reference = `${row.source_type} #${row.source_line_id}`;
        } else row.net_movement = D(row.debit).minus(row.credit).toFixed(2);
    }
    const totals = Object.fromEntries(definition.metrics.map((key) => [key, D(0)]));
    const indexes = new Map();
    for (const [index, row] of rows.entries()) {
        const key = String(row[definition.groupKey]);
        if (!indexes.has(key)) indexes.set(key, []);
        indexes.get(key).push(index);
    }
    const sections = groups.map((group) => {
        const key = quantity ? stockKey(group) : String(group[definition.groupKey]);
        const values = Object.fromEntries(
            definition.metrics.map((metric) => [
                metric,
                metric === 'net_movement'
                    ? D(group.debit).minus(group.credit).toFixed(2)
                    : numberString(group[metric], quantity)
            ])
        );
        for (const metric of definition.metrics) totals[metric] = totals[metric].plus(values[metric]);
        return {
            id: key,
            details: detailsFor(name, group),
            indexes: indexes.get(key) || [],
            activityCount: Number(group.activity_count),
            totals: values,
            trailers: [
                {
                    label: `${quantity ? 'Stock' : 'Account'} (${groupLabel(name, group)}) Sub Total:`,
                    totals: values
                }
            ]
        };
    });
    return {
        name,
        title: definition.title,
        company: companyDetails(company),
        columns: definition.columns,
        details: detailsFor(name, selection),
        sections,
        metrics: definition.metrics,
        totals: Object.fromEntries(
            definition.metrics.map((key) => [key, numberString(totals[key], quantity)])
        ),
        totalLabel: quantity ? 'Total Movement (PCS):' : 'Period Totals:',
        note: quantity
            ? 'Movement totals show stock in and out during the selected dates. Unit costs retain four decimal places.'
            : 'Totals cover all posted activity within the selected dates. Movement is debit less credit; it is not an opening or closing balance.'
    };
};
const buildSupplierStatement = ({
    records,
    rows,
    suppliers,
    company,
    filters,
    offset = 0,
    pageLength = rows.length
}) => {
    const totals = { Debit: D(0), Credit: D(0), 'Closing Balance': D(0) };
    const byId = new Map(suppliers.map((supplier) => [String(supplier.id), supplier]));
    const groups = new Map();
    for (const [index, record] of records.entries()) {
        const id = String(record.party_id);
        const supplier = byId.get(id) || { id, name: record.company };
        if (!groups.has(id)) groups.set(id, { supplier, indexes: [], count: 0, Debit: D(0), Credit: D(0) });
        const group = groups.get(id);
        group.count++;
        if (index >= offset && index < offset + pageLength) group.indexes.push(index - offset);
        group.Debit = group.Debit.plus(record.debit);
        group.Credit = group.Credit.plus(record.credit);
    }
    const details = (supplier) => [
        ['Supplier Name', supplier ? `${supplier.name} (${supplier.id})` : 'All suppliers'],
        ['Address', supplier?.address || '—'],
        ['Phone', supplier?.phone || '—'],
        ['Balance Basis', 'Credit less debit · Positive balance is payable']
    ];
    const sections = [...groups.entries()]
        .sort((a, b) => a[1].supplier.name.localeCompare(b[1].supplier.name, 'en'))
        .map(([id, group]) => {
            const values = {
                Debit: group.Debit.toFixed(2),
                Credit: group.Credit.toFixed(2),
                'Closing Balance': group.Credit.minus(group.Debit).toFixed(2)
            };
            for (const key of Object.keys(totals)) totals[key] = totals[key].plus(values[key]);
            return {
                id,
                details: details(group.supplier),
                indexes: group.indexes,
                activityCount: group.count,
                trailers: [{ label: `Supplier (${group.supplier.name}) Sub Total:`, totals: values }],
                totals: values
            };
        });
    const selected = filters.supplier_id
        ? byId.get(String(filters.supplier_id))
        : suppliers.length === 1
          ? suppliers[0]
          : null;
    return {
        name: 'supplier-ledger',
        title: 'Supplier Ledger Accounts',
        company: companyDetails(company),
        columns: [
            column('GL Date', 'GL Date', 55, 'date'),
            column('Voucher', 'Voucher', 110, 'voucher'),
            column('Supplier', 'Supplier', 115),
            column('Transaction Type', 'Transaction Type', 90, 'transaction'),
            column('Reference', 'Reference', 130),
            column('Debit', 'Payments / Returns', 95, 'money', 'Debit'),
            column('Credit', 'GRNs / Adjustments', 95, 'money', 'Credit'),
            column('Closing Balance', 'Closing Payable', 100, 'money')
        ],
        details: details(selected),
        sections,
        metrics: ['Debit', 'Credit', 'Closing Balance'],
        totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)])),
        totalLabel: 'Grand Total:',
        note: 'Positive supplier balances represent amounts payable. Opening balances and historical transactions are included in the running balance.'
    };
};
const formatStatementValue = (value, column) => {
    if (value === undefined || value === null || value === '') return '';
    if (column.type === 'date') return formatDate(value);
    if (column.type === 'datetime') return `${formatDate(value)} ${String(value).slice(11, 19)}`;
    if (column.type === 'money') return formatAmount(value);
    if (['quantity', 'cost'].includes(column.type)) {
        const [integer, fraction] = D(value)
            .toFixed(column.type === 'quantity' ? 0 : 4)
            .split('.');
        return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
    }
    if (column.type === 'transaction') return transactionLabel(value).replaceAll('_', ' ');
    return String(value);
};
const headerBands = (columns) => {
    const bands = [];
    for (const [index, col] of columns.entries()) {
        const previous = bands.at(-1);
        if (col.group && previous?.group === col.group) previous.span++;
        else bands.push({ title: col.group || col.title, group: col.group, start: index, span: 1 });
    }
    return bands;
};

module.exports = {
    reportDefinitions,
    buildReportStatement,
    buildSupplierStatement,
    formatStatementValue,
    headerBands
};
