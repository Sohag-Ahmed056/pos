const { amountColumns, formatAmount, formatDate, transactionLabel } = require('./customerLedger.layout');

const customerLedgerSheet = (workbook, result) => {
    const sheet = workbook.addWorksheet('customer-ledger', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.4, header: 0.1, footer: 0.15 }
        },
        headerFooter: { oddFooter: '&LPowered By IT-DEPARTMENT&CPage &P of &N&RPrint Date: &D &T' }
    });
    sheet.columns = [12, 27, 11, 19, 29, 19, 17, 21, 17, 17, 23].map((width) => ({ width }));
    const layout = result.layout;
    const merged = (row, first, last, value, bold = false, size = 10) => {
        sheet.mergeCells(row, first, row, last);
        const cell = sheet.getCell(row, first);
        cell.value = value;
        cell.font = { name: 'Arial', size, bold };
        return cell;
    };
    for (const [index, value] of [
        layout.company.name,
        'Customer Ledger Accounts',
        `From ${formatDate(result.period.from, true)} To ${formatDate(result.period.to, true)}`
    ].entries()) {
        merged(index + 1, 1, 11, value, index === 0, index === 0 ? 13 : 10).alignment = {
            horizontal: 'center'
        };
    }
    let cursor = 4;
    const border = (row, style = 'thin') =>
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = Object.fromEntries(
                ['top', 'bottom', 'left', 'right'].map((side) => [
                    side,
                    { style, color: { argb: 'FF000000' } }
                ])
            );
            cell.font = { name: 'Arial', size: 8, bold: cell.font?.bold || false };
            cell.alignment = {
                vertical: 'top',
                wrapText: true,
                horizontal: cell.col >= 6 ? 'right' : 'left'
            };
        });
    const total = (label, values, grand = false) => {
        const row = sheet.getRow(cursor++);
        row.values = [
            label,
            null,
            null,
            null,
            null,
            ...amountColumns.map((column) => formatAmount(values[column]))
        ];
        merged(row.number, 1, 5, label, true, grand ? 10 : 8);
        border(row);
        row.height = grand ? 21 : 18;
    };
    const sections = layout.sections.length
        ? layout.sections
        : [{ ...layout.heading, indexes: [], trailers: [] }];
    for (const section of sections) {
        for (const [title, value] of [
            ['Sales Channel', section.channel],
            ['Area', section.area],
            ['Party Name', section.party],
            ['Address', section.address],
            ['Customer Name', section.customer]
        ]) {
            merged(cursor, 1, 2, title, true);
            sheet.getCell(cursor, 3).value = ':';
            merged(cursor, 4, 11, value, title === 'Customer Name');
            sheet.getRow(cursor++).height = 18;
        }
        const top = cursor++,
            bottom = cursor++;
        for (const [index, title] of [
            'GL Date',
            'Voucher',
            'Company',
            'Transaction Type',
            'Reference'
        ].entries()) {
            sheet.mergeCells(top, index + 1, bottom, index + 1);
            sheet.getCell(top, index + 1).value = title;
        }
        merged(top, 6, 7, 'Debit', true);
        merged(top, 8, 10, 'Credit', true);
        sheet.mergeCells(top, 11, bottom, 11);
        sheet.getCell(top, 11).value = 'Closing Balance';
        for (const [index, title] of ['Sales', 'Adj', 'Collection', 'Return', 'Adj'].entries())
            sheet.getCell(bottom, index + 6).value = title;
        for (const rowNumber of [top, bottom]) {
            const row = sheet.getRow(rowNumber);
            border(row);
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = { name: 'Arial', size: 10, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
            row.height = 22;
        }
        for (const index of section.indexes) {
            const data = result.rows[index];
            const row = sheet.getRow(cursor++);
            row.values = [
                formatDate(data['GL Date']),
                data.Voucher,
                layout.company.code,
                transactionLabel(data['Transaction Type']),
                data.Reference,
                ...amountColumns.map((column) => formatAmount(data[column]))
            ];
            border(row, 'dotted');
            row.height = 25;
        }
        if (!section.indexes.length) merged(cursor++, 1, 11, 'No transactions in the selected period.');
        for (const trailer of section.trailers) total(trailer.label, trailer.totals);
        cursor++;
    }
    total('Grand Total:', layout.totals, true);
    sheet.pageSetup.printArea = `A1:K${cursor - 1}`;
    sheet.pageSetup.printTitlesRow = '1:3';
    return sheet;
};

module.exports = { customerLedgerSheet };
