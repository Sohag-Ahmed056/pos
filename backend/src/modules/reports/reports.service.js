const db = require('../../config/db');
const { z } = require('zod');
const { date } = require('../operations/operations.validation');
const { id } = require('../catalog/catalog.validation');
const { D, money, assert } = require('../../shared/financial');
const { buildCustomerLedgerLayout } = require('./customerLedger.layout');
const {
    reportDefinitions: statementDefinitions,
    buildSupplierStatement,
    buildReportStatement
} = require('./ledgerStatement.layout');
const filters = z
    .object({
        from: date.default('1900-01-01'),
        to: date.default('9999-12-31'),
        customer_id: id.optional(),
        supplier_id: id.optional(),
        product_id: id.optional(),
        warehouse_id: id.optional(),
        payment_account_id: id.optional(),
        account_id: id.optional(),
        expense_name: z.string().trim().max(120).optional(),
        party: z.string().max(160).optional(),
        area: z.string().max(120).optional(),
        channel: z.string().max(120).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(50)
    })
    .refine((f) => f.from <= f.to, 'From date must not exceed to date');
const customerColumns = [
    'GL Date',
    'Voucher',
    'Company',
    'Transaction Type',
    'Reference',
    'Debit — Sales',
    'Debit — Adjustment',
    'Credit — Collection',
    'Credit — Return',
    'Credit — Adjustment',
    'Closing Balance'
];
const supplierColumns = [
    'GL Date',
    'Voucher',
    'Supplier',
    'Transaction Type',
    'Reference',
    'Debit',
    'Credit',
    'Closing Balance'
];
const ledgerRows = (records, supplier) => {
    const summaries = {
        customer: Object.create(null),
        party: Object.create(null),
        area: Object.create(null),
        sales_channel: Object.create(null)
    };
    const totals = { opening: D(0), debit: D(0), credit: D(0), closing: D(0) };
    const rows = records.map((r) => {
        const opening = r.source_type === 'OPENING_BALANCE';
        const delta = supplier ? D(r.credit).minus(r.debit) : D(r.debit).minus(r.credit);
        if (opening) totals.opening = totals.opening.plus(delta);
        else {
            totals.debit = totals.debit.plus(r.debit);
            totals.credit = totals.credit.plus(r.credit);
        }
        for (const [group, label] of Object.entries({
            customer: `${r.party_id}: ${r.company}`,
            party: r.party_snapshot || 'Unassigned',
            area: r.area_snapshot || 'Unassigned',
            sales_channel: r.sales_channel_snapshot || 'Unassigned'
        })) {
            const subtotal = (summaries[group][label] ||= {
                opening: D(0),
                debit: D(0),
                credit: D(0),
                closing: D(0)
            });
            if (opening) subtotal.opening = subtotal.opening.plus(delta);
            else {
                subtotal.debit = subtotal.debit.plus(r.debit);
                subtotal.credit = subtotal.credit.plus(r.credit);
            }
            subtotal.closing = subtotal.closing.plus(delta);
        }
        const base = {
            'GL Date': r.gl_date,
            Voucher: r.voucher_no,
            [supplier ? 'Supplier' : 'Company']: r.company,
            'Transaction Type': r.source_type,
            Reference: r.reference_no || ''
        };
        if (supplier)
            return {
                ...base,
                Debit: money(r.debit).toFixed(2),
                Credit: money(r.credit).toFixed(2),
                'Closing Balance': money(r.running_balance).toFixed(2)
            };
        const sale = r.source_type === 'SALES';
        const receipt = r.source_type === 'RECEIPTS';
        const returned = r.source_type === 'SALES_RETURNS';
        return {
            ...base,
            'Debit — Sales': sale ? money(r.debit).toFixed(2) : '0.00',
            'Debit — Adjustment': !sale ? money(r.debit).toFixed(2) : '0.00',
            'Credit — Collection': receipt ? money(r.credit).toFixed(2) : '0.00',
            'Credit — Return': returned ? money(r.credit).toFixed(2) : '0.00',
            'Credit — Adjustment': !receipt && !returned ? money(r.credit).toFixed(2) : '0.00',
            'Closing Balance': money(r.running_balance).toFixed(2)
        };
    });
    totals.closing = totals.opening.plus(
        supplier ? totals.credit.minus(totals.debit) : totals.debit.minus(totals.credit)
    );
    const serialize = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, money(v).toFixed(2)]));
    return {
        rows,
        totals: serialize(totals),
        subtotals: Object.fromEntries(
            Object.entries(summaries).map(([kind, groups]) => [
                kind,
                Object.entries(groups).map(([name, values]) => ({ name, ...serialize(values) }))
            ])
        )
    };
};
const ledger = async (type, query, exportAll = false) => {
    const f = filters.parse(query);
    const supplier = type === 'supplier';
    const partyTable = supplier ? 'suppliers' : 'customers';
    const partyField = supplier ? 'supplier_id' : 'customer_id';
    const conditions = ['a.code=?', 'e.gl_date<=?'];
    const params = [supplier ? 'AP' : 'AR', f.to];
    if (f[partyField]) {
        conditions.push(`l.${partyField}=?`);
        params.push(f[partyField]);
    }
    for (const [field, column] of [
        ['party', 'party_snapshot'],
        ['area', 'area_snapshot'],
        ['channel', 'sales_channel_snapshot']
    ])
        if (f[field]) {
            conditions.push(`e.${column}=?`);
            params.push(f[field]);
        }
    const company = supplier ? 'p.name' : "COALESCE(NULLIF(p.shop_name,''), p.name)";
    const sql = `WITH posted AS (
        SELECT e.gl_date, e.id entry_id, MIN(l.id) line_id, e.voucher_no, e.source_type, e.reference_no,
          l.${partyField} party_id, ${company} company, e.party_snapshot, e.area_snapshot, e.sales_channel_snapshot,
          SUM(l.debit) debit, SUM(l.credit) credit
        FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id
        JOIN chart_of_accounts a ON a.id=l.account_id JOIN ${partyTable} p ON p.id=l.${partyField}
        WHERE ${conditions.join(' AND ')} GROUP BY e.id, l.${partyField}, ${company}
    ), opening AS (
        SELECT ? gl_date, 0 entry_id, 0 line_id, 'OPENING' voucher_no, 'OPENING_BALANCE' source_type, NULL reference_no,
          party_id, company, party_snapshot, area_snapshot, sales_channel_snapshot, GREATEST(SUM(debit-credit),0) debit, GREATEST(SUM(credit-debit),0) credit
        FROM posted WHERE gl_date<? GROUP BY party_id, company, party_snapshot, area_snapshot, sales_channel_snapshot
    ), activity AS (
        SELECT * FROM opening UNION ALL SELECT * FROM posted WHERE gl_date>=?
    ) SELECT *, SUM(${supplier ? 'credit-debit' : 'debit-credit'}) OVER (PARTITION BY party_id ORDER BY gl_date, entry_id, line_id, COALESCE(party_snapshot,''), COALESCE(area_snapshot,''), COALESCE(sales_channel_snapshot,'') ROWS UNBOUNDED PRECEDING) running_balance
      FROM activity ORDER BY gl_date, entry_id, line_id, party_id, COALESCE(party_snapshot,''), COALESCE(area_snapshot,''), COALESCE(sales_channel_snapshot,'') LIMIT 50001`;
    const [records] = await db.execute(sql, [...params, f.from, f.from, f.from]);
    assert(
        records.length <= 50000,
        'Narrow the date or party filters to export fewer than 50,000 ledger rows',
        413
    );
    const result = ledgerRows(records, supplier);
    const allRows = result.rows;
    if (!supplier) {
        const customerIds = [
            ...new Set([
                ...(f.customer_id ? [f.customer_id] : []),
                ...records.map((record) => String(record.party_id))
            ])
        ];
        const [[[company]], [customers]] = await Promise.all([
            db.execute('SELECT company_code,company_name FROM company_settings WHERE id=1'),
            customerIds.length
                ? db.execute(
                      `SELECT id,name,shop_name,address,party_name,area_name,sales_channel FROM customers WHERE id IN (${customerIds.map(() => '?').join(',')})`,
                      customerIds
                  )
                : Promise.resolve([[]])
        ]);
        result.layout = buildCustomerLedgerLayout({ records, rows: allRows, customers, company, filters: f });
        for (const row of allRows) row.Company = result.layout.company.code;
        if (!exportAll) {
            // The screen keeps its existing pagination; exports receive all section indexes.
            result.layout.sections = result.layout.sections.map(({ indexes, ...section }) => section);
        }
    } else {
        const supplierIds = [
            ...new Set([
                ...(f.supplier_id ? [f.supplier_id] : []),
                ...records.map((record) => String(record.party_id))
            ])
        ];
        const [[[company]], [suppliers]] = await Promise.all([
            db.execute('SELECT company_code,company_name FROM company_settings WHERE id=1'),
            supplierIds.length
                ? db.execute(
                      `SELECT id,name,address,phone FROM suppliers WHERE id IN (${supplierIds.map(() => '?').join(',')})`,
                      supplierIds
                  )
                : Promise.resolve([[]])
        ]);
        result.statement = buildSupplierStatement({
            records,
            rows: allRows,
            suppliers,
            company,
            filters: f,
            offset: exportAll ? 0 : (f.page - 1) * f.limit,
            pageLength: exportAll ? allRows.length : f.limit
        });
    }
    result.rows = exportAll ? allRows : allRows.slice((f.page - 1) * f.limit, f.page * f.limit);
    return {
        columns: supplier ? supplierColumns : customerColumns,
        ...result,
        period: { from: f.from, to: f.to },
        meta: {
            page: f.page,
            limit: f.limit,
            total: allRows.length,
            pages: Math.ceil(allRows.length / f.limit)
        }
    };
};
const reportQueries = {
    sales: `SELECT invoice_date date, COUNT(*) invoices, SUM(total_amount) sales FROM sales_invoices WHERE status='POSTED' AND invoice_date BETWEEN ? AND ? GROUP BY invoice_date ORDER BY invoice_date DESC`,
    'monthly-sales': `SELECT DATE_FORMAT(invoice_date,'%Y-%m') month, COUNT(*) invoices, SUM(total_amount) sales FROM sales_invoices WHERE status='POSTED' AND invoice_date BETWEEN ? AND ? GROUP BY month ORDER BY month DESC`,
    'product-sales': `SELECT i.product_id, i.sku_snapshot sku, i.product_name_snapshot product, SUM(i.quantity_pcs) quantity_pcs, SUM(ROUND(i.quantity_pcs*i.unit_price,2)-i.discount_amount) before_invoice_discount FROM sales_invoice_items i JOIN sales_invoices h ON h.id=i.sales_invoice_id WHERE h.status='POSTED' AND h.invoice_date BETWEEN ? AND ? GROUP BY i.product_id, i.sku_snapshot, i.product_name_snapshot ORDER BY quantity_pcs DESC`,
    purchases: `SELECT p.id,p.purchase_no,p.purchase_date,p.supplier_invoice_no,s.name supplier,p.status,COALESCE(SUM(ROUND(i.quantity_pcs*i.unit_cost,2)-i.discount_amount),0) amount FROM purchases p JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN purchase_items i ON i.purchase_id=p.id WHERE p.purchase_date BETWEEN ? AND ? GROUP BY p.id,s.name ORDER BY p.purchase_date DESC,p.id DESC`,
    'stock-movements': `SELECT m.*,p.name product,p.sku,w.name warehouse FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id WHERE m.occurred_at>=? AND m.occurred_at<=CONCAT(?, ' 23:59:59.999999') ORDER BY m.occurred_at DESC,m.id DESC`,
    collections: `SELECT r.*,c.name customer,p.name payment_account FROM customer_receipts r JOIN customers c ON c.id=r.customer_id JOIN payment_accounts p ON p.id=r.payment_account_id WHERE r.status='POSTED' AND r.receipt_date BETWEEN ? AND ? ORDER BY r.receipt_date DESC,r.id DESC`,
    'supplier-payments': `SELECT r.*,c.name supplier,p.name payment_account FROM supplier_payments r JOIN suppliers c ON c.id=r.supplier_id JOIN payment_accounts p ON p.id=r.payment_account_id WHERE r.status='POSTED' AND r.payment_date BETWEEN ? AND ? ORDER BY r.payment_date DESC,r.id DESC`,
    'cash-bank': `SELECT e.gl_date,e.voucher_no,e.source_type,e.reference_no,p.id payment_account_id,p.name payment_account,l.debit,l.credit FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id JOIN payment_accounts p ON p.gl_account_id=l.account_id WHERE e.gl_date BETWEEN ? AND ? ORDER BY e.gl_date,e.id,l.id`,
    'general-ledger': `SELECT e.id journal_id,e.gl_date,e.voucher_no,e.source_type,e.reference_no,a.code,a.name,l.customer_id,l.supplier_id,l.debit,l.credit FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id JOIN chart_of_accounts a ON a.id=l.account_id WHERE e.gl_date BETWEEN ? AND ? ORDER BY e.gl_date,e.id,l.id`,
    'profit-loss': `SELECT a.code,a.name,a.account_type,SUM(l.debit) debit,SUM(l.credit) credit FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id JOIN chart_of_accounts a ON a.id=l.account_id WHERE e.gl_date BETWEEN ? AND ? AND a.account_type IN ('INCOME','EXPENSE') GROUP BY a.id ORDER BY a.code`
};
const report = async (name, query, exportAll = false) => {
    const f = filters.parse(query);
    let sql;
    let params = [];
    if (['stock', 'valuation', 'low-stock'].includes(name)) {
        sql = `SELECT p.id product_id,p.sku,p.name product,w.id warehouse_id,w.name warehouse,COALESCE(b.on_hand_pcs,0) quantity_pcs,COALESCE(b.avg_cost,0) average_cost,ROUND(COALESCE(b.on_hand_pcs*b.avg_cost,0),2) stock_value,p.reorder_level_pcs FROM products p CROSS JOIN warehouses w LEFT JOIN inventory_balances b ON b.product_id=p.id AND b.warehouse_id=w.id WHERE 1=1`;
        if (f.product_id) {
            sql += ' AND p.id=?';
            params.push(f.product_id);
        }
        if (f.warehouse_id) {
            sql += ' AND w.id=?';
            params.push(f.warehouse_id);
        }
        if (name === 'low-stock')
            sql += ' AND p.is_active=1 AND COALESCE(b.on_hand_pcs,0)<=p.reorder_level_pcs';
        sql += ' ORDER BY p.name,w.name';
    } else if (['customer-outstanding', 'supplier-outstanding'].includes(name)) {
        const supplier = name.startsWith('supplier');
        const field = supplier ? 'supplier_id' : 'customer_id';
        sql = `SELECT p.id,p.name,p.phone,COALESCE(t.balance,0) balance FROM ${supplier ? 'suppliers' : 'customers'} p LEFT JOIN (SELECT l.${field} party_id,SUM(${supplier ? 'l.credit-l.debit' : 'l.debit-l.credit'}) balance FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id JOIN chart_of_accounts a ON a.id=l.account_id WHERE a.code=? AND e.gl_date<=? GROUP BY l.${field}) t ON t.party_id=p.id WHERE 1=1`;
        params = [supplier ? 'AP' : 'AR', f.to];
        if (f[field]) {
            sql += ' AND p.id=?';
            params.push(f[field]);
        }
        sql += ' ORDER BY p.name';
    } else if (name === 'expenses') {
        sql = `SELECT e.*,p.name payment_account FROM (
          SELECT j.id,h.id expense_id,h.expense_no,j.gl_date expense_date,h.expense_name,h.payment_account_id,h.amount,h.notes,'POSTED' status,j.id journal_id
          FROM expenses h JOIN journal_entries j ON j.source_type='EXPENSES' AND j.source_id=h.id
          UNION ALL
          SELECT r.id,h.id expense_id,h.expense_no,r.gl_date expense_date,h.expense_name,h.payment_account_id,-h.amount amount,h.notes,'REVERSAL' status,r.id journal_id
          FROM expenses h JOIN journal_entries j ON j.source_type='EXPENSES' AND j.source_id=h.id JOIN journal_entries r ON r.source_type='REVERSAL' AND r.source_id=j.id
        ) e JOIN payment_accounts p ON p.id=e.payment_account_id WHERE e.expense_date BETWEEN ? AND ?`;
        params = [f.from, f.to];
        if (f.expense_name) {
            sql += ' AND e.expense_name LIKE ?';
            params.push(`%${f.expense_name}%`);
        }
        if (f.payment_account_id) {
            sql += ' AND e.payment_account_id=?';
            params.push(f.payment_account_id);
        }
        sql += ' ORDER BY e.expense_date DESC,e.id DESC';
    } else {
        assert(Object.hasOwn(reportQueries, name), 'Unknown report', 404);
        sql = reportQueries[name];
        params = [f.from, f.to];
    }
    // Only these known report aliases/fields may add a predicate before the stable order.
    const extra = [];
    for (const [reportName, field, predicate] of [
        ['general-ledger', 'account_id', 'a.id=?'],
        ['cash-bank', 'payment_account_id', 'p.id=?'],
        ['stock-movements', 'product_id', 'm.product_id=?'],
        ['stock-movements', 'warehouse_id', 'm.warehouse_id=?']
    ])
        if (name === reportName && f[field]) {
            extra.push(predicate);
            params.push(f[field]);
        }
    if (extra.length) {
        const orderAt = sql.lastIndexOf(' ORDER BY ');
        assert(orderAt !== -1, 'Ledger query requires stable ordering');
        sql = `${sql.slice(0, orderAt)} AND ${extra.join(' AND ')}${sql.slice(orderAt)}`;
    }
    const [[count]] = await db.query(`SELECT COUNT(*) total FROM (${sql}) report_count`, params);
    assert(
        !exportAll || Number(count.total) <= 50000,
        'Narrow filters to export fewer than 50,000 rows',
        413
    );
    const [rows] = await db.query(`${sql} LIMIT ? OFFSET ?`, [
        ...params,
        exportAll ? 50000 : f.limit,
        exportAll ? 0 : (f.page - 1) * f.limit
    ]);
    let summary, totals;
    if (name === 'expenses') {
        const [groups] = await db.query(
            `SELECT expense_name,COUNT(*) entries,SUM(amount) total_amount FROM (${sql}) expense_details GROUP BY expense_name ORDER BY expense_name`,
            params
        );
        summary = { columns: ['expense_name', 'entries', 'total_amount'], rows: groups };
        totals = {
            total_expenses: groups.reduce((total, row) => total.plus(row.total_amount), D(0)).toFixed(2)
        };
    }
    const columns =
        name === 'expenses'
            ? [
                  'expense_no',
                  'expense_date',
                  'expense_name',
                  'payment_account',
                  'amount',
                  'status',
                  'journal_id'
              ]
            : rows[0]
              ? Object.keys(rows[0])
              : [];
    let statement;
    if (Object.hasOwn(statementDefinitions, name)) {
        const definition = statementDefinitions[name];
        const groupFields = definition.groupFields.join(',');
        const [[[company]], [groups]] = await Promise.all([
            db.execute('SELECT company_code,company_name FROM company_settings WHERE id=1'),
            db.query(
                `SELECT ${groupFields},COUNT(*) activity_count,${definition.aggregate} FROM (${sql}) statement_activity GROUP BY ${groupFields} ORDER BY ${groupFields} LIMIT 50001`,
                params
            )
        ]);
        assert(groups.length <= 50000, 'Narrow the filters to fewer than 50,000 ledger groups', 413);
        let selection = {};
        if (!groups.length) {
            const lookups = [
                [
                    name === 'general-ledger' && f.account_id,
                    'SELECT code,name FROM chart_of_accounts WHERE id=?'
                ],
                [
                    name === 'cash-bank' && f.payment_account_id,
                    'SELECT name payment_account FROM payment_accounts WHERE id=?'
                ],
                [
                    name === 'stock-movements' && f.product_id,
                    'SELECT name product,sku FROM products WHERE id=?'
                ],
                [
                    name === 'stock-movements' && f.warehouse_id,
                    'SELECT name warehouse FROM warehouses WHERE id=?'
                ]
            ].filter(([key]) => key);
            const selected = await Promise.all(lookups.map(([key, query]) => db.execute(query, [key])));
            selection = Object.assign({}, ...selected.map(([[row]]) => row || {}));
        }
        statement = buildReportStatement({ name, rows, groups, company, selection });
        if (name !== 'stock-movements')
            totals = {
                debit: statement.totals.debit,
                credit: statement.totals.credit,
                net_movement: statement.totals.net_movement
            };
    }
    return {
        period: { from: f.from, to: f.to },
        ...(summary ? { summary } : {}),
        ...(totals ? { totals } : {}),
        ...(statement ? { statement } : {}),
        columns,
        rows,
        meta: {
            page: f.page,
            limit: f.limit,
            total: Number(count.total),
            pages: Math.ceil(Number(count.total) / f.limit)
        }
    };
};
const dashboard = async (query = {}) => {
    const today = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const f = filters.parse({ from: `${today.slice(0, 7)}-01`, to: today, ...query });
    const period = [f.from, f.to];
    const monthly = (Date.parse(f.to) - Date.parse(f.from)) / 86400000 > 31;
    const bucket = monthly ? "DATE_FORMAT(invoice_date,'%Y-%m-01')" : 'invoice_date';
    const sql = `SELECT
      (SELECT COALESCE(SUM(total_amount),0) FROM sales_invoices WHERE status='POSTED' AND invoice_date=?) today_sales,
      (SELECT COALESCE(SUM(total_amount),0) FROM sales_invoices WHERE status='POSTED' AND invoice_date BETWEEN ? AND ?) monthly_sales,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts WHERE status='POSTED' AND receipt_date=?) today_collection,
      (SELECT COALESCE(SUM(i.line_amount),0) FROM goods_receipt_items i JOIN goods_receipts h ON h.id=i.goods_receipt_id WHERE h.status='POSTED' AND h.received_date BETWEEN ? AND ?) total_purchases,
      (SELECT COALESCE(SUM(amount),0) FROM customer_receipts WHERE status='POSTED' AND receipt_date BETWEEN ? AND ?) customer_collections,
      (SELECT COALESCE(SUM(amount),0) FROM supplier_payments WHERE status='POSTED' AND payment_date BETWEEN ? AND ?) supplier_payments,
      (SELECT COALESCE(SUM(ROUND(on_hand_pcs*avg_cost,2)),0) FROM inventory_balances) stock_value,
      (SELECT COUNT(*) FROM products p CROSS JOIN warehouses w LEFT JOIN inventory_balances b ON b.product_id=p.id AND b.warehouse_id=w.id WHERE p.is_active=1 AND COALESCE(b.on_hand_pcs,0)<=p.reorder_level_pcs) low_stock_products`;
    const [[[summary]], [accounts], [trend], [recent]] = await Promise.all([
        db.execute(sql, [today, `${today.slice(0, 7)}-01`, today, today, ...period, ...period, ...period]),
        db.execute(
            `SELECT a.code,COALESCE(SUM(l.debit-l.credit),0) balance,
          COALESCE(SUM(CASE WHEN e.gl_date BETWEEN ? AND ? THEN l.debit-l.credit ELSE 0 END),0) period_balance
          FROM chart_of_accounts a LEFT JOIN journal_lines l ON l.account_id=a.id
          LEFT JOIN journal_entries e ON e.id=l.journal_entry_id GROUP BY a.id`,
            period
        ),
        db.execute(
            `SELECT ${bucket} date,SUM(total_amount) amount FROM sales_invoices WHERE status='POSTED' AND invoice_date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
            period
        ),
        db.execute(
            `SELECT e.voucher_no,e.gl_date,e.source_type,SUM(l.debit) amount FROM journal_entries e JOIN journal_lines l ON l.journal_entry_id=e.id WHERE e.gl_date BETWEEN ? AND ? GROUP BY e.id ORDER BY e.posted_at DESC,e.id DESC LIMIT 8`,
            period
        )
    ]);
    const current = Object.fromEntries(accounts.map((a) => [a.code, D(a.balance)]));
    const balances = Object.fromEntries(accounts.map((a) => [a.code, D(a.period_balance)]));
    const netSales = D(balances.SALES)
        .neg()
        .minus(balances.SALES_RETURN || 0);
    const gross = netSales.minus(balances.COGS || 0);
    return {
        ...summary,
        period: { from: f.from, to: f.to },
        today,
        trend_granularity: monthly ? 'month' : 'day',
        customer_outstanding: money(current.AR).toFixed(2),
        supplier_outstanding: money(D(current.AP).neg()).toFixed(2),
        expenses: money(balances.EXPENSE).toFixed(2),
        gross_profit: money(gross).toFixed(2),
        net_profit: money(
            gross
                .minus(balances.EXPENSE || 0)
                .minus(balances.STOCK_LOSS || 0)
                .minus(balances.STOCK_GAIN || 0)
        ).toFixed(2),
        trend,
        recent
    };
};
const reconciliation = async () => {
    const [[balances]] =
        await db.query(`SELECT (SELECT COALESCE(SUM(ROUND(on_hand_pcs*avg_cost,2)),0) FROM inventory_balances) inventory_value,
      (SELECT COALESCE(SUM(l.debit-l.credit),0) FROM journal_lines l JOIN chart_of_accounts a ON a.id=l.account_id WHERE a.code='INVENTORY') inventory_gl,
      (SELECT COALESCE(SUM(debit-credit),0) FROM journal_lines) trial_balance_difference,
      (SELECT COUNT(*) FROM (SELECT journal_entry_id FROM journal_lines GROUP BY journal_entry_id HAVING SUM(debit)<>SUM(credit)) x) unbalanced_journals,
      (SELECT COUNT(*) FROM inventory_balances b LEFT JOIN (SELECT product_id,warehouse_id,SUM(quantity_delta_pcs) qty FROM stock_movements GROUP BY product_id,warehouse_id) m ON m.product_id=b.product_id AND m.warehouse_id=b.warehouse_id WHERE b.on_hand_pcs<>COALESCE(m.qty,0)) stock_quantity_mismatches,
      (SELECT COUNT(*) FROM journal_lines l JOIN chart_of_accounts a ON a.id=l.account_id WHERE (a.code='AR' AND l.customer_id IS NULL) OR (a.code='AP' AND l.supplier_id IS NULL)) unassigned_party_lines`);
    return {
        ...balances,
        inventory_difference: money(D(balances.inventory_value).minus(balances.inventory_gl)).toFixed(2)
    };
};
module.exports = { filters, customerColumns, ledgerRows, ledger, report, dashboard, reconciliation };

module.exports.openItems = async (type, rawId) => {
    const key = id.parse(rawId);
    const customer = type === 'customer';
    const sql = customer
        ? `SELECT h.id,h.invoice_no document_no,h.invoice_date date,h.total_amount amount,COALESCE(a.paid,0) allocated,COALESCE(r.returned,0) returned,GREATEST(h.total_amount-COALESCE(a.paid,0)-COALESCE(r.returned,0),0) outstanding
        FROM sales_invoices h LEFT JOIN (SELECT a.sales_invoice_id,SUM(a.amount) paid FROM customer_receipt_allocations a JOIN customer_receipts p ON p.id=a.receipt_id WHERE p.status='POSTED' GROUP BY a.sales_invoice_id) a ON a.sales_invoice_id=h.id
        LEFT JOIN (SELECT sales_invoice_id,SUM(total_amount) returned FROM sales_returns WHERE status='POSTED' GROUP BY sales_invoice_id) r ON r.sales_invoice_id=h.id WHERE h.customer_id=? AND h.status='POSTED' ORDER BY h.invoice_date,h.id`
        : `SELECT h.id,h.grn_no document_no,h.received_date date,i.amount,COALESCE(a.paid,0) allocated,COALESCE(r.returned,0) returned,GREATEST(i.amount-COALESCE(a.paid,0)-COALESCE(r.returned,0),0) outstanding
        FROM goods_receipts h JOIN purchases p ON p.id=h.purchase_id JOIN (SELECT goods_receipt_id,SUM(line_amount) amount FROM goods_receipt_items GROUP BY goods_receipt_id) i ON i.goods_receipt_id=h.id
        LEFT JOIN (SELECT a.goods_receipt_id,SUM(a.amount) paid FROM supplier_payment_allocations a JOIN supplier_payments s ON s.id=a.payment_id WHERE s.status='POSTED' GROUP BY a.goods_receipt_id) a ON a.goods_receipt_id=h.id
        LEFT JOIN (SELECT goods_receipt_id,SUM(total_amount) returned FROM purchase_returns WHERE status='POSTED' GROUP BY goods_receipt_id) r ON r.goods_receipt_id=h.id WHERE p.supplier_id=? AND h.status='POSTED' ORDER BY h.received_date,h.id`;
    const [rows] = await db.execute(sql, [key]);
    return rows;
};
