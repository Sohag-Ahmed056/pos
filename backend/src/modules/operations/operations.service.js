const crypto = require('crypto');
const { z } = require('zod');
const { currency, optional } = require('../catalog/catalog.validation');
const db = require('../../config/db');
const { schemas, date: validDate, allocations: allocationSchema } = require('./operations.validation');
const { pagination, id } = require('../catalog/catalog.validation');
const { transaction, audit } = require('../../shared/transaction');
const { D, money, cost, sum, assert, lineAmount, proportional } = require('../../shared/financial');
const { account, journal, lock, due, stock, valuationLines } = require('./accounting.service');
const { returnBases } = require('../../shared/returns');
const definitions = {
    purchases: ['purchases', 'purchase_no', 'purchase_date', 'purchase_items', 'purchase_id', 'PO'],
    sales: ['sales_invoices', 'invoice_no', 'invoice_date', 'sales_invoice_items', 'sales_invoice_id', 'SI'],
    grns: ['goods_receipts', 'grn_no', 'received_date', 'goods_receipt_items', 'goods_receipt_id', 'GRN'],
    receipts: [
        'customer_receipts',
        'voucher_no',
        'receipt_date',
        'customer_receipt_allocations',
        'receipt_id',
        'CR'
    ],
    payments: [
        'supplier_payments',
        'voucher_no',
        'payment_date',
        'supplier_payment_allocations',
        'payment_id',
        'SP'
    ],
    'sales-returns': [
        'sales_returns',
        'return_no',
        'return_date',
        'sales_return_items',
        'sales_return_id',
        'SR'
    ],
    'purchase-returns': [
        'purchase_returns',
        'return_no',
        'return_date',
        'purchase_return_items',
        'purchase_return_id',
        'PR'
    ],
    adjustments: ['stock_adjustments', 'adjustment_no', 'adjustment_date', null, null, 'ADJ'],
    expenses: ['expenses', 'expense_no', 'expense_date', null, null, 'EXP']
};
const def = (kind) => {
    assert(Object.hasOwn(definitions, kind), 'Unknown document type', 404);
    return definitions[kind];
};
const sorted = (rows) =>
    [...rows].sort((a, b) => (BigInt(a.product_id || a.id) < BigInt(b.product_id || b.id) ? -1 : 1));
