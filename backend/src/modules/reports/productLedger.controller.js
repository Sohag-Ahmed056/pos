const service = require('./productLedger.service');
const catchAsync = require('../../shared/catchAsync');
const { renderLedgerStatementPdf } = require('./ledgerStatement.pdf');
const { ledgerStatementSheet } = require('./ledgerStatement.excel');

// These export handlers are independent of the existing financial report controller.
const exportResult = async (res, result, format) => {
    if (['pdf', 'print'].includes(format)) {
        // Product subtotals use their own section. They are never added to grand totals.
        const rows = [...result.rows];
        const sections = [...result.statement.sections];
        if (result.products?.length) {
            const indexes = result.products.map((row) => {
                rows.push({
                    ...row,
                    type: 'PRODUCT TOTAL',
                    voucher: 'Subtotal',
                    rate: null,
                    adjusted_rate: null
                });
                return rows.length - 1;
            });
            sections.push({
                id: 'products',
                details: [
                    [
                        'Product Summary',
                        'Same filtered activity, grouped by product. Subtotals do not add to transaction totals.'
                    ]
                ],
                indexes,
                trailers: []
            });
        }
        // The shared renderer's visual contract is reused without modifying its code.
        renderLedgerStatementPdf(
            res,
            { ...result, rows, statement: { ...result.statement, sections } },
            { inline: format === 'print' }
        );
        return;
    }
    if (format === 'xlsx') {
        const workbook = new (require('exceljs').Workbook)();
        ledgerStatementSheet(workbook, result);
        const extraSheet = (name, rows) => {
            if (!rows?.length) return;
            const sheet = workbook.addWorksheet(name);
            sheet.columns = Object.keys(rows[0]).map((key) => ({
                header: key.replaceAll('_', ' '),
                key,
                width: 24
            }));
            rows.forEach((row) => sheet.addRow(row));
            sheet.getRow(1).font = { bold: true };
            sheet.views = [{ state: 'frozen', ySplit: 1 }];
            sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columnCount } };
        };
        extraSheet('Product summary', result.products);
        if (result.selection.sku) extraSheet('Product profile', [result.selection]);
        extraSheet('Warehouse stock', result.warehouses);
        extraSheet('Stock summary', result.stock && [result.stock]);
        extraSheet('Report scope', [
            { from: result.period.from, to: result.period.to, ...result.filters, note: result.note }
        ]);
        if (result.profitability) extraSheet('Profitability limitation', [result.profitability]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${result.name}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
        return;
    }
    res.json({ success: true, message: 'Product ledger generated', data: result, meta: result.meta });
};
const handler = (kind) =>
    catchAsync(async (req, res) => {
        const format = req.query.format;
        const all = ['pdf', 'print', 'xlsx'].includes(format);
        const result =
            kind === 'product'
                ? await service.productLedger(req.params.id, req.query, all)
                : await service.partyLedger(kind, req.params.id, req.query, all);
        await exportResult(res, result, format);
    });
module.exports = { handler, exportResult };
