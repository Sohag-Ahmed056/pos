const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { returnBases } = require('../src/shared/returns');
const { sum, proportional } = require('../src/shared/financial');
const { safeDetails } = require('../src/modules/reports/audit.service');
const db = require('../src/config/db');
after(() => db.end());

test('original return bases conserve line and invoice discounts across multiple products', () => {
    const rows = returnBases(
        [
            { quantity_pcs: 1, unit_price: '1', discount_amount: '0' },
            { quantity_pcs: 1, unit_price: '1.20', discount_amount: '.20' },
            { quantity_pcs: 1, unit_price: '1', discount_amount: '0' }
        ],
        true,
        '.01'
    );
    assert.deepEqual(
        rows.map((row) => row.return_basis_amount),
        ['1.00', '0.99', '1.00']
    );
    assert.equal(sum(rows.map((row) => row.return_basis_amount)).toFixed(2), '2.99');
});
test('partial purchase-return amounts conserve the final cent instead of rounding the unit rate first', () => {
    const [row] = returnBases([{ quantity_pcs: 3, line_amount: '1.00' }], false);
    assert.equal(row.return_unit_rate, '0.3333');
    assert.deepEqual(
        [0, 1, 2].map((before) => proportional(row.return_basis_amount, 3, before, 1).toFixed(2)),
        ['0.33', '0.34', '0.33']
    );
});
test('audit details hide credentials and session identifiers recursively while retaining business evidence', () => {
    const safe = safeDetails(
        JSON.stringify({
            reason: 'Correction',
            amount: '25.00',
            sid: 'private-session',
            nested: [{ refreshToken: 'private-token', password_hash: 'private-hash', return_id: '7' }]
        })
    );
    assert.deepEqual(safe, { reason: 'Correction', amount: '25.00', nested: [{ return_id: '7' }] });
    assert.equal(JSON.stringify(safe).includes('private'), false);
});

const workbookFor = async (result) => {
    const service = require('../src/modules/reports/reports.service');
    const controller = require('../src/modules/reports/reports.controller');
    const original = service.ledger;
    service.ledger = async () => result;
    const response = new PassThrough(),
        chunks = [];
    response.setHeader = () => {};
    response.on('data', (chunk) => chunks.push(chunk));
    try {
        await new Promise((resolve, reject) => {
            response.on('finish', resolve);
            response.on('error', reject);
            controller.ledger('customer')({ query: { format: 'xlsx' } }, response, reject);
        });
        const workbook = new (require('exceljs').Workbook)();
        await workbook.xlsx.load(Buffer.concat(chunks));
        return workbook;
    } finally {
        service.ledger = original;
    }
};
test('Excel ledger includes explicit whole-report totals without changing the eleven visible columns', async () => {
    const { customerColumns } = require('../src/modules/reports/reports.service');
    const workbook = await workbookFor({
        columns: customerColumns,
        rows: [],
        period: { from: '2026-01-01', to: '2026-01-31' },
        totals: { opening: '2000.00', debit: '7300.00', credit: '3000.00', closing: '6300.00' }
    });
    assert.equal(workbook.worksheets[0].columnCount, 11);
    const totals = workbook.getWorksheet('Grand totals');
    assert.ok(totals);
    assert.deepEqual(totals.getRow(6).values.slice(1), ['closing', '6300.00']);
    assert.equal(totals.getRow(2).getCell(2).value, '2026-01-01 to 2026-01-31');
});
test('empty Excel reports remain exportable and expense summaries have their own sheet', async () => {
    const workbook = await workbookFor({
        columns: [],
        rows: [],
        totals: { total_expenses: '0.00' },
        summary: { columns: ['expense_name', 'entries', 'total_amount'], rows: [] }
    });
    assert.ok(workbook.getWorksheet('Grand totals'));
    assert.ok(workbook.getWorksheet('Expense summary'));
});