// Identifiers here come exclusively from service constants and validated schema keys.
const insert = async (tx, table, data) => {
    const fields = Object.keys(data).filter((k) => data[k] !== undefined);
    const [result] = await tx.execute(
        `INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
        fields.map((k) => (typeof data[k] === 'boolean' ? Number(data[k]) : data[k]))
    );
    return String(result.insertId);
};
const list = async (kind, query) => {
    const [table, number, date] = def(kind);
    const p = pagination.parse(query);
    const clauses = [];
    const params = [];
    if (query.from) {
        clauses.push(`${date}>=?`);
        params.push(validDate.parse(query.from));
    }
    if (query.to) {
        clauses.push(`${date}<=?`);
        params.push(validDate.parse(query.to));
    }
    assert(!query.from || !query.to || query.from <= query.to, 'From date must not exceed to date', 400);
    if (p.search) {
        clauses.push(`${number} LIKE ?`);
        params.push(`%${p.search}%`);
    }
    if (query.status) {
        assert(
            ['DRAFT', 'POSTED', 'VOID', 'CONFIRMED', 'CLOSED', 'CANCELLED'].includes(query.status),
            'Invalid status',
            400
        );
        clauses.push('status=?');
        params.push(query.status);
    }
    const field = ['sales', 'receipts'].includes(kind)
        ? 'customer_id'
        : ['purchases', 'payments'].includes(kind)
          ? 'supplier_id'
          : null;
    if (field && query.party_id) {
        clauses.push(`${field}=?`);
        params.push(id.parse(query.party_id));
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const [[data], [[count]]] = await Promise.all([
        db.query(`SELECT * FROM ${table} ${where} ORDER BY ${date} DESC, id DESC LIMIT ? OFFSET ?`, [
            ...params,
            p.limit,
            (p.page - 1) * p.limit
        ]),
        db.execute(`SELECT COUNT(*) total FROM ${table} ${where}`, params)
    ]);
    return {
        data,
        meta: {
            page: p.page,
            limit: p.limit,
            total: Number(count.total),
            pages: Math.ceil(Number(count.total) / p.limit)
        }
    };
};
const get = async (kind, rawId, tx = db) => {
    const [table, , , itemsTable, fk] = def(kind);
    const [[header]] = await tx.execute(`SELECT * FROM ${table} WHERE id=?`, [id.parse(rawId)]);
    assert(header, 'Document not found', 404);
    let items = itemsTable
        ? (await tx.execute(`SELECT * FROM ${itemsTable} WHERE ${fk}=? ORDER BY id`, [String(header.id)]))[0]
        : [];
    if (kind === 'purchases')
        items = (
            await tx.execute(
                `SELECT p.*, COALESCE(r.qty,0) received_pcs, p.quantity_pcs-COALESCE(r.qty,0) remaining_pcs FROM purchase_items p LEFT JOIN (SELECT i.purchase_item_id,SUM(i.quantity_pcs) qty FROM goods_receipt_items i JOIN goods_receipts h ON h.id=i.goods_receipt_id WHERE h.status='POSTED' GROUP BY i.purchase_item_id) r ON r.purchase_item_id=p.id WHERE p.purchase_id=? ORDER BY p.id`,
                [String(header.id)]
            )
        )[0];
    if (kind === 'sales') {
        items = (
            await tx.execute(
                `SELECT p.*, COALESCE(r.qty,0) returned_pcs, p.quantity_pcs-COALESCE(r.qty,0) remaining_pcs FROM sales_invoice_items p LEFT JOIN (SELECT i.sales_invoice_item_id,SUM(i.quantity_pcs) qty FROM sales_return_items i JOIN sales_returns h ON h.id=i.sales_return_id WHERE h.status='POSTED' GROUP BY i.sales_invoice_item_id) r ON r.sales_invoice_item_id=p.id WHERE p.sales_invoice_id=? ORDER BY p.id`,
                [String(header.id)]
            )
        )[0];
        const [[paid]] = await tx.execute(
            "SELECT COALESCE(SUM(a.amount),0) paid FROM customer_receipt_allocations a JOIN customer_receipts r ON r.id=a.receipt_id WHERE a.sales_invoice_id=? AND r.status='POSTED'",
            [String(header.id)]
        );
        header.allocated_payments = paid.paid;
        const [[snapshot]] = await tx.execute(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(details,'$.amount')) amount FROM audit_logs WHERE entity_type='sales_invoices' AND entity_id=? AND action_code='SALE_RECEIPT' LIMIT 1",
            [String(header.id)]
        );
        header.today_payment_snapshot = snapshot?.amount || '0.00';
        header.closing_due_snapshot = money(
            D(header.previous_due_snapshot).plus(header.total_amount).minus(header.today_payment_snapshot)
        ).toFixed(2);
        const [[returned]] = await tx.execute(
            "SELECT COALESCE(SUM(total_amount),0) amount FROM sales_returns WHERE sales_invoice_id=? AND status='POSTED'",
            [String(header.id)]
        );
        header.returned_amount = returned.amount;
        header.invoice_outstanding = money(
            D(header.total_amount).minus(paid.paid).minus(returned.amount)
        ).toFixed(2);
    }
    if (kind === 'grns')
        items = (
            await tx.execute(
                `SELECT g.*,p.product_id,p.product_name_snapshot,p.sku_snapshot,COALESCE(r.qty,0) returned_pcs,g.quantity_pcs-COALESCE(r.qty,0) remaining_pcs FROM goods_receipt_items g JOIN purchase_items p ON p.id=g.purchase_item_id LEFT JOIN (SELECT i.goods_receipt_item_id,SUM(i.quantity_pcs) qty FROM purchase_return_items i JOIN purchase_returns h ON h.id=i.purchase_return_id WHERE h.status='POSTED' GROUP BY i.goods_receipt_item_id) r ON r.goods_receipt_item_id=g.id WHERE g.goods_receipt_id=? ORDER BY g.id`,
                [String(header.id)]
            )
        )[0];
    if (kind === 'purchases') {
        items = items.map((row) => ({ ...row, line_amount: lineAmount(row).toFixed(2) }));
        header.subtotal_amount = sum(
            items.map((row) => money(D(row.quantity_pcs).times(row.unit_cost)))
        ).toFixed(2);
        header.discount_amount = sum(items.map((row) => row.discount_amount)).toFixed(2);
        header.total_amount = sum(items.map((row) => row.line_amount)).toFixed(2);
        header.ordered_pcs = items.reduce((total, row) => total + Number(row.quantity_pcs), 0);
        header.received_pcs = items.reduce((total, row) => total + Number(row.received_pcs), 0);
        header.remaining_pcs = header.ordered_pcs - header.received_pcs;
    }
    if (kind === 'sales' || kind === 'grns')
        items = returnBases(items, kind === 'sales', header.discount_amount);
    return { ...header, items };
};
const save = async (kind, rawId, payload, user, key) => {
    const [table, number, , itemsTable, fk, prefix] = def(kind);
    const input = schemas[kind].parse(payload);
    return transaction(user, `${kind}.save`, key, { id: rawId || null, ...payload }, async (tx) => {
        let recordId = rawId ? id.parse(rawId) : null;
        if (recordId) {
            const [[existing]] = await tx.execute(`SELECT status FROM ${table} WHERE id=? FOR UPDATE`, [
                recordId
            ]);
            assert(existing, 'Document not found', 404);
            assert(existing.status === 'DRAFT', 'Only drafts can be edited', 409);
        }
        const { items, allocations, ...header } = input;
        let lines = items || [];
        if (kind === 'sales' || kind === 'purchases') {
            const ids = lines.map((l) => l.product_id);
            const [products] = await tx.query('SELECT * FROM products WHERE id IN (?)', [ids]);
            const map = new Map(products.map((p) => [String(p.id), p]));
            lines = lines.map((l) => {
                const p = map.get(l.product_id);
                assert(p?.is_active, `Product ${l.product_id} is missing or inactive`);
                assert(
                    D(l.discount_amount).lte(money(D(l.quantity_pcs).times(l.unit_price ?? l.unit_cost))),
                    'Line discount exceeds value'
                );
                return { ...l, product_name_snapshot: p.name, sku_snapshot: p.sku };
            });
            if (kind === 'sales') {
                header.subtotal_amount = sum(
                    lines.map((l) => money(D(l.quantity_pcs).times(l.unit_price)))
                ).toFixed(2);
                const net = sum(lines.map(lineAmount));
                assert(D(header.discount_amount).lte(net), 'Invoice discount exceeds subtotal');
                header.total_amount = net.minus(header.discount_amount).toFixed(2);
            }
        }
        if (['receipts', 'payments', 'expenses'].includes(kind))
            assert(money(header.amount).gt(0), 'Amount must be greater than zero');
        if (kind === 'grns') lines = lines.map((l) => ({ ...l, line_amount: '0.00' }));
        if (kind === 'sales-returns') lines = lines.map((l) => ({ ...l, return_unit_price: '0.0000' }));
        if (kind === 'purchase-returns') lines = lines.map((l) => ({ ...l, return_unit_cost: '0.0000' }));
        if (recordId) {
            const fields = Object.keys(header);
            await tx.execute(`UPDATE ${table} SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`, [
                ...fields.map((f) => header[f] ?? null),
                recordId
            ]);
            if (itemsTable) await tx.execute(`DELETE FROM ${itemsTable} WHERE ${fk}=?`, [recordId]);
        } else
            recordId = await insert(tx, table, {
                ...header,
                [number]: `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
            });
        for (const line of lines) await insert(tx, itemsTable, { ...line, [fk]: recordId });
        if (allocations)
            for (const a of allocations) {
                assert(money(a.amount).gt(0), 'Allocation must be positive');
                await insert(tx, itemsTable, {
                    [fk]: recordId,
                    [kind === 'receipts' ? 'sales_invoice_id' : 'goods_receipt_id']: a.document_id,
                    amount: money(a.amount).toFixed(2)
                });
            }
        return { id: recordId };
    });
};
const activePayment = async (tx, id) => {
    const [[row]] = await tx.execute(
        'SELECT p.*, a.code FROM payment_accounts p JOIN chart_of_accounts a ON a.id=p.gl_account_id WHERE p.id=? FOR UPDATE',
        [String(id)]
    );
    assert(
        row?.is_active && !['AR', 'INVENTORY'].includes(row.code),
        'Payment account is missing, inactive, or invalid'
    );
    return row;
};
const allocate = async (tx, kind, header, rows, existing = false) => {
    const customer = kind === 'receipts';
    const partyField = customer ? 'customer_id' : 'supplier_id';
    const allocationTable = customer ? 'customer_receipt_allocations' : 'supplier_payment_allocations';
    const headerTable = customer ? 'customer_receipts' : 'supplier_payments';
    const paymentFk = customer ? 'receipt_id' : 'payment_id';
    const targetFk = customer ? 'sales_invoice_id' : 'goods_receipt_id';
    const [[allocated]] = await tx.execute(
        `SELECT COALESCE(SUM(amount),0) amount FROM ${allocationTable} WHERE ${paymentFk}=?`,
        [String(header.id)]
    );
    let available = money(header.amount).minus(existing ? allocated.amount : 0);
    assert(sum(rows.map((r) => r.amount)).lte(available), 'Allocations exceed payment amount');
    for (const row of [...rows].sort((a, b) => (BigInt(a[targetFk]) < BigInt(b[targetFk]) ? -1 : 1))) {
        assert(money(row.amount).gt(0), 'Allocation amount must be positive');
        let target;
        let total;
        let returned;
        if (customer) {
            target = await lock(tx, 'sales_invoices', row.sales_invoice_id);
            total = money(target.total_amount);
            const [[r]] = await tx.execute(
                "SELECT COALESCE(SUM(total_amount),0) amount FROM sales_returns WHERE sales_invoice_id=? AND status='POSTED'",
                [String(target.id)]
            );
            returned = money(r.amount);
        } else {
            target = await lock(tx, 'goods_receipts', row.goods_receipt_id);
            const [[purchase]] = await tx.execute('SELECT supplier_id FROM purchases WHERE id=?', [
                String(target.purchase_id)
            ]);
            target.supplier_id = purchase.supplier_id;
            const [[t]] = await tx.execute(
                'SELECT COALESCE(SUM(line_amount),0) amount FROM goods_receipt_items WHERE goods_receipt_id=?',
                [String(target.id)]
            );
            total = money(t.amount);
            const [[r]] = await tx.execute(
                "SELECT COALESCE(SUM(total_amount),0) amount FROM purchase_returns WHERE goods_receipt_id=? AND status='POSTED'",
                [String(target.id)]
            );
            returned = money(r.amount);
        }
        assert(
            target.status === 'POSTED' && String(target[partyField]) === String(header[partyField]),
            'Allocation target must be posted and belong to this party'
        );
        const [[paid]] = await tx.execute(
            `SELECT COALESCE(SUM(a.amount),0) amount FROM ${allocationTable} a JOIN ${headerTable} p ON p.id=a.${paymentFk} WHERE a.${targetFk}=? AND p.status='POSTED'`,
            [String(target.id)]
        );
        assert(
            money(row.amount).lte(total.minus(returned).minus(paid.amount)),
            'Allocation exceeds document outstanding balance'
        );
        if (existing)
            await tx.execute(
                `INSERT INTO ${allocationTable} (${paymentFk}, ${targetFk}, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount=amount+?`,
                [
                    String(header.id),
                    String(target.id),
                    money(row.amount).toFixed(2),
                    money(row.amount).toFixed(2)
                ]
            );
    }
};
const post = async (kind, rawId, payload, user, key) => {
    const [table, number, date] = def(kind);
    const recordId = id.parse(rawId);
    const postInput = (
        kind === 'sales'
            ? z
                  .object({
                      payment: z
                          .object({ amount: currency, payment_account_id: id, reference_no: optional(80) })
                          .strict()
                          .optional()
                  })
                  .strict()
            : z.object({}).strict()
    ).parse(payload);
    return transaction(user, `${kind}.post`, key, { id: recordId, ...payload }, async (tx) => {
        const [[header]] = await tx.execute(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [recordId]);
        assert(header, 'Document not found', 404);
        if (
            header.status === 'POSTED' ||
            (kind === 'purchases' && ['CONFIRMED', 'CLOSED'].includes(header.status))
        )
            return { id: recordId, already_posted: true };
        assert(header.status === 'DRAFT', 'Only drafts can be posted', 409);
        if (kind === 'purchases') {
            const [[count]] = await tx.execute('SELECT COUNT(*) n FROM purchase_items WHERE purchase_id=?', [
                recordId
            ]);
            assert(Number(count.n), 'Purchase has no items');
            await tx.execute("UPDATE purchases SET status='CONFIRMED' WHERE id=?", [recordId]);
            return { id: recordId };
        }
        const document = await get(kind, recordId, tx);
        const j = {
            voucher_no: header[number],
            gl_date: header[date],
            source_type: kind.toUpperCase().replaceAll('-', '_'),
            source_id: recordId
        };
        if (kind === 'grns') await postGrn(tx, document, j);
        if (kind === 'sales') await postSale(tx, document, j, postInput.payment, user);
        if (['receipts', 'payments'].includes(kind)) await postPayment(tx, kind, document, j);
        if (['sales-returns', 'purchase-returns'].includes(kind))
            await postReturn(tx, kind, document, j, user);
        if (kind === 'adjustments') await postAdjustment(tx, document, j);
        if (kind === 'expenses') {
            const payment = await activePayment(tx, header.payment_account_id);
            await journal(tx, j, [
                { code: 'EXPENSE', debit: header.amount },
                { account_id: payment.gl_account_id, credit: header.amount }
            ]);
        }
        await tx.execute(
            `UPDATE ${table} SET status='POSTED'${kind === 'expenses' ? '' : ', posted_at=NOW(6)'} WHERE id=?`,
            [recordId]
        );
        return { id: recordId };
    });
};
const postGrn = async (tx, h, j) => {
    const purchase = await lock(tx, 'purchases', h.purchase_id);
    assert(['CONFIRMED', 'CLOSED'].includes(purchase.status), 'Confirm the purchase before receiving');
    await lock(tx, 'suppliers', purchase.supplier_id);
    const [original] = await tx.execute('SELECT * FROM purchase_items WHERE purchase_id=?', [
        String(purchase.id)
    ]);
    const map = new Map(original.map((r) => [String(r.id), r]));
    const rows = h.items.map((l) => {
        const p = map.get(String(l.purchase_item_id));
        assert(p, 'Receipt item does not belong to this purchase');
        return { ...l, original: p, product_id: p.product_id };
    });
    assert(rows.length, 'Receipt has no items');
    let total = D(0);
    let book = D(0);
    for (const row of sorted(rows)) {
        const p = row.original;
        const [[received]] = await tx.execute(
            "SELECT COALESCE(SUM(i.quantity_pcs),0) qty FROM goods_receipt_items i JOIN goods_receipts g ON g.id=i.goods_receipt_id WHERE i.purchase_item_id=? AND g.status='POSTED'",
            [String(p.id)]
        );
        assert(
            Number(received.qty) + row.quantity_pcs <= p.quantity_pcs,
            'Cannot receive more than the remaining purchase quantity',
            409
        );
        const amount = proportional(lineAmount(p), p.quantity_pcs, received.qty, row.quantity_pcs);
        const movement = await stock(tx, {
            product_id: p.product_id,
            warehouse_id: purchase.warehouse_id,
            delta: row.quantity_pcs,
            incomingCost: cost(amount.div(row.quantity_pcs)),
            type: 'GRN',
            source: 'GRN',
            line: row.id
        });
        await tx.execute('UPDATE goods_receipt_items SET line_amount=? WHERE id=?', [
            amount.toFixed(2),
            String(row.id)
        ]);
        total = total.plus(amount);
        book = book.plus(movement.value);
    }
    await journal(tx, { ...j, reference_no: purchase.supplier_invoice_no }, [
        { code: 'INVENTORY', debit: book },
        { code: 'AP', credit: total, supplier_id: purchase.supplier_id },
        ...valuationLines(book, total)
    ]);
    const [[remaining]] = await tx.execute(
        "SELECT COUNT(*) n FROM purchase_items p WHERE p.purchase_id=? AND p.quantity_pcs > COALESCE((SELECT SUM(i.quantity_pcs) FROM goods_receipt_items i JOIN goods_receipts g ON g.id=i.goods_receipt_id WHERE i.purchase_item_id=p.id AND (g.status='POSTED' OR g.id=?)),0)",
        [String(purchase.id), String(h.id)]
    );
    if (!Number(remaining.n))
        await tx.execute("UPDATE purchases SET status='CLOSED' WHERE id=?", [String(purchase.id)]);
};
const postSale = async (tx, h, j, paymentInput, user) => {
    const customer = await lock(tx, 'customers', h.customer_id);
    const previous = await due(tx, 'customer', h.customer_id);
    assert(h.items.length, 'Invoice has no items');
    let cogs = D(0);
    for (const row of sorted(h.items)) {
        const movement = await stock(tx, {
            product_id: row.product_id,
            warehouse_id: h.warehouse_id,
            delta: -row.quantity_pcs,
            type: 'SALE',
            source: 'SALE',
            line: row.id
        });
        cogs = cogs.plus(movement.value);
    }
    await tx.execute('UPDATE sales_invoices SET previous_due_snapshot=? WHERE id=?', [
        previous.toFixed(2),
        String(h.id)
    ]);
    await journal(
        tx,
        j,
        [
            { code: 'AR', debit: h.total_amount, customer_id: h.customer_id },
            { code: 'SALES', credit: h.total_amount },
            { code: 'COGS', debit: cogs },
            { code: 'INVENTORY', credit: cogs }
        ],
        customer
    );
    if (paymentInput && money(paymentInput.amount).gt(0)) {
        const voucher = `CR-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
        const receiptId = await insert(tx, 'customer_receipts', {
            voucher_no: voucher,
            customer_id: h.customer_id,
            payment_account_id: paymentInput.payment_account_id,
            receipt_date: h.invoice_date,
            amount: money(paymentInput.amount).toFixed(2),
            reference_no: paymentInput.reference_no || null
        });
        const amount = D.min(h.total_amount, money(paymentInput.amount));
        const allocations = amount.gt(0) ? [{ sales_invoice_id: h.id, amount: amount.toFixed(2) }] : [];
        // The invoice is made eligible for allocation inside this same uncommitted transaction.
        await tx.execute("UPDATE sales_invoices SET status='POSTED' WHERE id=?", [String(h.id)]);
        for (const a of allocations)
            await insert(tx, 'customer_receipt_allocations', { receipt_id: receiptId, ...a });
        const receipt = {
            id: receiptId,
            customer_id: h.customer_id,
            payment_account_id: paymentInput.payment_account_id,
            amount: money(paymentInput.amount).toFixed(2),
            reference_no: paymentInput.reference_no,
            items: allocations
        };
        await postPayment(tx, 'receipts', receipt, {
            voucher_no: voucher,
            gl_date: h.invoice_date,
            source_type: 'RECEIPTS',
            source_id: receiptId
        });
        await tx.execute("UPDATE customer_receipts SET status='POSTED', posted_at=NOW(6) WHERE id=?", [
            receiptId
        ]);
        await audit(tx, user, 'SALE_RECEIPT', 'sales_invoices', h.id, {
            receipt_id: receiptId,
            amount: money(paymentInput.amount).toFixed(2)
        });
    }
};
const postPayment = async (tx, kind, h, j) => {
    const customer = kind === 'receipts';
    const field = customer ? 'customer_id' : 'supplier_id';
    const party = await lock(tx, customer ? 'customers' : 'suppliers', h[field]);
    const payment = await activePayment(tx, h.payment_account_id);
    if (!customer)
        assert(
            money(h.amount).lte(await due(tx, 'supplier', h.supplier_id)),
            'Payment exceeds supplier payable balance'
        );
    await allocate(tx, kind, h, h.items);
    await journal(
        tx,
        { ...j, reference_no: h.reference_no },
        customer
            ? [
                  { account_id: payment.gl_account_id, debit: h.amount },
                  { code: 'AR', credit: h.amount, customer_id: h.customer_id }
              ]
            : [
                  { code: 'AP', debit: h.amount, supplier_id: h.supplier_id },
                  { account_id: payment.gl_account_id, credit: h.amount }
              ],
        customer ? party : null
    );
};
const postAdjustment = async (tx, h, j) => {
    await lock(tx, 'products', h.product_id);
    const increase = h.adjustment_type !== 'DECREASE';
    const movement = await stock(tx, {
        product_id: h.product_id,
        warehouse_id: h.warehouse_id,
        delta: increase ? h.quantity_pcs : -h.quantity_pcs,
        incomingCost: h.unit_cost,
        type: h.adjustment_type === 'OPENING' ? 'OPENING' : increase ? 'ADJUST_IN' : 'ADJUST_OUT',
        source: 'ADJUSTMENT',
        line: h.id
    });
    await journal(
        tx,
        j,
        increase
            ? [
                  { code: 'INVENTORY', debit: movement.value },
                  {
                      code: h.adjustment_type === 'OPENING' ? 'OPENING_EQUITY' : 'STOCK_GAIN',
                      credit: movement.value
                  }
              ]
            : [
                  { code: 'STOCK_LOSS', debit: movement.value },
                  { code: 'INVENTORY', credit: movement.value }
              ]
    );
};
const postReturn = async (tx, kind, h, j, user) => {
    const sale = kind === 'sales-returns';
    const source = await lock(
        tx,
        sale ? 'sales_invoices' : 'goods_receipts',
        sale ? h.sales_invoice_id : h.goods_receipt_id
    );
    assert(source.status === 'POSTED', 'Returns require an original posted document');
    let warehouse = source.warehouse_id;
    let partyId = source.customer_id;
    if (!sale) {
        const purchase = await lock(tx, 'purchases', source.purchase_id);
        warehouse = purchase.warehouse_id;
        partyId = purchase.supplier_id;
    }
    const party = await lock(tx, sale ? 'customers' : 'suppliers', partyId);
    let original;
    if (sale)
        original = (
            await tx.execute('SELECT * FROM sales_invoice_items WHERE sales_invoice_id=? ORDER BY id', [
                String(source.id)
            ])
        )[0];
    else
        original = (
            await tx.execute(
                'SELECT g.*, p.product_id FROM goods_receipt_items g JOIN purchase_items p ON p.id=g.purchase_item_id WHERE g.goods_receipt_id=? ORDER BY g.id',
                [String(source.id)]
            )
        )[0];
    original = returnBases(original, sale, source.discount_amount);
    const map = new Map(original.map((r) => [String(r.id), r]));
    const fk = sale ? 'sales_invoice_item_id' : 'goods_receipt_item_id';
    const itemTable = sale ? 'sales_return_items' : 'purchase_return_items';
    const headerTable = sale ? 'sales_returns' : 'purchase_returns';
    const returnFk = sale ? 'sales_return_id' : 'purchase_return_id';
    const rows = h.items.map((row) => {
        const p = map.get(String(row[fk]));
        assert(p, 'Return line does not belong to the original document');
        return { ...row, product_id: p.product_id, original: p };
    });
    assert(rows.length, 'Return has no items');
    let total = D(0);
    let book = D(0);
    for (const row of sorted(rows)) {
        const p = row.original;
        const [[r]] = await tx.execute(
            `SELECT COALESCE(SUM(i.quantity_pcs),0) qty FROM ${itemTable} i JOIN ${headerTable} h ON h.id=i.${returnFk} WHERE i.${fk}=? AND h.status='POSTED'`,
            [String(p.id)]
        );
        assert(
            Number(r.qty) + row.quantity_pcs <= p.quantity_pcs,
            'Return exceeds remaining eligible quantity',
            409
        );
        const amount = proportional(p.return_basis_amount, p.quantity_pcs, r.qty, row.quantity_pcs);
        total = total.plus(amount);
        let unitCost = cost(amount.div(row.quantity_pcs));
        if (sale) {
            const [[movement]] = await tx.execute(
                "SELECT unit_cost FROM stock_movements WHERE source_type='SALE' AND source_line_id=? AND movement_type='SALE'",
                [String(p.id)]
            );
            assert(movement, 'Original sale stock movement is missing');
            unitCost = cost(movement.unit_cost);
        }
        if (!sale || row.saleable) {
            const movement = await stock(tx, {
                product_id: p.product_id,
                warehouse_id: warehouse,
                delta: sale ? row.quantity_pcs : -row.quantity_pcs,
                incomingCost: unitCost,
                type: sale ? 'SALE_RETURN' : 'PURCHASE_RETURN',
                source: sale ? 'SALE_RETURN' : 'PURCHASE_RETURN',
                line: row.id
            });
            book = book.plus(movement.value);
        }
        await tx.execute(
            `UPDATE ${itemTable} SET ${sale ? 'return_unit_price' : 'return_unit_cost'}=? WHERE id=?`,
            [cost(amount.div(row.quantity_pcs)).toFixed(4), String(row.id)]
        );
    }
    // Release allocations made excessive by the return. Cash remains as an unallocated advance/payment.
    const allocationTable = sale ? 'customer_receipt_allocations' : 'supplier_payment_allocations';
    const [[priorReturns]] = await tx.execute(
        `SELECT COALESCE(SUM(total_amount),0) amount FROM ${headerTable} WHERE ${sale ? 'sales_invoice_id' : 'goods_receipt_id'}=? AND status='POSTED'`,
        [String(source.id)]
    );
    const originalTotal = sale ? money(source.total_amount) : sum(original.map((r) => r.line_amount));
    const maxAllocated = originalTotal.minus(priorReturns.amount).minus(total);
    const [allocs] = await tx.execute(
        `SELECT a.id, a.amount FROM ${allocationTable} a JOIN ${sale ? 'customer_receipts' : 'supplier_payments'} p ON p.id=a.${sale ? 'receipt_id' : 'payment_id'} WHERE a.${sale ? 'sales_invoice_id' : 'goods_receipt_id'}=? AND p.status='POSTED' ORDER BY a.id DESC FOR UPDATE`,
        [String(source.id)]
    );
    let excess = sum(allocs.map((a) => a.amount)).minus(maxAllocated);
    for (const a of allocs) {
        if (excess.lte(0)) break;
        const release = D.min(excess, a.amount);
        const remaining = money(a.amount).minus(release);
        await audit(tx, user, 'RELEASE_RETURN_ALLOCATION', allocationTable, a.id, {
            return_id: String(h.id),
            released_amount: release.toFixed(2),
            remaining_amount: remaining.toFixed(2)
        });
        if (remaining.eq(0)) await tx.execute(`DELETE FROM ${allocationTable} WHERE id=?`, [String(a.id)]);
        else
            await tx.execute(`UPDATE ${allocationTable} SET amount=? WHERE id=?`, [
                remaining.toFixed(2),
                String(a.id)
            ]);
        excess = excess.minus(release);
    }
    await tx.execute(`UPDATE ${headerTable} SET total_amount=? WHERE id=?`, [total.toFixed(2), String(h.id)]);
    await journal(
        tx,
        j,
        sale
            ? [
                  { code: 'SALES_RETURN', debit: total },
                  { code: 'AR', credit: total, customer_id: partyId },
                  { code: 'INVENTORY', debit: book },
                  { code: 'COGS', credit: book }
              ]
            : [
                  { code: 'AP', debit: total, supplier_id: partyId },
                  { code: 'INVENTORY', credit: book },
                  ...valuationLines(book, total).map((l) => ({
                      code: l.code === 'STOCK_LOSS' ? 'STOCK_GAIN' : 'STOCK_LOSS',
                      debit: l.credit,
                      credit: l.debit
                  }))
              ],
        sale ? party : null
    );
};
const addAllocations = async (kind, rawId, payload, user, key) => {
    assert(['receipts', 'payments'].includes(kind), 'Only payments can be allocated');
    const rows = allocationSchema.parse(payload.allocations);
    assert(rows.length, 'At least one allocation is required');
    return transaction(user, `${kind}.allocate`, key, { id: rawId, ...payload }, async (tx) => {
        const [table] = def(kind);
        const [[h]] = await tx.execute(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [id.parse(rawId)]);
        assert(h?.status === 'POSTED', 'Only posted payments may be allocated');
        await lock(
            tx,
            kind === 'receipts' ? 'customers' : 'suppliers',
            h[kind === 'receipts' ? 'customer_id' : 'supplier_id']
        );
        await allocate(
            tx,
            kind,
            h,
            rows.map((r) => ({
                [kind === 'receipts' ? 'sales_invoice_id' : 'goods_receipt_id']: r.document_id,
                amount: r.amount
            })),
            true
        );
        return { id: String(h.id) };
    });
};
const pendingPurchases = async (query) => {
    const p = pagination.parse(query);
    const params = [];
    let where = "p.status='CONFIRMED'";
    if (p.search) {
        where += ' AND (p.purchase_no LIKE ? OR s.name LIKE ? OR p.supplier_invoice_no LIKE ?)';
        params.push(...Array(3).fill(`%${p.search}%`));
    }
    const sql = `SELECT p.id,p.purchase_no,p.purchase_date,p.supplier_invoice_no,s.name supplier,w.name warehouse,
      SUM(i.quantity_pcs-COALESCE(r.received,0)) remaining_pcs,
      SUM(ROUND(i.quantity_pcs*i.unit_cost,2)-i.discount_amount-COALESCE(r.amount,0)) remaining_amount
      FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN warehouses w ON w.id=p.warehouse_id
      JOIN purchase_items i ON i.purchase_id=p.id LEFT JOIN
      (SELECT g.purchase_item_id,SUM(g.quantity_pcs) received,SUM(g.line_amount) amount FROM goods_receipt_items g JOIN goods_receipts h ON h.id=g.goods_receipt_id WHERE h.status='POSTED' GROUP BY g.purchase_item_id) r ON r.purchase_item_id=i.id
      WHERE ${where} GROUP BY p.id,s.name,w.name HAVING remaining_pcs>0`;
    const [[data], [[count]]] = await Promise.all([
        db.query(`${sql} ORDER BY p.purchase_date,p.id LIMIT ? OFFSET ?`, [
            ...params,
            p.limit,
            (p.page - 1) * p.limit
        ]),
        db.execute(`SELECT COUNT(*) total FROM (${sql}) pending`, params)
    ]);
    return {
        data,
        meta: {
            page: p.page,
            limit: p.limit,
            total: Number(count.total),
            pages: Math.ceil(Number(count.total) / p.limit)
        }
    };
};
module.exports = { definitions, list, get, save, post, addAllocations, pendingPurchases };
