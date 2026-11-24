const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { ledgerRows, customerColumns } = require('../src/modules/reports/reports.service');
const {
    buildCustomerLedgerLayout,
    formatAmount,
    formatDate
} = require('../src/modules/reports/customerLedger.layout');
const { renderCustomerLedgerPdf } = require('../src/modules/reports/customerLedger.pdf');
const { customerLedgerSheet } = require('../src/modules/reports/customerLedger.excel');
after(() => require('../src/config/db').end());

const fixture = (count = 4) => {
    let balance = 0;
    const records = Array.from({ length: count }, (_, index) => {
        const debit = index === 0 ? '2000' : index % 2 ? '7300' : '0';
        const credit = index > 0 && index % 2 === 0 ? '3000' : '0';
        balance += Number(debit) - Number(credit);
        return {
            party_id: '7',
            company: 'Sample Customer',
            party_snapshot: 'Sample Party',
            area_snapshot: 'Gazipur',
            sales_channel_snapshot: 'Dealer',
            gl_date: '2026-10-26',
            voucher_no: `JV-${String(index).padStart(24, '0')}`,
            reference_no: `REFERENCE-${index}`,
            source_type: index === 0 ? 'OPENING_BALANCE' : index % 2 ? 'SALES' : 'RECEIPTS',
            debit,
            credit,
            running_balance: String(balance)
        };
    });
    const result = ledgerRows(records, false);
    const customers = [{ id: '7', name: 'Sample Customer', address: 'Sample address, Gazipur' }];
    result.columns = customerColumns;
    result.period = { from: '2026-10-01', to: '2026-10-26' };
    result.layout = buildCustomerLedgerLayout({
        records,
        rows: result.rows,
        customers,
        company: { company_code: 'SAMPLE', company_name: 'Sample Trading Company' },
        filters: { customer_id: '7' }
    });
    return result;
};
const pdfFor = (result, inline = false) =>
    new Promise((resolve, reject) => {
        const response = new PassThrough();
        const chunks = [],
            headers = {};
        response.setHeader = (key, value) => {
            headers[key] = value;
        };
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('finish', () => resolve({ buffer: Buffer.concat(chunks), headers }));
        renderCustomerLedgerPdf(response, result, { inline, printedAt: new Date('2026-10-26T10:00:00Z') });
    });
test('reference ledger subtotals retain separate debit/credit categories and reconcile opening and running balances', () => {
    const result = fixture();
    const values = result.layout.totals;
    assert.equal(values['Debit — Sales'], '14600.00');
    assert.equal(values['Debit — Adjustment'], '2000.00');
    assert.equal(values['Credit — Collection'], '3000.00');
    assert.equal(values['Closing Balance'], '13600.00');
    assert.equal(values['Closing Balance'], result.totals.closing);
    assert.equal(result.layout.heading.customer, 'Sample Customer (7)');
    assert.deepEqual(result.layout.sections[0].indexes, [0, 1, 2, 3]);
    assert.deepEqual(
        result.layout.sections[0].trailers.map((row) => row.label),
        [
            'Customer (Sample Customer (7)) Sub Total:',
            'Party (Sample Party) Sub Total:',
            'Area (Gazipur) Sub Total:',
            'Sales Channel (Dealer) Sub Total:'
        ]
    );
    for (const subtotal of result.layout.sections[0].trailers) assert.deepEqual(subtotal.totals, values);
});
test('grouping retains historical snapshots, advances, returns and adjustments without combining unrelated customers', () => {
    const records = [
        {
            party_id: '1',
            company: 'One',
            party_snapshot: 'Old party',
            area_snapshot: 'Dhaka',
            sales_channel_snapshot: 'Dealer',
            source_type: 'RECEIPTS',
            debit: '0',
            credit: '100.01',
            running_balance: '-100.01'
        },
        {
            party_id: '1',
            company: 'One',
            party_snapshot: 'New party',
            area_snapshot: 'Dhaka',
            sales_channel_snapshot: 'Dealer',
            source_type: 'SALES_RETURNS',
            debit: '0',
            credit: '25.02',
            running_balance: '-125.03'
        },
        {
            party_id: '2',
            company: 'Two',
            party_snapshot: 'New party',
            area_snapshot: 'Dhaka',
            sales_channel_snapshot: 'Dealer',
            source_type: 'ADJUSTMENT',
            debit: '10.05',
            credit: '2.01',
            running_balance: '8.04'
        }
    ];
    const result = ledgerRows(records, false);
    const layout = buildCustomerLedgerLayout({
        records,
        rows: result.rows,
        customers: [
            { id: '1', name: 'One' },
            { id: '2', name: 'Two' }
        ],
        filters: {},
        company: null
    });
    assert.equal(layout.sections.length, 3);
    assert.equal(layout.totals['Credit — Return'], '25.02');
    assert.equal(layout.totals['Credit — Adjustment'], '2.01');
    assert.equal(layout.totals['Closing Balance'], '-116.99');
    assert.equal(
        layout.summaries.customer.find((row) => row.name === 'One (1)').totals['Closing Balance'],
        '-125.03'
    );
    assert.equal(
        layout.sections
            .flatMap((section) => section.trailers)
            .filter((row) => row.label.startsWith('Sales Channel')).length,
        1
    );
    assert.equal(layout.heading.party, 'Multiple');
});
test('PDF uses A4 landscape and correctly paginates full-length voucher numbers', async () => {
    const { buffer, headers } = await pdfFor(fixture(110), true);
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    assert.match(headers['Content-Disposition'], /^inline;/);
    assert.match(buffer.toString('latin1'), /\/MediaBox \[0 0 841\.89 595\.28\]/);
    assert.ok((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 3);
});
test('empty ledgers retain the selected customer heading and export a zero grand total', async () => {
    const result = fixture(0);
    assert.equal(result.layout.heading.customer, 'Sample Customer (7)');
    assert.equal(result.layout.totals['Closing Balance'], '0.00');
    const { buffer } = await pdfFor(result);
    assert.equal((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
});
test('a short customer statement keeps its grand total on the same page as long voucher numbers', async () => {
    const { buffer } = await pdfFor(fixture(11));
    assert.equal((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
});
test('Excel retains eleven columns, merged debit/credit headings, identity rows and numeric subtotals', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    customerLedgerSheet(workbook, fixture());
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = restored.worksheets[0];
    assert.equal(sheet.columnCount, 11);
    assert.equal(sheet.getCell('A1').value, 'Sample Trading Company');
    assert.equal(sheet.getCell('F9').value, 'Debit');
    assert.equal(sheet.getCell('H9').value, 'Credit');
    assert.equal(sheet.getCell('K9').value, 'Closing Balance');
    assert.equal(sheet.getCell('D8').value, 'Sample Customer (7)');
    const grand = sheet.getRows(1, sheet.rowCount).find((row) => row.getCell(1).value === 'Grand Total:');
    assert.equal(grand.getCell(11).value, '13,600.00');
    assert.equal(sheet.pageSetup.orientation, 'landscape');
});
test('reference dates and amounts use uppercase months, western commas and exact decimal strings', () => {
    assert.equal(formatDate('2026-10-26'), '26-OCT-26');
    assert.equal(formatDate('2026-10-26', true), '26-OCT-2026');
    assert.equal(formatAmount('-138821.92'), '-138,821.92');
    assert.equal(formatAmount('999999999999.99'), '999,999,999,999.99');
});
