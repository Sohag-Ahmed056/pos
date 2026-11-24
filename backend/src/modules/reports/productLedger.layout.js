const column = (key, title, width = 80, type = 'text') => ({ key, title, width, type });
const productColumns = [column('product', 'Product', 125), column('sku', 'SKU', 85)];
const quantity = (key, title) => column(key, `${title} (PCS)`, 65, 'quantity');
const amount = (key, title) => column(key, `${title} (BDT)`, 85, 'money');
const partyColumns = (sale) => [
    column('date', 'Date', 65, 'date'),
    column('voucher', sale ? 'Invoice / Return' : 'PO / GRN / Return', 100, 'voucher'),
    column('type', 'Type', 80, 'transaction'),
    column('party', sale ? 'Customer' : 'Supplier', 100),
    ...productColumns,
    ...(sale
        ? [quantity('sold', 'Sold')]
        : [quantity('ordered', 'Ordered'), quantity('received', 'Received')]),
    quantity('returned', 'Returned'),
    quantity('net_quantity', sale ? 'Net Sold' : 'Net Received'),
    column('rate', sale ? 'Original Selling Rate (BDT)' : 'Original Purchase Rate (BDT)', 85, 'cost'),
    ...(!sale ? [column('adjusted_rate', 'Net Unit Cost (BDT)', 85, 'cost')] : []),
    amount('discount', 'Discount / Reversal'),
    amount('gross_amount', 'Gross / Reversal'),
    amount('amount', 'Net Transaction'),
    column('original_voucher', 'Original Reference', 100, 'voucher'),
    ...(sale ? [column('return_condition', 'Return Condition', 90)] : [])
];
const stockColumns = [
    column('occurred_at', 'Posting Time (UTC)', 100, 'datetime'),
    column('voucher', 'Voucher', 100, 'voucher'),
    column('movement_type', 'Movement', 80, 'transaction'),
    column('party', 'Supplier / Customer', 100),
    column('warehouse', 'Warehouse', 90),
    ...productColumns,
    quantity('quantity_in', 'In'),
    quantity('quantity_out', 'Out'),
    column('running_quantity', 'Physical Balance (PCS)', 90, 'quantity'),
    column('unit_cost', 'Historic Stock Cost / PCS (BDT)', 95, 'cost'),
    column('selling_rate', 'Original Sale Rate (BDT)', 85, 'cost'),
    amount('movement_cost', 'Signed Movement Cost'),
    column('reference', 'Reference / Details', 110)
];
const scopeDescription = (filters) =>
    [
        ...['product_id', 'warehouse_id', 'customer_id', 'supplier_id']
            .filter((key) => filters[key])
            .map((key) => `${key.replace('_id', '')} #${filters[key]}`),
        ...(filters.type ? [`Type: ${filters.type}`] : []),
        ...(filters.voucher ? [`Voucher: ${filters.voucher}`] : []),
        ...(filters.search ? [`Search: ${filters.search}`] : [])
    ].join(' · ') || 'All posted activity';
const buildProductStatement = (result, company) => {
    const stock = result.kind === 'stock',
        sale = result.kind === 'customer';
    const title = stock
        ? 'Professional Product Stock Ledger'
        : sale
          ? 'Product-wise Sales Ledger'
          : 'Product-wise Purchase Ledger';
    const columns = stock ? stockColumns : partyColumns(sale);
    const metrics = stock
        ? ['quantity_in', 'quantity_out']
        : [
              sale ? 'sold' : 'ordered',
              ...(!sale ? ['received'] : []),
              'returned',
              'net_quantity',
              'discount',
              'gross_amount',
              'amount'
          ];
    const details = [
        ['Selection', `${result.selection.name} · ${result.selection.sku || `ID ${result.selection.id}`}`],
        ['Report Filters', scopeDescription(result.filters)],
        ['Quantities / Values', 'Whole PCS · BDT · Historical transaction rates']
    ];
    if (result.selection.sku) {
        const product = result.selection;
        details.push([
            'Product Profile',
            `ID ${product.id} · ${product.category || 'Uncategorized'} · Brand ${product.brand || '—'} · Model ${product.model || '—'} · ${Number(product.is_active) ? 'Active' : 'Inactive'} · PCS`
        ]);
        details.push([
            'Current Master Prices (BDT)',
            `Default purchase ${product.default_purchase_price} · Selling ${product.selling_price} · Reorder ${product.reorder_level_pcs} PCS`
        ]);
    }
    if (stock) {
        details.push([
            'Physical Stock (PCS)',
            `Opening ${result.stock.opening} + In ${result.stock.quantity_in} − Out ${result.stock.quantity_out} = Closing ${result.stock.closing}`
        ]);
        details.push([
            'Historical Book Value (BDT)',
            `Opening ${result.stock.opening_value} · Closing ${result.stock.closing_value}`
        ]);
        details.push([
            'Current Stock / Value',
            `${result.stock.current_quantity} PCS · BDT ${result.stock.current_value} · Average cost ${result.stock.current_avg_cost} · ${result.stock.low_stock ? 'Low stock' : 'Stock available'} · Reconciled: ${result.stock.reconciled ? 'Yes' : 'No'}`
        ]);
        for (const row of result.warehouses)
            details.push([
                row.warehouse,
                `Opening ${row.opening} · In ${row.quantity_in} · Out ${row.quantity_out} · Closing ${row.closing} PCS · Closing value BDT ${row.closing_value}`
            ]);
    }
    details.push(['Report Basis', result.note]);
    if (stock) details.push(['Profitability', result.profitability.reason]);
    return {
        name: result.name,
        title,
        company: { name: company?.company_name || 'BatteryPOS', code: company?.company_code || 'POS' },
        columns,
        metrics,
        details,
        sections: [
            {
                id: 'activity',
                details,
                indexes: result.rows.map((row, index) => index),
                activityCount: result.meta.total,
                trailers: []
            }
        ],
        totals: result.totals,
        totalLabel: stock ? 'Visible Movement Totals (PCS):' : 'Filtered Activity Totals:',
        note: result.note
    };
};
module.exports = { buildProductStatement, scopeDescription };
