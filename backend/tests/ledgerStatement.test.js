const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const {
    buildSupplierStatement,
    buildReportStatement,
    formatStatementValue,
    headerBands
} = require('../src/modules/reports/ledgerStatement.layout');
const { renderLedgerStatementPdf } = require('../src/modules/reports/ledgerStatement.pdf');
const { ledgerStatementSheet } = require('../src/modules/reports/ledgerStatement.excel');

const company = { company_code: 'SAMPLE', company_name: 'Sample Trading Company' };
const supplierFixture = () => {
    const records = [
        { party_id: '1', company: 'Supplier One', debit: '0', credit: '1000' },
        { party_id: '1', company: 'Supplier One', debit: '400', credit: '0' },
        { party_id: '2', company: 'Supplier Two', debit: '300', credit: '200' }
    ];
    const rows = records.map((record, index) => ({
        'GL Date': '2026-10-26',
        Voucher: `SP-${String(index).padStart(24, '0')}`,
        Supplier: record.company,
        'Transaction Type': index ? 'PAYMENTS' : 'OPENING_BALANCE',
        Reference: 'SAMPLE',
        Debit: record.debit,
        Credit: record.credit,
        'Closing Balance': index === 2 ? '-100' : '600'
    }));
    const statement = buildSupplierStatement({
        records,
        rows,
        suppliers: [
            { id: '1', name: 'Supplier One', address: 'Sample address', phone: '000001' },
            { id: '2', name: 'Supplier Two' }
        ],
        company,
        filters: {}
    });
    return { rows, statement, period: { from: '2026-10-01', to: '2026-10-26' } };
};
const reportFixture = (name, count = 4) => {
    const stock = name === 'stock-movements';
    const rows = Array.from({ length: count }, (_, index) =>
        stock
            ? {
                  warehouse_id: '1',
                  warehouse: 'Main Store',
                  product_id: '1',
                  sku: 'SAMPLE-01',
                  product: 'Battery',
                  occurred_at: '2026-10-26 10:00:00',
                  movement_type: index % 2 ? 'SALE' : 'GRN',
                  source_type: index % 2 ? 'SALE' : 'GRN',
                  source_line_id: String(index + 1),
                  quantity_delta_pcs: index % 2 ? -2 : 5,
                  unit_cost: '1234.5678'
              }
            : {
                  gl_date: '2026-10-26',
                  voucher_no: `JV-${String(index).padStart(24, '0')}`,
                  source_type: 'ADJUSTMENT',
                  reference_no: 'SAMPLE',
                  code: 'CASH',
                  name: 'Cash account',
                  payment_account_id: '1',
                  payment_account: 'Showroom Cash',
                  debit: '100.01',
                  credit: '20.02'
              }
    );
    const groups = count
        ? [
              stock
                  ? {
                        warehouse_id: '1',
                        warehouse: 'Main Store',
                        product_id: '1',
                        sku: 'SAMPLE-01',
                        product: 'Battery',
                        activity_count: count,
                        quantity_in: String(Math.ceil(count / 2) * 5),
                        quantity_out: String(Math.floor(count / 2) * 2),
                        quantity_delta_pcs: String(Math.ceil(count / 2) * 5 - Math.floor(count / 2) * 2)
                    }
                  : {
                        code: 'CASH',
                        name: 'Cash account',
                        payment_account_id: '1',
                        payment_account: 'Showroom Cash',
                        activity_count: count,
                        debit: (count * 100.01).toFixed(2),
                        credit: (count * 20.02).toFixed(2)
                    }
          ]
        : [];
    return {
        rows,
        statement: buildReportStatement({ name, rows, groups, company }),
        period: { from: '2026-10-01', to: '2026-10-26' }
    };
};
const pdfFor = (result) =>
    new Promise((resolve, reject) => {
        const response = new PassThrough(),
            chunks = [];
        response.setHeader = () => {};
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('finish', () => resolve(Buffer.concat(chunks)));
        renderLedgerStatementPdf(response, result, { printedAt: new Date('2026-10-26T10:00:00Z') });
    });
