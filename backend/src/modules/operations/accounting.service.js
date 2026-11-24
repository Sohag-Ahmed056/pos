const { D, money, cost, assert, balanced } = require('../../shared/financial');
const account = async (tx, code) => {
    const [[row]] = await tx.execute('SELECT id FROM chart_of_accounts WHERE code=?', [code]);
    assert(row, `Missing chart of accounts code: ${code}`);
    return String(row.id);
};
const journal = async (tx, header, lines, customer) => {
    const valid = balanced(lines);
    if (!valid.length) return;
    const [result] = await tx.execute(
        'INSERT INTO journal_entries (voucher_no, gl_date, source_type, source_id, reference_no, party_snapshot, area_snapshot, sales_channel_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
            header.voucher_no,
            header.gl_date,
            header.source_type,
            String(header.source_id),
            header.reference_no || null,
            customer?.party_name || null,
            customer?.area_name || null,
            customer?.sales_channel || null
        ]
    );
    for (const line of valid)
        await tx.execute(
            'INSERT INTO journal_lines (journal_entry_id, account_id, customer_id, supplier_id, debit, credit) VALUES (?, ?, ?, ?, ?, ?)',
            [
                String(result.insertId),
                line.account_id || (await account(tx, line.code)),
                line.customer_id || null,
                line.supplier_id || null,
                money(line.debit).toFixed(2),
                money(line.credit).toFixed(2)
            ]
        );
};
const lock = async (tx, table, id) => {
    assert(
        [
            'customers',
            'suppliers',
            'purchases',
            'sales_invoices',
            'goods_receipts',
            'products',
            'warehouses'
        ].includes(table),
        'Invalid lock target'
    );
    const [[row]] = await tx.execute(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [String(id)]);
    assert(row, 'Referenced record not found', 404);
    return row;
};
const due = async (tx, party, id) => {
    const field = party === 'customer' ? 'customer_id' : 'supplier_id';
    const [[totals]] = await tx.execute(
        `SELECT COALESCE(SUM(debit),0) debit, COALESCE(SUM(credit),0) credit FROM journal_lines WHERE ${field}=? AND account_id=?`,
        [String(id), await account(tx, party === 'customer' ? 'AR' : 'AP')]
    );
    return party === 'customer'
        ? money(D(totals.debit).minus(totals.credit))
        : money(D(totals.credit).minus(totals.debit));
};
const stock = async (tx, { product_id, warehouse_id, delta, incomingCost, type, source, line }) => {
    await tx.execute(
        'INSERT INTO inventory_balances (product_id, warehouse_id, on_hand_pcs, avg_cost) VALUES (?, ?, 0, 0) ON DUPLICATE KEY UPDATE product_id=product_id',
        [String(product_id), String(warehouse_id)]
    );
    const [[balance]] = await tx.execute(
        'SELECT * FROM inventory_balances WHERE product_id=? AND warehouse_id=? FOR UPDATE',
        [String(product_id), String(warehouse_id)]
    );
    const nextQuantity = Number(balance.on_hand_pcs) + delta;
    assert(nextQuantity >= 0, `Insufficient stock for product ${product_id}`, 409);
    assert(nextQuantity <= 2147483647, 'Stock quantity exceeds supported PCS limit');
    const beforeValue = money(D(balance.avg_cost).times(balance.on_hand_pcs));
    const movementCost = delta > 0 ? cost(incomingCost) : cost(balance.avg_cost);
    const nextCost =
        delta > 0
            ? cost(
                  D(balance.avg_cost)
                      .times(balance.on_hand_pcs)
                      .plus(movementCost.times(delta))
                      .div(nextQuantity)
              )
            : cost(balance.avg_cost);
    const bookDelta = money(nextCost.times(nextQuantity)).minus(beforeValue);
    await tx.execute(
        'UPDATE inventory_balances SET on_hand_pcs=?, avg_cost=? WHERE product_id=? AND warehouse_id=?',
        [nextQuantity, nextCost.toFixed(4), String(product_id), String(warehouse_id)]
    );
    await tx.execute(
        'INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity_delta_pcs, unit_cost, source_type, source_line_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [String(product_id), String(warehouse_id), type, delta, movementCost.toFixed(4), source, String(line)]
    );
    return { unitCost: movementCost, value: bookDelta.abs(), bookDelta };
};
const valuationLines = (book, nominal) => {
    const diff = money(D(nominal).minus(book));
    return diff.gt(0)
        ? [{ code: 'STOCK_LOSS', debit: diff }]
        : diff.lt(0)
          ? [{ code: 'STOCK_GAIN', credit: diff.abs() }]
          : [];
};
module.exports = { account, journal, lock, due, stock, valuationLines };
