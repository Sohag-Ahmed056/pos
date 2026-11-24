const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas: catalog } = require('../src/modules/catalog/catalog.validation');
const { schemas, date } = require('../src/modules/operations/operations.validation');
test('currency amounts cannot silently round away extra decimal places', () => {
    assert.throws(() =>
        schemas.receipts.parse({
            customer_id: '1',
            payment_account_id: '1',
            receipt_date: '2026-10-25',
            amount: '0.001'
        })
    );
    assert.equal(
        catalog.products.parse({ sku: 'FOUR-DECIMALS', name: 'Battery', selling_price: '1.2345' })
            .selling_price,
        '1.2345'
    );
});
test('product master excludes stock and protects the SKU', () => {
    assert.throws(() => catalog.products.parse({ sku: '', name: 'Battery' }));
    assert.throws(() => catalog.products.parse({ sku: 'BAT', name: 'Battery', stock: 10 }));
    assert.throws(() => catalog.products.parse({ sku: 'BAT', name: 'Battery', reorder_level_pcs: 1.5 }));
});
test('identity numbers remain textual and retain leading zeroes', () => {
    const customer = catalog.customers.parse({ name: 'Retail shop', nid_number: '0012345' });
    assert.equal(customer.nid_number, '0012345');
    assert.throws(() => catalog.customers.parse({ name: 'Test', nid_number: 12345 }));
});
test('dates reject impossible calendar days', () => {
    assert.throws(() => date.parse('2026-02-30'));
    assert.equal(date.parse('2026-02-28'), '2026-02-28');
});
test('document validation enforces individual products and whole PCS', () => {
    const base = { customer_id: '1', warehouse_id: '1', invoice_date: '2026-10-25' };
    assert.throws(() =>
        schemas.sales.parse({ ...base, items: [{ product_id: '1', quantity_pcs: 0.5, unit_price: '20' }] })
    );
    assert.throws(() =>
        schemas.sales.parse({
            ...base,
            items: [
                { product_id: '1', quantity_pcs: 1, unit_price: '20' },
                { product_id: '1', quantity_pcs: 2, unit_price: '20' }
            ]
        })
    );
    assert.throws(() =>
        schemas.sales.parse({
            ...base,
            items: [{ product_id: '1', quantity_pcs: 1, unit_price: '20' }],
            previous_due: 2000
        })
    );
});
