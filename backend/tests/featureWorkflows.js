const assert = require('node:assert/strict');
const { D } = require('../src/shared/financial');

const featureWorkflows = async (t, { db, ops, catalog, reports, journals, user, key, save, post }) => {
    const date = '2026-08-15';
    let fixture;
    await t.test(
        'two-product purchase, partial receiving, supplier payment, sale and period profit match the complete specification',
        async () => {
            const warehouse = await catalog.save(
                'warehouses',
                null,
                { code: 'FEATURE', name: 'Feature warehouse' },
                user
            );
            const supplier = await catalog.save('suppliers', null, { name: 'Feature supplier' }, user);
            const customer = await catalog.save('customers', null, { name: 'Feature customer' }, user);
            const bulb = await catalog.save(
                'products',
                null,
                {
                    sku: 'FEATURE-BULB',
                    name: 'Feature bulb',
                    selling_price: '150',
                    default_purchase_price: '100'
                },
                user
            );
            const plug = await catalog.save(
                'products',
                null,
                {
                    sku: 'FEATURE-SWITCH',
                    name: 'Feature switch',
                    selling_price: '280',
                    default_purchase_price: '200'
                },
                user
            );
            const purchase = await save('purchases', {
                supplier_id: supplier.id,
                warehouse_id: warehouse.id,
                purchase_date: date,
                supplier_invoice_no: 'FEATURE-PO',
                items: [
                    { product_id: bulb.id, quantity_pcs: 100, unit_cost: '100' },
                    { product_id: plug.id, quantity_pcs: 50, unit_cost: '200' }
                ]
            });
            await post('purchases', purchase.id);
            let po = await ops.get('purchases', purchase.id);
            assert.equal(po.total_amount, '20000.00');
            assert.equal(po.subtotal_amount, '20000.00');
            assert.equal(po.remaining_pcs, 150);
            const first = await save('grns', {
                purchase_id: purchase.id,
                received_date: date,
                items: [
                    { purchase_item_id: po.items[0].id, quantity_pcs: 60 },
                    { purchase_item_id: po.items[1].id, quantity_pcs: 50 }
                ]
            });
            await post('grns', first.id);
            const pending = await ops.pendingPurchases({ search: po.purchase_no });
            assert.equal(pending.meta.total, 1);
            assert.equal(Number(pending.data[0].remaining_pcs), 40);
            assert.equal(pending.data[0].remaining_amount, '4000.00');
            const second = await save('grns', {
                purchase_id: purchase.id,
                received_date: date,
                items: [{ purchase_item_id: po.items[0].id, quantity_pcs: 40 }]
            });
            await post('grns', second.id);
            assert.equal((await ops.pendingPurchases({ search: po.purchase_no })).meta.total, 0);
            po = await ops.get('purchases', purchase.id);
            assert.equal(po.received_pcs, 150);
            assert.equal(po.remaining_pcs, 0);
            assert.equal(po.status, 'CLOSED');
            const payment = await save('payments', {
                supplier_id: supplier.id,
                payment_date: date,
                payment_account_id: '1',
                amount: '8000',
                allocations: [
                    { document_id: first.id, amount: '5000' },
                    { document_id: second.id, amount: '3000' }
                ]
            });
            await post('payments', payment.id);
            assert.equal(
                (await reports.ledger('supplier', { supplier_id: supplier.id })).totals.closing,
                '12000.00'
            );
            const [accounts] = await db.query(
                "SELECT id,code FROM chart_of_accounts WHERE code IN ('AR','OPENING_EQUITY')"
            );
            const ids = Object.fromEntries(accounts.map((row) => [row.code, row.id]));
            await journals.create(
                {
                    gl_date: '2026-08-14',
                    type: 'OPENING_BALANCE',
                    reason: 'Feature opening due',
                    lines: [
                        { account_id: ids.AR, customer_id: customer.id, debit: '2000' },
                        { account_id: ids.OPENING_EQUITY, credit: '2000' }
                    ]
                },
                user,
                key()
            );
            const invoice = await save('sales', {
                customer_id: customer.id,
                warehouse_id: warehouse.id,
                invoice_date: date,
                items: [
                    { product_id: bulb.id, quantity_pcs: 30, unit_price: '150' },
                    { product_id: plug.id, quantity_pcs: 10, unit_price: '280' }
                ]
            });
            await post('sales', invoice.id, { payment: { payment_account_id: '1', amount: '3000' } });
            const inv = await ops.get('sales', invoice.id);
            assert.equal(inv.previous_due_snapshot, '2000.00');
            assert.equal(inv.total_amount, '7300.00');
            assert.equal(inv.closing_due_snapshot, '6300.00');
            assert.deepEqual(
                inv.items.map((row) => row.return_basis_amount),
                ['4500.00', '2800.00']
            );
            const [stock] = await db.execute(
                'SELECT product_id,on_hand_pcs FROM inventory_balances WHERE warehouse_id=? ORDER BY product_id',
                [warehouse.id]
            );
            assert.deepEqual(
                stock.map((row) => row.on_hand_pcs),
                [70, 40]
            );
            for (const [name, amount] of [
                ['Feature transport', '100'],
                ['Feature rent', '200']
            ]) {
                const expense = await save('expenses', {
                    expense_name: name,
                    expense_date: date,
                    payment_account_id: '1',
                    amount
                });
                await post('expenses', expense.id);
            }
            await save('expenses', {
                expense_name: 'Feature draft',
                expense_date: date,
                payment_account_id: '1',
                amount: '999'
            });
            const future = await save('expenses', {
                expense_name: 'Feature future',
                expense_date: '2026-08-16',
                payment_account_id: '1',
                amount: '55'
            });
            await post('expenses', future.id);
            const summary = await reports.report('expenses', { from: date, to: date, limit: 1 });
            assert.equal(summary.rows.length, 1);
            assert.equal(summary.meta.total, 2);
            assert.equal(summary.totals.total_expenses, '300.00');
            assert.deepEqual(summary.summary.rows.map((row) => row.total_amount).sort(), [
                '100.00',
                '200.00'
            ]);
            const filtered = await reports.report('expenses', {
                from: date,
                to: date,
                expense_name: 'transport',
                payment_account_id: '1'
            });
            assert.equal(filtered.totals.total_expenses, '100.00');
            const empty = await reports.report('expenses', {
                from: date,
                to: date,
                expense_name: 'No such expense'
            });
            assert.equal(empty.totals.total_expenses, '0.00');
            const dashboard = await reports.dashboard({ from: date, to: date });
            assert.equal(dashboard.total_purchases, '20000.00');
            assert.equal(dashboard.customer_collections, '3000.00');
            assert.equal(dashboard.supplier_payments, '8000.00');
            assert.equal(dashboard.gross_profit, '2300.00');
            assert.equal(dashboard.expenses, '300.00');
            assert.equal(dashboard.net_profit, '2000.00');
            const receipt = await save('receipts', {
                customer_id: customer.id,
                receipt_date: dashboard.today,
                payment_account_id: '1',
                amount: '25'
            });
            await post('receipts', receipt.id);
            const refreshed = await reports.dashboard({ from: date, to: date });
            assert.equal(refreshed.today_collection, D(dashboard.today_collection).plus(25).toFixed(2));
            assert.equal(refreshed.customer_collections, '3000.00');
            fixture = {
                warehouse,
                supplier,
                customer,
                bulb,
                plug,
                purchase,
                invoice,
                payment,
                receipt,
                date,
                purchaseNo: po.purchase_no,
                invoiceNo: inv.invoice_no
            };
            const reversed = await save('expenses', {
                expense_name: 'Feature reversal timing',
                expense_date: '2026-07-10',
                payment_account_id: '1',
                amount: '50'
            });
            await post('expenses', reversed.id);
            const [[entry]] = await db.execute(
                "SELECT id FROM journal_entries WHERE source_type='EXPENSES' AND source_id=?",
                [reversed.id]
            );
            await journals.reverse(
                entry.id,
                { gl_date: '2026-07-11', reason: 'Feature reversal timing' },
                user,
                key()
            );
            assert.equal(
                (await reports.report('expenses', { from: '2026-07-10', to: '2026-07-10' })).totals
                    .total_expenses,
                '50.00'
            );
            assert.equal(
                (await reports.report('expenses', { from: '2026-07-11', to: '2026-07-11' })).totals
                    .total_expenses,
                '-50.00'
            );
            assert.equal(
                (await reports.report('expenses', { from: '2026-07-10', to: '2026-07-11' })).totals
                    .total_expenses,
                '0.00'
            );
        }
    );
    await t.test(
        'profile histories page, search, filter dates and provide original-document drilldowns',
        async () => {
            assert.ok(fixture);
            for (let index = 0; index < 12; index++)
                await save('sales', {
                    customer_id: fixture.customer.id,
                    warehouse_id: fixture.warehouse.id,
                    invoice_date: date,
                    items: [{ product_id: fixture.bulb.id, quantity_pcs: 1, unit_price: '150' }]
                });
            const page1 = await catalog.history(
                'customers',
                fixture.customer.id,
                { page: 1, limit: 5 },
                user
            );
            const page2 = await catalog.history(
                'customers',
                fixture.customer.id,
                { page: 2, limit: 5 },
                user
            );
            assert.equal(page1.meta.total, 13);
            assert.equal(page1.meta.pages, 3);
            assert.equal(page2.data.length, 5);
            assert.ok(!page1.data.some((row) => page2.data.some((other) => row.id === other.id)));
            const found = await catalog.history(
                'customers',
                fixture.customer.id,
                { search: page1.data[0].invoice_no, from: date, to: date },
                user
            );
            assert.equal(found.meta.total, 1);
            assert.equal(found.data[0].document_resource, 'sales');
            assert.equal(
                (
                    await catalog.history(
                        'customers',
                        fixture.customer.id,
                        { from: '2026-07-01', to: '2026-07-31' },
                        user
                    )
                ).meta.total,
                0
            );
            for (const type of ['movements', 'purchases', 'sales']) {
                const history = await catalog.history('products', fixture.bulb.id, { type, limit: 2 }, user);
                assert.ok(history.meta.total >= 1);
                assert.ok(history.data.every((row) => row.document_id && row.document_resource));
            }
            const payments = await ops.list('receipts', { party_id: fixture.customer.id, page: 2, limit: 1 });
            assert.equal(payments.meta.total, 2);
            assert.equal(payments.data.length, 1);
            const dated = await ops.list('receipts', { party_id: fixture.customer.id, from: date, to: date });
            assert.equal(dated.meta.total, 1);
            assert.equal(dated.data[0].amount, '3000.00');
            for (let index = 0; index < 11; index++)
                await save('receipts', {
                    customer_id: fixture.customer.id,
                    receipt_date: date,
                    payment_account_id: '1',
                    amount: '0.01'
                });
            await assert.rejects(
                () =>
                    catalog.history('products', fixture.bulb.id, { type: 'purchases' }, { role: 'CASHIER' }),
                (error) => error.statusCode === 403
            );
        }
    );
    await t.test(
        'password changes write an atomic audit event and audit history paginates and redacts session data',
        async () => {
            const account = await catalog.save(
                'users',
                null,
                {
                    name: 'Feature accountant',
                    email: 'feature-accountant@example.invalid',
                    password: 'Test-only-password',
                    role: 'ACCOUNTANT',
                    is_active: true
                },
                user
            );
            const auth = require('../src/modules/auth/auth.service');
            await auth.changePassword(account.id, {
                oldPassword: 'Test-only-password',
                newPassword: 'Feature-new-password'
            });
            const audit = require('../src/modules/reports/audit.service');
            const changes = await audit.list({
                user_id: account.id,
                action: 'CHANGE_PASSWORD',
                entity: 'users'
            });
            assert.equal(changes.meta.total, 1);
            assert.deepEqual(changes.data[0].details, {});
            await require('../src/shared/transaction').audit(db, user, 'FEATURE_AUDIT', 'users', account.id, {
                reason: 'Feature test',
                sid: 'must-not-leak',
                nested: { accessToken: 'must-not-leak' }
            });
            const result = await audit.list({ search: 'FEATURE_AUDIT', limit: 1 });
            assert.equal(result.meta.total, 1);
            assert.equal(result.data[0].user_name, 'Test admin');
            assert.equal(JSON.stringify(result.data).includes('must-not-leak'), false);
            const full = await audit.list({ limit: 1, page: 2 });
            assert.ok(full.meta.total > 2);
            assert.equal(full.data.length, 1);
            const timestamp = String(result.data[0].created_at).slice(0, 10);
            assert.equal(
                (await audit.list({ action: 'FEATURE_AUDIT', from: timestamp, to: timestamp })).meta.total,
                1
            );
            await assert.rejects(() =>
                auth.changePassword(account.id, {
                    oldPassword: 'wrong-password',
                    newPassword: 'Another-test-password'
                })
            );
            assert.equal(
                (await audit.list({ user_id: account.id, action: 'CHANGE_PASSWORD' })).meta.total,
                1
            );
        }
    );
    await t.test(
        'professional supplier, account, cash-bank and stock statements keep full-filter totals and bound filters',
        async () => {
            const supplier = await reports.ledger('supplier', {
                supplier_id: fixture.supplier.id,
                from: date,
                to: date,
                limit: 1
            });
            assert.equal(supplier.statement.title, 'Supplier Ledger Accounts');
            assert.equal(supplier.statement.totals['Closing Balance'], supplier.totals.closing);
            assert.equal(supplier.rows.length, 1);
            assert.equal(supplier.statement.sections[0].indexes.length, 1);
            const [[account]] = await db.execute("SELECT id FROM chart_of_accounts WHERE code='AR'");
            fixture.arAccountId = String(account.id);
            const filters = { from: date, to: date, account_id: String(account.id) };
            const gl = await reports.report('general-ledger', { ...filters, limit: 1 });
            const [[expected]] = await db.execute(
                'SELECT SUM(l.debit) debit,SUM(l.credit) credit FROM journal_lines l JOIN journal_entries e ON e.id=l.journal_entry_id WHERE l.account_id=? AND e.gl_date BETWEEN ? AND ?',
                [String(account.id), date, date]
            );
            assert.equal(gl.totals.debit, expected.debit);
            assert.equal(gl.totals.credit, expected.credit);
            assert.equal(gl.statement.sections.length, 1);
            assert.equal(gl.rows[0].code, 'AR');
            assert.deepEqual(
                (await reports.report('general-ledger', { ...filters, limit: 1, page: 2 })).totals,
                gl.totals
            );
            await assert.rejects(() => reports.report('general-ledger', { account_id: '1 OR 1=1' }));
            const cash = await reports.report('cash-bank', {
                from: date,
                to: date,
                payment_account_id: '1',
                limit: 1
            });
            assert.equal(cash.statement.sections.length, 1);
            assert.ok(cash.rows.every((row) => String(row.payment_account_id) === '1'));
            const stock = await reports.report('stock-movements', {
                product_id: fixture.bulb.id,
                warehouse_id: fixture.warehouse.id,
                limit: 1
            });
            const [[movement]] = await db.execute(
                'SELECT SUM(GREATEST(quantity_delta_pcs,0)) quantity_in,SUM(GREATEST(-quantity_delta_pcs,0)) quantity_out,SUM(quantity_delta_pcs) net FROM stock_movements WHERE product_id=? AND warehouse_id=?',
                [fixture.bulb.id, fixture.warehouse.id]
            );
            assert.equal(stock.statement.totals.quantity_in, String(movement.quantity_in));
            assert.equal(stock.statement.totals.quantity_out, String(movement.quantity_out));
            assert.equal(stock.statement.totals.quantity_delta_pcs, String(movement.net));
            assert.ok(
                stock.rows.every(
                    (row) =>
                        String(row.product_id) === String(fixture.bulb.id) &&
                        String(row.warehouse_id) === String(fixture.warehouse.id)
                )
            );
            const empty = await reports.report('general-ledger', {
                from: '1900-01-01',
                to: '1900-01-01',
                account_id: String(account.id)
            });
            assert.equal(empty.meta.total, 0);
            assert.equal(empty.statement.totals.debit, '0.00');
            assert.equal(empty.statement.details[0][1], 'AR');
        }
    );
    // A confirmed order gives the browser a real pending-purchase entry to open.
    if (fixture) {
        const pending = await save('purchases', {
            supplier_id: fixture.supplier.id,
            warehouse_id: fixture.warehouse.id,
            purchase_date: date,
            items: [{ product_id: fixture.bulb.id, quantity_pcs: 5, unit_cost: '100' }]
        });
        await post('purchases', pending.id);
        fixture.pending = pending;
        fixture.pendingNo = (await ops.get('purchases', pending.id)).purchase_no;
    }
    return fixture;
};
module.exports = featureWorkflows;

