const service = require('./reports.service');
const catchAsync = require('../../shared/catchAsync');
const send = require('../../shared/sendResponse');
const { renderCustomerLedgerPdf } = require('./customerLedger.pdf');
const { customerLedgerSheet } = require('./customerLedger.excel');
const { renderLedgerStatementPdf } = require('./ledgerStatement.pdf');
const { ledgerStatementSheet } = require('./ledgerStatement.excel');
exports.audit = catchAsync(async (req, res) => {
    const result = await require('./audit.service').list(req.query);
    send(res, { statusCode: 200, success: true, message: 'Audit history retrieved', ...result });
});
const output = async (res, result, format, title) => {
    if (result.statement && ['pdf', 'print'].includes(format)) {
        renderLedgerStatementPdf(res, result, { inline: format === 'print' });
        return;
    }
    if (title === 'customer-ledger' && result.layout && ['pdf', 'print'].includes(format)) {
        renderCustomerLedgerPdf(res, result, { inline: format === 'print' });
        return;
    }
    if (format === 'xlsx') {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        if (result.statement) ledgerStatementSheet(workbook, result);
        else if (title === 'customer-ledger' && result.layout) customerLedgerSheet(workbook, result);
        else {
            const sheet = workbook.addWorksheet(title.slice(0, 31));
            sheet.columns = result.columns.map((key) => ({ header: key, key, width: 22 }));
            result.rows.forEach((row) => sheet.addRow(row));
            sheet.getRow(1).font = { bold: true };
            sheet.views = [{ state: 'frozen', ySplit: 1 }];
            if (result.columns.length)
                sheet.autoFilter = { from: 'A1', to: { row: 1, column: result.columns.length } };
        }
        if (result.totals) {
            const totals = workbook.addWorksheet('Grand totals');
            totals.columns = [
                { header: 'Metric', key: 'metric', width: 30 },
                { header: 'Amount (BDT)', key: 'amount', width: 24 }
            ];
            if (result.period)
                totals.addRow({
                    metric: 'Report period',
                    amount: `${result.period.from} to ${result.period.to}`
                });
            for (const [metric, amount] of Object.entries(result.totals))
                totals.addRow({ metric: metric.replaceAll('_', ' '), amount });
            totals.getRow(1).font = { bold: true };
        }
        if (result.summary) {
            const summary = workbook.addWorksheet('Expense summary');
            summary.columns = result.summary.columns.map((key) => ({ header: key, key, width: 26 }));
            result.summary.rows.forEach((row) => summary.addRow(row));
            summary.getRow(1).font = { bold: true };
        }
        if (result.subtotals)
            for (const [group, subtotals] of Object.entries(result.subtotals)) {
                const summary = workbook.addWorksheet(`${group} subtotals`.slice(0, 31));
                summary.columns = ['name', 'opening', 'debit', 'credit', 'closing'].map((key) => ({
                    header: key,
                    key,
                    width: 25
                }));
                subtotals.forEach((row) => summary.addRow(row));
            }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${title}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
        return;
    }
    if (format === 'pdf' || format === 'print') {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `${format === 'print' ? 'inline' : 'attachment'}; filename="${title}.pdf"`
        );
        doc.pipe(res);
        doc.fontSize(16).text(title.replaceAll('-', ' '));
        if (result.period) doc.fontSize(9).text(`${result.period.from} to ${result.period.to}`);
        doc.moveDown();
        const width = (doc.page.width - 56) / Math.max(result.columns.length, 1);
        let y = doc.y;
        const row = (values, bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7);
            let height = 24;
            values.forEach((value) => {
                height = Math.max(height, doc.heightOfString(String(value ?? ''), { width: width - 8 }) + 10);
            });
            if (y + height > doc.page.height - 28) {
                doc.addPage();
                y = 28;
            }
            values.forEach((value, i) =>
                doc.text(String(value ?? ''), 28 + i * width, y, { width: width - 8, height })
            );
            y += height;
        };
        row(result.columns, true);
        result.rows.forEach((r) => row(result.columns.map((c) => r[c])));
        if (result.totals) {
            row(['Grand totals'], true);
            Object.entries(result.totals).forEach(([key, value]) => row([key.replaceAll('_', ' '), value]));
        }
        if (result.summary) {
            row(['Expense summary'], true);
            row(result.summary.columns, true);
            result.summary.rows.forEach((r) => row(result.summary.columns.map((c) => r[c])));
        }
        if (result.subtotals)
            for (const [group, groups] of Object.entries(result.subtotals)) {
                row([`${group} subtotals`], true);
                groups.forEach((g) =>
                    row([
                        g.name,
                        `Opening: ${g.opening}`,
                        `Debit: ${g.debit}`,
                        `Credit: ${g.credit}`,
                        `Closing: ${g.closing}`
                    ])
                );
            }
        doc.end();
        return;
    }
    send(res, {
        statusCode: 200,
        success: true,
        message: 'Report generated',
        data: result,
        meta: result.meta
    });
};
exports.ledger = (type) =>
    catchAsync(async (req, res) => {
        const format = ['pdf', 'xlsx', 'print'].includes(req.query.format) ? req.query.format : null;
        await output(res, await service.ledger(type, req.query, !!format), format, `${type}-ledger`);
    });
exports.report = catchAsync(async (req, res) => {
    const format = ['pdf', 'xlsx', 'print'].includes(req.query.format) ? req.query.format : null;
    await output(res, await service.report(req.params.name, req.query, !!format), format, req.params.name);
});
exports.dashboard = catchAsync(async (req, res) =>
    send(res, {
        statusCode: 200,
        success: true,
        message: 'Dashboard retrieved',
        data: await service.dashboard(req.query)
    })
);
exports.reconciliation = catchAsync(async (req, res) =>
    send(res, {
        statusCode: 200,
        success: true,
        message: 'Reconciliation retrieved',
        data: await service.reconciliation()
    })
);
