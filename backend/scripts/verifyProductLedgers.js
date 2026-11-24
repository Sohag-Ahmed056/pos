// Read-only verification against the configured database; no seed/reset/migration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const db = require('../src/config/db');
const service = require('../src/modules/reports/productLedger.service');
const reports = require('../src/modules/reports/reports.service');
const { exportResult } = require('../src/modules/reports/productLedger.controller');
const { D, sum } = require('../src/shared/financial');
const fingerprint = async () =>
    (
        await db.query(`SELECT
    (SELECT COUNT(*) FROM journal_entries) journals,(SELECT COUNT(*) FROM journal_lines) journal_lines,
    (SELECT COUNT(*) FROM stock_movements) movements,(SELECT COUNT(*) FROM audit_logs) audits,
    (SELECT COALESCE(SUM(debit),0) FROM journal_lines) debit,(SELECT COALESCE(SUM(credit),0) FROM journal_lines) credit`)
    )[0][0];
const run = async () => {
    const before = await fingerprint();
    const baselineDirectory = process.env.POS_LEDGER_BASELINE;
    if (baselineDirectory)
        for (const kind of ['customer', 'supplier']) {
            const expected = JSON.parse(
                fs.readFileSync(path.join(baselineDirectory, `${kind}-baseline.json`), 'utf8')
            );
            assert.deepEqual(
                await reports.ledger(kind, { from: '2026-09-01', to: '2026-10-31' }, true),
                expected
            );
        }
    const [products] = await db.query('SELECT id FROM products ORDER BY id');
    for (const product of products) {
        const result = await service.productLedger(product.id, {}, true);
        assert.equal(result.stock.reconciled, true, `Product ${product.id}: stock quantity`);
        assert.equal(
            result.stock.closing_value,
            result.stock.current_value,
            `Product ${product.id}: historical book valuation`
        );
        assert.equal(result.stock.closing, result.stock.current_quantity);
    }
    const [customers] = await db.query(
        "SELECT DISTINCT customer_id id FROM sales_invoices WHERE status='POSTED'"
    );
    for (const customer of customers) {
        const result = await service.partyLedger('customer', customer.id, {}, true);
        const [[expected]] = await db.query(
            `SELECT
            (SELECT COALESCE(SUM(total_amount),0) FROM sales_invoices WHERE customer_id=? AND status='POSTED')-
            (SELECT COALESCE(SUM(r.total_amount),0) FROM sales_returns r JOIN sales_invoices s ON s.id=r.sales_invoice_id
             WHERE s.customer_id=? AND s.status='POSTED' AND r.status='POSTED') net`,
            [customer.id, customer.id]
        );
        assert.equal(result.totals.amount, expected.net);
    }
    const [suppliers] = await db.query('SELECT DISTINCT supplier_id id FROM purchases');
    for (const supplier of suppliers) {
        const result = await service.partyLedger('supplier', supplier.id, {}, true);
        const [[expected]] = await db.query(
            `SELECT
            (SELECT COALESCE(SUM(i.line_amount),0) FROM goods_receipt_items i JOIN goods_receipts g ON g.id=i.goods_receipt_id
             JOIN purchases p ON p.id=g.purchase_id WHERE p.supplier_id=? AND g.status='POSTED')-
            (SELECT COALESCE(SUM(r.total_amount),0) FROM purchase_returns r JOIN goods_receipts g ON g.id=r.goods_receipt_id
             JOIN purchases p ON p.id=g.purchase_id WHERE p.supplier_id=? AND r.status='POSTED') net`,
            [supplier.id, supplier.id]
        );
        assert.equal(result.totals.amount, expected.net);
    }
    const artifacts = path.resolve(__dirname, '../artifacts');
    fs.mkdirSync(artifacts, { recursive: true });
    const [[customer]] = await db.query(
        "SELECT h.customer_id id FROM sales_returns r JOIN sales_invoices h ON h.id=r.sales_invoice_id WHERE r.status='POSTED' LIMIT 1"
    );
    const [[supplier]] = await db.query(
        "SELECT p.supplier_id id FROM purchase_returns r JOIN goods_receipts g ON g.id=r.goods_receipt_id JOIN purchases p ON p.id=g.purchase_id WHERE r.status='POSTED' LIMIT 1"
    );
    const [[product]] = await db.query(
        'SELECT product_id id FROM stock_movements GROUP BY product_id ORDER BY COUNT(*) DESC LIMIT 1'
    );
    for (const [name, result] of [
        [
            'customer-product-ledger-demo',
            customer && (await service.partyLedger('customer', customer.id, {}, true))
        ],
        [
            'supplier-product-ledger-demo',
            supplier && (await service.partyLedger('supplier', supplier.id, {}, true))
        ],
        ['product-stock-ledger-demo', product && (await service.productLedger(product.id, {}, true))]
    ]) {
        if (!result) continue;
        fs.writeFileSync(path.join(artifacts, `${name}.json`), JSON.stringify(result, null, 2));
        for (const format of ['pdf', 'xlsx']) {
            const output = fs.createWriteStream(path.join(artifacts, `${name}.${format}`));
            output.setHeader = () => {};
            const finished = once(output, 'finish');
            await exportResult(output, result, format);
            await finished;
        }
        assert.equal(
            sum(result.rows.map((row) => D(row.amount || 0))).toFixed(2),
            D(result.totals.amount || 0).toFixed(2)
        );
    }
    assert.deepEqual(await fingerprint(), before);
    console.log(
        `Read-only validation passed: ${products.length} products, ${customers.length} customers, ${suppliers.length} suppliers. ${baselineDirectory ? 'Financial baselines unchanged. ' : ''}Business-data counts/totals unchanged. PDF/Excel previews saved in backend/artifacts.`
    );
};
run()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.end());