test('supplier statements preserve credit-minus-debit payable balances and negative credits by supplier', () => {
    const result = supplierFixture();
    assert.equal(result.statement.columns.length, 8);
    assert.equal(result.statement.sections[0].totals['Closing Balance'], '600.00');
    assert.equal(result.statement.sections[1].totals['Closing Balance'], '-100.00');
    assert.deepEqual(result.statement.totals, {
        Debit: '700.00',
        Credit: '1200.00',
        'Closing Balance': '500.00'
    });
    assert.equal(result.statement.sections[0].details[0][1], 'Supplier One (1)');
    const paged = buildSupplierStatement({
        records: [
            { party_id: '1', company: 'One', debit: '0', credit: '1000' },
            { party_id: '1', company: 'One', debit: '400', credit: '0' }
        ],
        rows: [],
        suppliers: [{ id: '1', name: 'One' }],
        company,
        filters: {},
        offset: 1,
        pageLength: 1
    });
    assert.deepEqual(paged.sections[0].indexes, [0]);
    assert.equal(paged.totals['Closing Balance'], '600.00');
});
test('general and cash ledger totals use all groups even when only one page of rows is visible', () => {
    for (const name of ['general-ledger', 'cash-bank']) {
        const rows = [
            {
                code: 'CASH',
                name: 'Cash',
                payment_account_id: '1',
                payment_account: 'Cash',
                debit: '0.10',
                credit: '0.03'
            }
        ];
        const groups = [
            {
                code: 'CASH',
                name: 'Cash',
                payment_account_id: '1',
                payment_account: 'Cash',
                activity_count: 8,
                debit: '1000.10',
                credit: '600.03'
            },
            {
                code: 'BANK',
                name: 'Bank',
                payment_account_id: '2',
                payment_account: 'Bank',
                activity_count: 4,
                debit: '10.01',
                credit: '40.02'
            }
        ];
        const result = buildReportStatement({ name, rows, groups, company });
        assert.equal(result.totals.net_movement, '370.06');
        assert.equal(rows[0].net_movement, '0.07');
        assert.equal(result.sections[1].indexes.length, 0);
        assert.equal(result.sections[1].activityCount, 4);
        assert.ok(result.note.includes('not an opening or closing balance'));
    }
});
test('stock movement statements retain whole PCS, separate in/out quantities and four-place unit costs', () => {
    const result = reportFixture('stock-movements');
    assert.deepEqual(result.statement.totals, {
        quantity_in: '10',
        quantity_out: '4',
        quantity_delta_pcs: '6'
    });
    assert.equal(result.rows[1].quantity_out, '2');
    assert.equal(formatStatementValue('1234.5678', { type: 'cost' }), '1,234.5678');
    assert.equal(formatStatementValue('-2000', { type: 'quantity' }), '-2,000');
    assert.equal(result.rows[1].movement_reference, 'SALE #2');
    assert.equal(
        headerBands(result.statement.columns).find((band) => band.group === 'Quantity (PCS)').span,
        3
    );
});
test('all ledger formats export bordered A4 landscape PDFs with complete text and multipage support', async () => {
    const samples = [
        supplierFixture(),
        ...['general-ledger', 'cash-bank', 'stock-movements'].map((name) => reportFixture(name, 90))
    ];
    for (const result of samples) {
        const buffer = await pdfFor(result);
        assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
        assert.match(buffer.toString('latin1'), /\/MediaBox \[0 0 841\.89 595\.28\]/);
        if (result.rows.length === 90)
            assert.ok((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 2);
    }
});
test('empty ledger exports retain the complete layout and zero totals', async () => {
    for (const name of ['general-ledger', 'cash-bank', 'stock-movements']) {
        const result = reportFixture(name, 0),
            buffer = await pdfFor(result);
        assert.ok(result.statement.columns.length >= 8);
        assert.equal((buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
        assert.ok(Object.values(result.statement.totals).every((value) => Number(value) === 0));
    }
});
test('Excel ledger exports preserve report headings, grouped columns, subtotals and print setup', async () => {
    const ExcelJS = require('exceljs');
    for (const result of [
        supplierFixture(),
        ...['general-ledger', 'cash-bank', 'stock-movements'].map((name) => reportFixture(name))
    ]) {
        const workbook = new ExcelJS.Workbook();
        ledgerStatementSheet(workbook, result);
        const loaded = new ExcelJS.Workbook();
        await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
        const sheet = loaded.worksheets[0];
        assert.equal(sheet.columnCount, result.statement.columns.length);
        assert.equal(sheet.getCell('A1').value, 'Sample Trading Company');
        assert.equal(sheet.getCell('A2').value, result.statement.title);
        assert.equal(sheet.pageSetup.orientation, 'landscape');
        assert.ok(
            sheet
                .getRows(1, sheet.rowCount)
                .some((row) => row.getCell(1).value === result.statement.totalLabel)
        );
    }
});
