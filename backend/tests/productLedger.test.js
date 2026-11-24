const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { filtersSchema, replayValuation } = require('../src/modules/reports/productLedger.service');

test('pre-enhancement customer and supplier financial reporting, layouts, exports and filters are byte-for-byte unchanged', () => {
    const root = path.resolve(__dirname, '../..');
    const baseline = require('./financialLedger.baseline.json');
    assert.ok(Object.keys(baseline).length >= 15);
    for (const [file, expected] of Object.entries(baseline))
        assert.equal(
            crypto
                .createHash('sha256')
                .update(fs.readFileSync(path.join(root, file)))
                .digest('hex'),
            expected,
            file
        );
});
test('product ledger filters reject unsafe identifiers, invalid dates, oversized pages and unknown movement types', () => {
    for (const value of [
        { from: '2026-02-30' },
        { from: '2026-10-01', to: '2026-09-01' },
        { product_id: '1 OR 1=1' },
        { limit: 101 },
        { page: 0 },
        { type: 'DRAFT' },
        { section: 'unrestricted' }
    ])
        assert.throws(() => filtersSchema.parse(value));
    assert.equal(filtersSchema.parse({ from: '', to: '', search: '  SKU  ' }).search, 'SKU');
});
test('historical valuation starts from stored outgoing average cost and replays incoming tails separately per warehouse', () => {
    const result = replayValuation([
        {
            warehouse_id: '1',
            warehouse_running_quantity: '3',
            anchor: 1,
            unit_cost: '0.3333',
            quantity_delta_pcs: -1
        },
        { warehouse_id: '2', anchor: 0, unit_cost: '20', quantity_delta_pcs: 2 },
        { warehouse_id: '1', anchor: 0, unit_cost: '1', quantity_delta_pcs: 1 }
    ]);
    assert.deepEqual(result, [
        { warehouse_id: '1', quantity: '4', avg_cost: '0.5000', value: '2.00' },
        { warehouse_id: '2', quantity: '2', avg_cost: '20.0000', value: '40.00' }
    ]);
});
test('valuation rejects an outgoing movement without its historical anchor', () => {
    assert.throws(() =>
        replayValuation([{ warehouse_id: '1', anchor: 0, quantity_delta_pcs: -1, unit_cost: '1' }])
    );
});