const verifyHttp = async ({ db, user, request, headers }) => {
    const expected = {
        ADMIN: [
            'purchases',
            'grns',
            'sales',
            'receipts',
            'payments',
            'sales-returns',
            'purchase-returns',
            'adjustments',
            'expenses'
        ],
        MANAGER: [
            'purchases',
            'grns',
            'sales',
            'receipts',
            'payments',
            'sales-returns',
            'purchase-returns',
            'adjustments',
            'expenses'
        ],
        PURCHASE: ['purchases', 'grns', 'purchase-returns'],
        WAREHOUSE: ['purchases', 'grns', 'adjustments'],
        CASHIER: ['sales', 'receipts', 'sales-returns'],
        ACCOUNTANT: [
            'purchases',
            'grns',
            'sales',
            'receipts',
            'payments',
            'sales-returns',
            'purchase-returns',
            'adjustments',
            'expenses'
        ]
    };
    try {
        for (const [role, allowed] of Object.entries(expected)) {
            await db.execute('UPDATE users SET role=? WHERE id=?', [role, user.id]);
            for (const kind of expected.ADMIN) {
                const result = await request(`/${kind}`, { headers });
                assert.equal(result.status, allowed.includes(kind) ? 200 : 403, `${role} GET /${kind}`);
                const detail = await request(`/${kind}/18446744073709551615`, { headers });
                assert.equal(detail.status, allowed.includes(kind) ? 404 : 403, `${role} GET /${kind}/:id`);
            }
            assert.equal(
                (await request('/audit-logs', { headers })).status,
                ['ADMIN', 'MANAGER'].includes(role) ? 200 : 403
            );
        }
    } finally {
        await db.execute("UPDATE users SET role='ADMIN' WHERE id=?", [user.id]);
    }
};
module.exports.verifyHttp = verifyHttp;
