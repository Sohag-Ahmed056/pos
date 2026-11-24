const test = require('node:test');
const assert = require('node:assert/strict');
const { ledgerRows, customerColumns } = require('../src/modules/reports/reports.service');
test('Walton ledger has exactly eleven visible columns and reconciling subtotals', () => {
    const base = {
        party_id: '1',
        company: 'Store',
        party_snapshot: 'Retail',
        area_snapshot: 'Dhaka',
        sales_channel_snapshot: 'Dealer',
        gl_date: '2026-10-25',
        reference_no: null
    };
    const records = [
        {
            ...base,
            voucher_no: 'OPEN',
            source_type: 'OPENING_BALANCE',
            debit: '2000',
            credit: '0',
            running_balance: '2000'
        },
        {
            ...base,
            voucher_no: 'SI-1',
            source_type: 'SALES',
            debit: '7300',
            credit: '0',
            running_balance: '9300'
        },
        {
            ...base,
            voucher_no: 'CR-1',
            source_type: 'RECEIPTS',
            debit: '0',
            credit: '3000',
            running_balance: '6300'
        }
    ];
    const result = ledgerRows(records, false);
    assert.equal(customerColumns.length, 11);
    assert.deepEqual(Object.keys(result.rows[0]), customerColumns);
    assert.equal(result.rows[2]['Closing Balance'], '6300.00');
    assert.equal(result.rows[2]['Credit — Collection'], '3000.00');
    assert.equal(result.totals.opening, '2000.00');
    assert.equal(result.totals.debit, '7300.00');
    assert.equal(result.totals.closing, '6300.00');
    for (const type of ['customer', 'party', 'area', 'sales_channel'])
        assert.equal(result.subtotals[type][0].closing, '6300.00');
});
test('customer advances keep their negative balance', () => {
    const result = ledgerRows(
        [
            {
                party_id: '1',
                company: 'Buyer',
                source_type: 'RECEIPTS',
                debit: '0',
                credit: '100',
                running_balance: '-100'
            }
        ],
        false
    );
    assert.equal(result.totals.closing, '-100.00');
    assert.equal(result.rows[0]['Closing Balance'], '-100.00');
});
