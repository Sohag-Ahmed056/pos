const { formatDate } = require('./customerLedger.layout');
const { formatStatementValue, headerBands } = require('./ledgerStatement.layout');

const ledgerStatementSheet = (workbook, result) => {
    const statement = result.statement,
        columns = statement.columns,
        last = columns.length;
    const firstAmount = columns.findIndex((column) => statement.metrics.includes(column.key)) + 1;
    const sheet = workbook.addWorksheet(statement.name.slice(0, 31), {
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
    sheet.columns = columns.map((column) => ({ width: Math.max(12, column.width / 4) }));
    const merged = (row, start, end, value, bold = false, size = 10) => {
        if (end > start) sheet.mergeCells(row, start, row, end);
        const cell = sheet.getCell(row, start);
        cell.value = value;
        cell.font = { name: 'Arial', size, bold };
        cell.alignment = { vertical: 'top', wrapText: true };
        return cell;
    };
    for (const [index, value] of [
        statement.company.name,
        statement.title,
        `From ${formatDate(result.period.from, true)} To ${formatDate(result.period.to, true)}`
    ].entries()) {
        merged(index + 1, 1, last, value, index === 0, index === 0 ? 13 : 10).alignment = {
            horizontal: 'center',
            wrapText: true
        };
        sheet.getRow(index + 1).height = index === 0 ? 30 : 22;
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
                horizontal: cell.col >= firstAmount ? 'right' : 'left'
            };
        });
    const total = (label, values, grand = false) => {
        const row = sheet.getRow(cursor++);
        row.values = columns.map((column, index) =>
            index === 0
                ? label
                : index < firstAmount - 1
                  ? null
                  : formatStatementValue(values[column.key], column)
        );
        merged(row.number, 1, firstAmount - 1, label, true, grand ? 10 : 8);
        border(row);
        row.height = 24;
    };
    const sections = statement.sections.length
        ? statement.sections
        : [{ details: statement.details, indexes: [], trailers: [] }];
    for (const section of sections) {
        for (const [label, value] of section.details) {
            merged(cursor, 1, 2, label, true);
            sheet.getCell(cursor, 3).value = ':';
            merged(cursor, 4, last, value, label.endsWith('Name'));
            sheet.getRow(cursor++).height = Math.max(20, Math.ceil(String(value).length / 95) * 16);
        }
        const top = cursor++,
            bottom = cursor++;
        for (const band of headerBands(columns)) {
            if (band.group) {
                merged(top, band.start + 1, band.start + band.span, band.title, true);
                for (let index = band.start; index < band.start + band.span; index++)
                    sheet.getCell(bottom, index + 1).value = columns[index].title;
            } else {
                sheet.mergeCells(top, band.start + 1, bottom, band.start + 1);
                sheet.getCell(top, band.start + 1).value = band.title;
            }
        }
        for (const number of [top, bottom]) {
            const row = sheet.getRow(number);
            border(row);
            row.height = 25;
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = { name: 'Arial', size: 10, bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
        }
        for (const index of section.indexes) {
            const row = sheet.getRow(cursor++);
            row.values = columns.map((column) =>
                formatStatementValue(result.rows[index][column.key], column)
            );
            border(row, 'dotted');
            row.height = Math.max(
                24,
                ...columns.map((column, index) => {
                    const value = String(row.getCell(index + 1).value || '');
                    return (
                        Math.ceil(value.length / Math.max(8, sheet.getColumn(index + 1).width - 2)) * 11 + 6
                    );
                })
            );
        }
        if (!section.indexes.length) merged(cursor++, 1, last, 'No transactions in the selected period.');
        for (const item of section.trailers) total(item.label, item.totals);
        cursor++;
    }
    total(statement.totalLabel, statement.totals, true);
    merged(cursor++, 1, last, statement.note, false, 8);
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(last).letter}${cursor - 1}`;
    sheet.pageSetup.printTitlesRow = '1:3';
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    return sheet;
};

module.exports = { ledgerStatementSheet };
