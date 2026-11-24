// Verifies the demo loader only in a fresh, randomly named test database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const sourceDatabase = process.env.POS_SCHEMA_DB || 'batteryPos';
const testDatabase = `batteryPos_test_${crypto.randomBytes(8).toString('hex')}`;
let admin, db, seedDemo, DEMO_PASSWORD, result;
const fingerprints = async () => {
    const [tables] = await db.query('SHOW TABLES');
    const hashes = {};
    for (const entry of tables) {
        const table = Object.values(entry)[0];
        assert.match(table, /^[a-z_]+$/);
        const [rows] = await db.query(`SELECT * FROM ${table}`);
        hashes[table] = crypto
            .createHash('sha256')
            .update(JSON.stringify(rows.map((row) => JSON.stringify(row)).sort()))
            .digest('hex');
    }
    return hashes;
};
before(async () => {
    assert.match(sourceDatabase, /^[A-Za-z][A-Za-z0-9_]*$/);
    assert.match(testDatabase, /^batteryPos_test_[a-f0-9]{16}$/);
    admin = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 4406),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD ?? 'root'
    });
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
    ({ seedDemo, DEMO_PASSWORD } = require('../src/db/demo'));
    for (const [code, type] of [
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
    ])
        await db.execute('INSERT INTO chart_of_accounts (code,name,account_type) VALUES (?,?,?)', [
            code,
            code,
            type
        ]);
    await db.execute(
        "INSERT INTO users (name,email,password_hash,role) VALUES ('Existing admin','existing@example.test',?,'ADMIN')",
        [await bcrypt.hash('Existing-only-test-password', 4)]
    );
    await db.execute("INSERT INTO products (sku,name) VALUES ('KEEP-EXISTING','Existing product')");
    await db.execute(
        "INSERT INTO company_settings (id,company_code,company_name,address) VALUES (1,'KEEP','Existing Company','Existing Address')"
    );
});
after(async () => {
    if (db) await db.end();
    if (admin) {
        if (/^batteryPos_test_[a-f0-9]{16}$/.test(testDatabase))
            await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
        await admin.end();
    }
});
test('demo dataset covers the workflows, preserves existing records and safely resumes', async (t) => {
    const [[existingUser]] = await db.query("SELECT * FROM users WHERE email='existing@example.test'");
    const [[existingProduct]] = await db.query("SELECT * FROM products WHERE sku='KEEP-EXISTING'");
    const [[company]] = await db.query('SELECT * FROM company_settings WHERE id=1');
    await t.test(
        'loads realistic data through transactional services without modifying existing masters',
        async () => {
            const interruption = new Error('Simulated demo loader interruption');
            await assert.rejects(
                () =>
                    seedDemo({
                        anchorDate: '2026-10-26',
                        onProgress: (message) => {
                            if (message.startsWith('Posting 37 sales')) throw interruption;
                        }
                    }),
                interruption
            );
            result = await seedDemo({ anchorDate: '2026-10-26' });
            assert.equal(result.products.length, 13);
            assert.equal(result.customers.length, 12);
            assert.equal(result.suppliers.length, 4);
            assert.equal(result.warehouses.length, 3);
            assert.equal(result.paymentAccounts.length, 5);
            assert.equal(
                result.documents.filter((row) => row.kind === 'sales' && row.status === 'POSTED').length,
                37
            );
            for (const kind of Object.keys(
                require('../src/modules/operations/operations.service').definitions
            )) {
                assert.ok(
                    result.documents.some((row) => row.kind === kind && row.status === 'DRAFT'),
                    `Missing ${kind} draft`
                );
                assert.ok(
                    result.documents.some((row) => row.kind === kind && row.status !== 'DRAFT'),
                    `Missing posted ${kind}`
                );
            }
            assert.deepEqual(
                (await db.query("SELECT * FROM users WHERE email='existing@example.test'"))[0][0],
                existingUser
            );
            assert.deepEqual(
                (await db.query("SELECT * FROM products WHERE sku='KEEP-EXISTING'"))[0][0],
                existingProduct
            );
            assert.deepEqual((await db.query('SELECT * FROM company_settings WHERE id=1'))[0][0], company);
            const [users] = await db.execute('SELECT role,password_hash FROM users WHERE email LIKE ?', [
                'demo.%@batterypos.test'
            ]);
            assert.equal(new Set(users.map((row) => row.role)).size, 6);
            for (const user of users) assert.ok(await bcrypt.compare(DEMO_PASSWORD, user.password_hash));
        }
    );
    await t.test('stock, journals, returns, advances and pending receiving reconcile', async () => {
        const report = require('../src/modules/reports/reports.service');
        const reconciliation = await report.reconciliation();
        for (const field of [
            'inventory_difference',
            'trial_balance_difference',
            'unbalanced_journals',
            'stock_quantity_mismatches',
            'unassigned_party_lines'
        ]) {
            assert.equal(Number(reconciliation[field]), 0, field);
        }
        const advance = await report.ledger('customer', { customer_id: result.customers[10].id });
        assert.equal(advance.totals.closing, '-5000.00');
        const invoice = await require('../src/modules/operations/operations.service').get(
            'sales',
            result.documents.find((row) => row.label === 'sale-0').id
        );
        assert.equal(invoice.previous_due_snapshot, '12000.00');
        const pending = await require('../src/modules/operations/operations.service').pendingPurchases({});
        assert.equal(pending.meta.total, 2);
        const dashboard = await report.dashboard({ from: result.from, to: result.to });
        assert.ok(Number(dashboard.customer_collections) > 0);
        assert.ok(Number(dashboard.today_collection) >= 0);
        const [[unallocated]] = await db.execute(
            'SELECT amount FROM customer_receipt_allocations WHERE receipt_id=?',
            [result.documents.find((row) => row.label === 'receipt-later-allocation').id]
        );
        assert.equal(unallocated.amount, '1000.00');
        const [[reversed]] = await db.query(
            "SELECT COUNT(*) total FROM journal_entries WHERE source_type='REVERSAL'"
        );
        assert.equal(Number(reversed.total), 2);
    });
    await t.test('rerunning with a later date inserts no rows and changes no data', async () => {
        const before = await fingerprints();
        const replay = await seedDemo({ anchorDate: '2026-11-15' });
        assert.equal(replay.to, '2026-10-26');
        assert.deepEqual(replay.documents, result.documents);
        assert.deepEqual(await fingerprints(), before);
    });
});
