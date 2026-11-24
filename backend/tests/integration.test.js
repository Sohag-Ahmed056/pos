// Uses a freshly created disposable database. It never modifies batteryPos records.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const sourceDatabase = process.env.POS_SCHEMA_DB || 'batteryPos';
const testDatabase = `batteryPos_test_${crypto.randomBytes(8).toString('hex')}`;
const options = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 4406),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true
};
let admin,
    db,
    ops,
    catalog,
    reports,
    journals,
    user,
    warehouse,
    product,
    supplier,
    customer,
    purchase,
    grn,
    invoice;
const key = () => crypto.randomUUID();
const day = '2026-10-25';
const save = (kind, payload, k = key()) => ops.save(kind, null, payload, user, k);
const post = (kind, id, payload = {}, k = key()) => ops.post(kind, id, payload, user, k);
before(async () => {
    assert.match(sourceDatabase, /^[A-Za-z][A-Za-z0-9_]*$/);
    assert.match(testDatabase, /^batteryPos_test_[a-f0-9]{16}$/);
    admin = await mysql.createConnection(options);
    await admin.query(`CREATE DATABASE \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await admin.query(`USE \`${testDatabase}\``);
    await admin.query('SET FOREIGN_KEY_CHECKS=0');
    const [tables] = await admin.query(
        `SHOW FULL TABLES FROM \`${sourceDatabase}\` WHERE Table_type='BASE TABLE'`
    );
    for (const entry of tables) {
        const table = Object.values(entry)[0];
        assert.match(table, /^[a-z_]+$/);
        const [[ddl]] = await admin.query(`SHOW CREATE TABLE \`${sourceDatabase}\`.\`${table}\``);
        await admin.query(ddl['Create Table']);
    }
    await admin.query('SET FOREIGN_KEY_CHECKS=1');
    process.env.DB_NAME = testDatabase;
    delete process.env.DATABASE_URL;
    db = require('../src/config/db');
    ops = require('../src/modules/operations/operations.service');
    catalog = require('../src/modules/catalog/catalog.service');
    reports = require('../src/modules/reports/reports.service');
    journals = require('../src/modules/operations/journal.service');
    const codes = [
        ['CASH', 'ASSET'],
        ['BANK', 'ASSET'],
        ['AR', 'ASSET'],
        ['AP', 'LIABILITY'],
        ['INVENTORY', 'ASSET'],
        ['SALES', 'INCOME'],
        ['SALES_RETURN', 'INCOME'],
        ['COGS', 'EXPENSE'],
        ['EXPENSE', 'EXPENSE'],
        ['STOCK_LOSS', 'EXPENSE'],
        ['STOCK_GAIN', 'INCOME'],
        ['OPENING_EQUITY', 'EQUITY']
    ];
    for (const [code, type] of codes)
        await db.execute('INSERT INTO chart_of_accounts (code,name,account_type) VALUES (?,?,?)', [
            code,
            code,
            type
        ]);
    const [[cash]] = await db.execute("SELECT id FROM chart_of_accounts WHERE code='CASH'");
    await db.execute(
        "INSERT INTO payment_accounts (id,name,account_type,gl_account_id) VALUES (1,'Test cash','CASH',?)",
        [cash.id]
    );
    const [r] = await db.execute(
        "INSERT INTO users (name,email,password_hash,role) VALUES ('Test admin','test@example.invalid',?,'ADMIN')",
        [await bcrypt.hash('Test-only-password', 4)]
    );
    user = { id: String(r.insertId), role: 'ADMIN' };
});
after(async () => {
    if (db) await db.end();
    if (admin) {
        if (/^batteryPos_test_[a-f0-9]{16}$/.test(testDatabase))
            await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
        await admin.end();
    }
});
test('critical direct-MySQL workflows', async (t) => {
    await t.test('product creation prevents duplicate SKU and does not increase stock', async () => {
        product = await catalog.save(
            'products',
            null,
            { sku: 'TEST-BAT', name: 'Test battery', selling_price: '1460', default_purchase_price: '600' },
            user
        );
        await assert.rejects(
            () => catalog.save('products', null, { sku: 'TEST-BAT', name: 'Duplicate' }, user),
            (e) => e.code === 'ER_DUP_ENTRY'
        );
        const [[r]] = await db.query('SELECT COUNT(*) n FROM inventory_balances');
        assert.equal(Number(r.n), 0);
    });
    await t.test('supplier and customer quick-add reuse existing accounts', async () => {
        supplier = await catalog.save('suppliers', null, { name: 'Test supplier', phone: '0000' }, user);
        const again = await catalog.save('suppliers', null, { name: 'Test supplier', phone: '0000' }, user);
        assert.equal(String(again.id), String(supplier.id));
        customer = await catalog.save(
            'customers',
            null,
            { name: 'Test customer', party_name: 'Party A', area_name: 'Dhaka', sales_channel: 'Dealer' },
            user
        );
        const same = await catalog.save('customers', null, { name: 'Test customer' }, user);
        assert.equal(String(same.id), String(customer.id));
        warehouse = await catalog.save('warehouses', null, { code: 'TEST', name: 'Test warehouse' }, user);
    });
    await t.test('opening stock creates inventory and balanced opening equity', async () => {
        const a = await save('adjustments', {
            product_id: product.id,
            warehouse_id: warehouse.id,
            adjustment_date: day,
            adjustment_type: 'OPENING',
            quantity_pcs: 20,
            unit_cost: '500',
            reason: 'Test opening'
        });
        await post('adjustments', a.id);
    });
    await t.test('purchase confirmation never increases stock', async () => {
        purchase = await save('purchases', {
            supplier_id: supplier.id,
            warehouse_id: warehouse.id,
            purchase_date: day,
            supplier_invoice_no: 'TEST-INV',
            items: [{ product_id: product.id, quantity_pcs: 10, unit_cost: '600', discount_amount: '0' }]
        });
        await post('purchases', purchase.id);
        const [[s]] = await db.query('SELECT on_hand_pcs FROM inventory_balances');
        assert.equal(s.on_hand_pcs, 20);
    });
    await t.test('partial GRNs, idempotent posting, over-receiving prevention', async () => {
        const p = await ops.get('purchases', purchase.id);
        const body = {
            purchase_id: purchase.id,
            received_date: day,
            items: [{ purchase_item_id: p.items[0].id, quantity_pcs: 3 }]
        };
        const k = key();
        grn = await save('grns', body, k);
        const same = await save('grns', body, k);
        assert.equal(same.id, grn.id);
        await assert.rejects(
            () => save('grns', { ...body, received_date: '2026-10-24' }, k),
            (e) => e.statusCode === 409
        );
        await Promise.all([post('grns', grn.id), post('grns', grn.id)]);
        const second = await save('grns', {
            ...body,
            items: [{ purchase_item_id: p.items[0].id, quantity_pcs: 7 }]
        });
        await post('grns', second.id);
        const bad = await save('grns', body);
        await assert.rejects(() => post('grns', bad.id), /remaining purchase quantity/);
        const [[s]] = await db.query('SELECT on_hand_pcs FROM inventory_balances');
        assert.equal(s.on_hand_pcs, 30);
    });
    await t.test('previous due is separate from new revenue and immediate collection is atomic', async () => {
        const [a] = await db.query(
            "SELECT id,code FROM chart_of_accounts WHERE code IN ('AR','OPENING_EQUITY')"
        );
        const ids = Object.fromEntries(a.map((x) => [x.code, x.id]));
        await journals.create(
            {
                gl_date: '2026-10-24',
                type: 'OPENING_BALANCE',
                reason: 'Test opening due',
                lines: [
                    { account_id: ids.AR, customer_id: customer.id, debit: '2000' },
                    { account_id: ids.OPENING_EQUITY, credit: '2000' }
                ]
            },
            user,
            key()
        );
        const body = {
            customer_id: customer.id,
            warehouse_id: warehouse.id,
            invoice_date: day,
            items: [{ product_id: product.id, quantity_pcs: 5, unit_price: '1460' }]
        };
        invoice = await save('sales', body);
        await post('sales', invoice.id, { payment: { payment_account_id: '1', amount: '3000' } });
        const [[d]] = await db.execute(
            "SELECT SUM(l.debit-l.credit) balance FROM journal_lines l JOIN chart_of_accounts a ON a.id=l.account_id WHERE a.code='AR' AND l.customer_id=?",
            [customer.id]
        );
        assert.equal(d.balance, '6300.00');
        const inv = await ops.get('sales', invoice.id);
        assert.equal(inv.previous_due_snapshot, '2000.00');
        const [[sales]] = await db.query(
            "SELECT SUM(l.credit) sales FROM journal_lines l JOIN chart_of_accounts a ON a.id=l.account_id WHERE a.code='SALES'"
        );
        assert.equal(sales.sales, '7300.00');
    });
    await t.test('a rejected sale payment rolls back stock, journals and invoice posting', async () => {
        const inv = await save('sales', {
            customer_id: customer.id,
            warehouse_id: warehouse.id,
            invoice_date: day,
            items: [{ product_id: product.id, quantity_pcs: 1, unit_price: '100' }]
        });
        const [[before]] = await db.query('SELECT on_hand_pcs FROM inventory_balances');
        await assert.rejects(() =>
            post('sales', inv.id, { payment: { payment_account_id: '999999', amount: '10' } })
        );
        const [[after]] = await db.query('SELECT on_hand_pcs FROM inventory_balances');
        assert.equal(after.on_hand_pcs, before.on_hand_pcs);
        assert.equal((await ops.get('sales', inv.id)).status, 'DRAFT');
    });
    await t.test('concurrent competing sales prevent overselling', async () => {
        const body = {
            customer_id: customer.id,
            warehouse_id: warehouse.id,
            invoice_date: day,
            items: [{ product_id: product.id, quantity_pcs: 20, unit_price: '10' }]
        };
        const a = await save('sales', body);
        const b = await save('sales', body);
        const results = await Promise.allSettled([post('sales', a.id), post('sales', b.id)]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        const [[s]] = await db.query('SELECT on_hand_pcs FROM inventory_balances');
        assert.equal(s.on_hand_pcs, 5);
    });
    await t.test('partial receipts allocate safely and allow unallocated customer advances', async () => {
        const receipt = await save('receipts', {
            customer_id: customer.id,
            payment_account_id: '1',
            receipt_date: day,
            amount: '20000',
            allocations: [{ document_id: invoice.id, amount: '1000' }]
        });
        await post('receipts', receipt.id);
        const open = await reports.openItems('customer', customer.id);
        assert.equal(open.find((r) => String(r.id) === invoice.id).outstanding, '3300.00');
        await assert.rejects(
            () =>
                ops.addAllocations(
                    'receipts',
                    receipt.id,
                    { allocations: [{ document_id: invoice.id, amount: '3300.01' }] },
                    user,
                    key()
                ),
            /outstanding/
        );
        const other = await catalog.save('customers', null, { name: 'Other customer' }, user);
        const wrong = await save('receipts', {
            customer_id: other.id,
            payment_account_id: '1',
            receipt_date: day,
            amount: '1',
            allocations: [{ document_id: invoice.id, amount: '1' }]
        });
        await assert.rejects(() => post('receipts', wrong.id), /belong/);
        const out = await reports.report('customer-outstanding', { customer_id: customer.id });
        assert.ok(Number(out.rows[0].balance) < 0);
    });
    await t.test('supplier payments enforce payable and same-party allocation', async () => {
        const p = await save('payments', {
            supplier_id: supplier.id,
            payment_account_id: '1',
            payment_date: day,
            amount: '1000',
            allocations: [{ document_id: grn.id, amount: '1000' }]
        });
        await post('payments', p.id);
        const bad = await save('payments', {
            supplier_id: supplier.id,
            payment_account_id: '1',
            payment_date: day,
            amount: '5000.01'
        });
        await assert.rejects(() => post('payments', bad.id), /payable/);
    });
    await t.test('sales return validates original lines and restores saleable stock', async () => {
        const inv = await ops.get('sales', invoice.id);
        const r = await save('sales-returns', {
            sales_invoice_id: invoice.id,
            return_date: day,
            items: [{ sales_invoice_item_id: inv.items[0].id, quantity_pcs: 2, saleable: true }]
        });
        await post('sales-returns', r.id);
        assert.equal((await ops.get('sales-returns', r.id)).total_amount, '2920.00');
        const bad = await save('sales-returns', {
            sales_invoice_id: invoice.id,
            return_date: day,
            items: [{ sales_invoice_item_id: inv.items[0].id, quantity_pcs: 4 }]
        });
        await assert.rejects(() => post('sales-returns', bad.id), /remaining eligible/);
    });
    await t.test('purchase returns preserve history and reduce payable', async () => {
        const g = await ops.get('grns', grn.id);
        const r = await save('purchase-returns', {
            goods_receipt_id: grn.id,
            return_date: day,
            items: [{ goods_receipt_item_id: g.items[0].id, quantity_pcs: 1 }]
        });
        await post('purchase-returns', r.id);
        assert.equal((await ops.get('purchase-returns', r.id)).total_amount, '600.00');
    });
    await t.test('expenses post balanced journals and can be reversed once', async () => {
        const e = await save('expenses', {
            expense_date: day,
            expense_name: 'Test transport',
            payment_account_id: '1',
            amount: '100'
        });
        await post('expenses', e.id);
        const [[entry]] = await db.execute(
            "SELECT id FROM journal_entries WHERE source_type='EXPENSES' AND source_id=?",
            [e.id]
        );
        await journals.reverse(entry.id, { gl_date: day, reason: 'Test correction' }, user, key());
        await journals.reverse(entry.id, { gl_date: day, reason: 'Retry correction' }, user, key());
        const [[n]] = await db.execute(
            "SELECT COUNT(*) n FROM journal_entries WHERE source_type='REVERSAL' AND source_id=?",
            [entry.id]
        );
        assert.equal(Number(n.n), 1);
    });
    await t.test('Walton ledger, snapshots, exports data and group subtotals reconcile', async () => {
        await catalog.save(
            'customers',
            customer.id,
            { name: 'Renamed customer', party_name: 'Party B' },
            user
        );
        const ledger = await reports.ledger(
            'customer',
            { from: day, to: day, customer_id: customer.id },
            true
        );
        assert.equal(ledger.columns.length, 11);
        assert.equal(ledger.totals.opening, '2000.00');
        assert.ok(ledger.subtotals.party.find((g) => g.name === 'Party A'));
        assert.ok(!ledger.subtotals.party.find((g) => g.name === 'Party B'));
        const out = await reports.report('customer-outstanding', { customer_id: customer.id });
        assert.equal(ledger.totals.closing, out.rows[0].balance);
        const supplierLedger = await reports.ledger('supplier', { supplier_id: supplier.id }, true);
        const supplierOut = await reports.report('supplier-outstanding', { supplier_id: supplier.id });
        assert.equal(supplierLedger.totals.closing, supplierOut.rows[0].balance);
    });
    await t.test('all report queries execute against MySQL 8', async () => {
        for (const report of [
            'sales',
            'monthly-sales',
            'product-sales',
            'purchases',
            'stock-movements',
            'collections',
            'supplier-payments',
            'expenses',
            'cash-bank',
            'general-ledger',
            'profit-loss',
            'stock',
            'valuation',
            'low-stock'
        ]) {
            const data = await reports.report(report, { from: '2026-10-01', to: day });
            assert.ok(Array.isArray(data.rows), report);
        }
        assert.ok(await reports.dashboard());
    });
    await t.test('bank, bKash and Nagad use separate existing-table GL asset accounts', async () => {
        for (const type of ['BANK', 'BKASH', 'NAGAD']) {
            const account = await catalog.save(
                'chart_of_accounts',
                null,
                { code: `TEST_${type}`, name: `Test ${type}`, account_type: 'ASSET' },
                user
            );
            const payment = await catalog.save(
                'payment_accounts',
                null,
                { name: `Test ${type}`, account_type: type, gl_account_id: account.id },
                user
            );
            const receipt = await save('receipts', {
                customer_id: customer.id,
                payment_account_id: payment.id,
                receipt_date: day,
                amount: '1'
            });
            await post('receipts', receipt.id);
            const [[balance]] = await db.execute(
                'SELECT SUM(debit-credit) amount FROM journal_lines WHERE account_id=?',
                [account.id]
            );
            assert.equal(balance.amount, '1.00');
            await assert.rejects(
                () =>
                    catalog.save(
                        'chart_of_accounts',
                        account.id,
                        { code: 'ALTERED', name: 'Changed', account_type: 'ASSET' },
                        user
                    ),
                (e) => e.statusCode === 405
            );
        }
    });
    await t.test(
        'partial discounted returns preserve cents and nonsaleable items do not restore stock',
        async () => {
            const p = await catalog.save(
                'products',
                null,
                { sku: 'ROUNDING-TEST', name: 'Rounding test item' },
                user
            );
            const opening = await save('adjustments', {
                product_id: p.id,
                warehouse_id: warehouse.id,
                adjustment_date: day,
                adjustment_type: 'OPENING',
                quantity_pcs: 3,
                unit_cost: '0.3333',
                reason: 'Fractional cost test'
            });
            await post('adjustments', opening.id);
            const sale = await save('sales', {
                customer_id: customer.id,
                warehouse_id: warehouse.id,
                invoice_date: day,
                discount_amount: '1.00',
                items: [{ product_id: p.id, quantity_pcs: 3, unit_price: '1.00' }]
            });
            await post('sales', sale.id);
            const line = (await ops.get('sales', sale.id)).items[0];
            const totals = [];
            for (let i = 0; i < 3; i++) {
                const returned = await save('sales-returns', {
                    sales_invoice_id: sale.id,
                    return_date: day,
                    items: [{ sales_invoice_item_id: line.id, quantity_pcs: 1, saleable: i !== 2 }]
                });
                await post('sales-returns', returned.id);
                totals.push((await ops.get('sales-returns', returned.id)).total_amount);
            }
            assert.deepEqual(totals, ['0.67', '0.66', '0.67']);
            const [[balance]] = await db.execute(
                'SELECT on_hand_pcs FROM inventory_balances WHERE product_id=? AND warehouse_id=?',
                [p.id, warehouse.id]
            );
            assert.equal(balance.on_hand_pcs, 2);
        }
    );
    await t.test(
        'one receipt settles several invoices and a full return releases its allocation',
        async () => {
            const invoices = [];
            for (const amount of ['40.00', '60.00']) {
                const created = await save('sales', {
                    customer_id: customer.id,
                    warehouse_id: warehouse.id,
                    invoice_date: day,
                    items: [{ product_id: product.id, quantity_pcs: 1, unit_price: amount }]
                });
                await post('sales', created.id);
                invoices.push(created);
            }
            const receipt = await save('receipts', {
                customer_id: customer.id,
                payment_account_id: '1',
                receipt_date: day,
                amount: '100.00',
                allocations: invoices.map((i, n) => ({
                    document_id: i.id,
                    amount: n === 0 ? '40.00' : '60.00'
                }))
            });
            await post('receipts', receipt.id);
            const line = (await ops.get('sales', invoices[0].id)).items[0];
            const returned = await save('sales-returns', {
                sales_invoice_id: invoices[0].id,
                return_date: day,
                items: [{ sales_invoice_item_id: line.id, quantity_pcs: 1, saleable: true }]
            });
            await post('sales-returns', returned.id);
            const allocations = (await ops.get('receipts', receipt.id)).items;
            assert.equal(allocations.length, 1);
            assert.equal(allocations[0].amount, '60.00');
            const [[audit]] = await db.execute(
                "SELECT COUNT(*) n FROM audit_logs WHERE action_code='RELEASE_RETURN_ALLOCATION'"
            );
            assert.ok(Number(audit.n) >= 1);
        }
    );
    await t.test('concurrent receipts cannot allocate beyond an invoice balance', async () => {
        const created = await save('sales', {
            customer_id: customer.id,
            warehouse_id: warehouse.id,
            invoice_date: day,
            items: [{ product_id: product.id, quantity_pcs: 1, unit_price: '100' }]
        });
        await post('sales', created.id);
        const body = {
            customer_id: customer.id,
            payment_account_id: '1',
            receipt_date: day,
            amount: '100',
            allocations: [{ document_id: created.id, amount: '100' }]
        };
        const first = await save('receipts', body);
        const second = await save('receipts', body);
        const results = await Promise.allSettled([post('receipts', first.id), post('receipts', second.id)]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(
            (await reports.openItems('customer', customer.id)).find((i) => String(i.id) === created.id)
                .outstanding,
            '0.00'
        );
    });
    await t.test('repeated posting of every financial document has no repeated effects', async () => {
        const [[before]] = await db.query(
            'SELECT (SELECT COUNT(*) FROM journal_entries) journals,(SELECT COUNT(*) FROM stock_movements) movements'
        );
        for (const kind of [
            'sales',
            'grns',
            'receipts',
            'payments',
            'sales-returns',
            'purchase-returns',
            'adjustments'
        ]) {
            const [table] = ops.definitions[kind];
            const [[record]] = await db.query(
                `SELECT id FROM ${table} WHERE status='POSTED' ORDER BY id DESC LIMIT 1`
            );
            await Promise.all([post(kind, record.id), post(kind, record.id)]);
        }
        const [[after]] = await db.query(
            'SELECT (SELECT COUNT(*) FROM journal_entries) journals,(SELECT COUNT(*) FROM stock_movements) movements'
        );
        assert.deepEqual(after, before);
    });
    await t.test(
        'outstanding as of a past date includes zero balances for parties with only later activity',
        async () => {
            const data = await reports.report('customer-outstanding', {
                to: '2020-01-01',
                customer_id: customer.id
            });
            assert.equal(data.rows.length, 1);
            assert.equal(data.rows[0].balance, '0.00');
        }
    );
    const featureFixtures = await require('./featureWorkflows')(t, {
        db,
        ops,
        catalog,
        reports,
        journals,
        user,
        key,
        save,
        post
    });
    const productLedgerFixtures = await require('./productLedgers')(t, {
        db,
        ops,
        catalog,
        reports,
        user,
        save,
        post
    });
    await t.test(
        'authenticated HTTP APIs enforce roles, revoke sessions and export real ledger files',
        async () => {
            const app = require('../src/app');
            const server = await new Promise((resolve) => {
                const s = app.listen(0, '127.0.0.1', () => resolve(s));
            });
            const origin = `http://127.0.0.1:${server.address().port}`;
            require('../src/config').frontend_origin = origin;
            const request = async (url, options = {}) =>
                fetch(origin + '/api/v1' + url, {
                    ...options,
                    headers: { 'Content-Type': 'application/json', ...options.headers }
                });
            try {
                assert.equal((await request('/products')).status, 401);
                const login = await request('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'test@example.invalid', password: 'Test-only-password' })
                });
                assert.equal(login.status, 200);
                const auth = (await login.json()).data;
                assert.equal(auth.admin.role, 'ADMIN');
                assert.ok(!('password_hash' in auth.admin));
                const headers = { Authorization: `Bearer ${auth.accessToken}` };
                await require('./featureWorkflows').verifyHttp({ db, user, request, headers });
                await require('./productLedgers').verifyHttp({
                    db,
                    user,
                    request,
                    headers,
                    fixture: productLedgerFixtures
                });
                const malicious = await request('/products?search=' + encodeURIComponent("%' OR 1=1 --"), {
                    headers
                });
                assert.equal(malicious.status, 200);
                assert.equal((await malicious.json()).data.length, 0);
                const pdf = await request('/reports/customer-ledger?format=pdf', { headers });
                assert.equal(pdf.status, 200);
                assert.equal(
                    Buffer.from(await pdf.arrayBuffer())
                        .subarray(0, 4)
                        .toString(),
                    '%PDF'
                );
                const xlsx = await request('/reports/supplier-ledger?format=xlsx', { headers });
                assert.equal(xlsx.status, 200);
                assert.equal(
                    Buffer.from(await xlsx.arrayBuffer())
                        .subarray(0, 2)
                        .toString(),
                    'PK'
                );
                await db.execute("UPDATE users SET role='CASHIER' WHERE id=?", [user.id]);
                assert.equal((await request('/users', { headers })).status, 403);
                assert.equal((await request('/reports/profit-loss', { headers })).status, 403);
                await db.execute("UPDATE users SET role='ADMIN' WHERE id=?", [user.id]);
                const refreshes = await Promise.all([
                    request('/auth/refresh', {
                        method: 'POST',
                        body: JSON.stringify({ refreshToken: auth.refreshToken })
                    }),
                    request('/auth/refresh', {
                        method: 'POST',
                        body: JSON.stringify({ refreshToken: auth.refreshToken })
                    })
                ]);
                assert.equal(refreshes.filter((r) => r.status === 200).length, 1);
                assert.equal(refreshes.filter((r) => r.status === 401).length, 1);
                assert.equal((await request('/auth/me', { headers })).status, 401);
                const active = await refreshes.find((r) => r.status === 200).json();
                const freshHeaders = { Authorization: `Bearer ${active.data.accessToken}` };
                assert.equal(
                    (await request('/auth/logout', { method: 'POST', headers: freshHeaders, body: '{}' }))
                        .status,
                    200
                );
                assert.equal((await request('/auth/me', { headers: freshHeaders })).status, 401);
                if (
                    require('fs').existsSync('/usr/bin/chromium') &&
                    require('fs').existsSync(
                        require('path').resolve(__dirname, '../../frontend/dist/index.html')
                    )
                ) {
                    const artifacts = await require('./browser')(origin, customer.id, {
                        ...featureFixtures,
                        browserSale: {
                            productId: product.id,
                            warehouseId: warehouse.id,
                            customerId: customer.id
                        }
                    });
                    assert.ok(artifacts.desktop);
                }
            } finally {
                await new Promise((resolve) => server.close(resolve));
            }
        }
    );
    await t.test('inventory quantities, valuation and every journal reconcile', async () => {
        const r = await reports.reconciliation();
        assert.equal(r.inventory_difference, '0.00');
        assert.equal(r.trial_balance_difference, '0.00');
        assert.equal(Number(r.unbalanced_journals), 0);
        assert.equal(Number(r.stock_quantity_mismatches), 0);
        assert.equal(Number(r.unassigned_party_lines), 0);
    });
});
