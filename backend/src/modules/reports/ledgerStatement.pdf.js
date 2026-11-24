const path = require('node:path');
const PDFDocument = require('pdfkit');
const { formatDate } = require('./customerLedger.layout');
const { formatStatementValue, headerBands } = require('./ledgerStatement.layout');

const renderLedgerStatementPdf = (res, result, { inline = false, printedAt = new Date() } = {}) => {
    const statement = result.statement;
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });
    doc.registerFont('Ledger', path.join(__dirname, 'fonts/Arimo-Regular.ttf'));
    doc.registerFont('LedgerBold', path.join(__dirname, 'fonts/Arimo-Bold.ttf'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${statement.name}.pdf"`
    );
    doc.pipe(res);
    const left = 17,
        right = doc.page.width - 14,
        width = right - left,
        bottom = doc.page.height - 48;
    const columns = statement.columns;
    const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width * width) / totalWidth);
    const edges = [left];
    for (const cell of widths) edges.push(edges.at(-1) + cell);
    const firstAmount = columns.findIndex((column) => statement.metrics.includes(column.key));
    const bands = headerBands(columns),
        grouped = columns.some((column) => column.group);
    let y, active;
    const text = (value, x, top, cellWidth, { size = 7, bold = false, align = 'left' } = {}) => {
        doc.font(bold ? 'LedgerBold' : 'Ledger')
            .fontSize(size)
            .fillColor('black')
            .text(String(value ?? ''), x, top, { width: cellWidth, align, lineGap: 0 });
    };
    const height = (value, cellWidth, size = 7, bold = false) => {
        doc.font(bold ? 'LedgerBold' : 'Ledger').fontSize(size);
        return doc.heightOfString(String(value ?? ''), { width: cellWidth, lineGap: 0 });
    };
    const line = (x1, y1, x2, y2, dotted = false) => {
        doc.save().lineWidth(0.4).strokeColor('black');
        if (dotted) doc.dash(0.45, { space: 0.65 });
        doc.moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
    };
    const tableHeading = () => {
        const top = y,
            split = top + 18;
        const headerHeight = Math.max(
            38.5,
            ...columns.map(
                (column, index) => height(column.title, widths[index] - 6, 9, true) + (column.group ? 25 : 8)
            )
        );
        const end = top + headerHeight;
        doc.save().fillColor('#f2f2f2').rect(left, top, width, headerHeight).fill().restore();
        line(left, top, right, top);
        line(left, end, right, end);
        for (const band of bands) {
            const start = edges[band.start],
                bandWidth = edges[band.start + band.span] - start;
            line(start, top, start, end);
            text(band.title, start + 3, top + 4, bandWidth - 6, { size: 9, bold: true, align: 'center' });
            if (band.group) {
                line(start, split, start + bandWidth, split);
                for (let index = band.start; index < band.start + band.span; index++) {
                    line(edges[index], split, edges[index], end);
                    text(columns[index].title, edges[index] + 3, split + 4, widths[index] - 6, {
                        size: 9,
                        bold: true,
                        align: 'center'
                    });
                }
            }
        }
        line(right, top, right, end);
        y = end + (grouped ? 3 : 2);
    };
    const heading = (section, newPage = false) => {
        if (newPage) doc.addPage();
        const extra = Math.max(
            0,
            height(statement.company.name, doc.page.width, 13, true) -
                height('Company', doc.page.width, 13, true)
        );
        text(statement.company.name, 0, 14.4, doc.page.width, { size: 13, bold: true, align: 'center' });
        text(statement.title, 0, 29.5 + extra, doc.page.width, { size: 10, align: 'center' });
        text(
            `From ${formatDate(result.period.from, true)} To ${formatDate(result.period.to, true)}`,
            0,
            43.4 + extra,
            doc.page.width,
            { size: 9, align: 'center' }
        );
        y = 57 + extra;
        for (const [label, value] of section.details) {
            const size = 10,
                valueX = left + 125;
            text(label, left + 4, y, valueX - left - 18, { size, bold: true });
            text(':', valueX - 12, y, 10, { size, bold: true });
            text(value, valueX, y, right - valueX, { size, bold: label.endsWith('Name') });
            y += Math.max(
                12.5,
                height(value, right - valueX, size),
                height(label, valueX - left - 18, size, true)
            );
        }
        y = Math.max(120, y + 4);
        tableHeading();
    };
    const ensure = (rowHeight) => {
        if (y + rowHeight > bottom) heading(active, true);
    };
    const summaryHeight = (label) => Math.max(16, height(label, edges[firstAmount] - left - 6, 8, true) + 6);
    const summary = (label, values, grand = false) => {
        const rowHeight = summaryHeight(label);
        ensure(rowHeight);
        line(left, y, right, y);
        line(left, y + rowHeight, right, y + rowHeight);
        line(left, y, left, y + rowHeight);
        text(label, left + 3, y + 3, edges[firstAmount] - left - 6, { size: grand ? 9 : 8, bold: true });
        for (let index = firstAmount; index < columns.length; index++) {
            line(edges[index], y, edges[index], y + rowHeight);
            text(
                formatStatementValue(values[columns[index].key], columns[index]),
                edges[index] + 3,
                y + 3,
                widths[index] - 6,
                { align: 'right', bold: index === columns.length - 1 }
            );
        }
        line(right, y, right, y + rowHeight);
        y += rowHeight;
    };
    const row = (data, trailing = 0) => {
        const values = columns.map((column) => formatStatementValue(data[column.key], column));
        const sizes = columns.map(() => 7);
        for (const [index, column] of columns.entries())
            if (column.type === 'voucher') {
                while (
                    sizes[index] > 6 &&
                    height(values[index], widths[index] - 6, sizes[index]) >
                        2 * height('M', widths[index] - 6, sizes[index])
                )
                    sizes[index] -= 0.25;
            }
        const rowHeight = Math.max(
            14,
            ...values.map((value, index) => height(value, widths[index] - 6, sizes[index]) + 6)
        );
        ensure(rowHeight + trailing);
        line(left, y, right, y, true);
        line(left, y + rowHeight, right, y + rowHeight, true);
        for (let index = 0; index <= columns.length; index++)
            line(edges[index], y, edges[index], y + rowHeight, true);
        for (const [index, value] of values.entries())
            text(value, edges[index] + 3, y + 3, widths[index] - 6, {
                size: sizes[index],
                align: ['money', 'quantity', 'cost'].includes(columns[index].type) ? 'right' : 'left'
            });
        y += rowHeight;
    };
    if (!statement.sections.length) {
        active = { details: statement.details };
        heading(active);
        text('No transactions in the selected period.', left + 4, y + 6, width - 8);
        y += 25;
    }
    for (const [index, section] of statement.sections.entries()) {
        active = section;
        heading(section, index > 0);
        const trailing =
            section.trailers.reduce((sum, item) => sum + summaryHeight(item.label), 0) +
            (index === statement.sections.length - 1 ? summaryHeight(statement.totalLabel) : 0);
        for (const [position, rowIndex] of section.indexes.entries())
            row(result.rows[rowIndex], position === section.indexes.length - 1 ? trailing : 0);
        for (const item of section.trailers) summary(item.label, item.totals);
    }
    summary(statement.totalLabel, statement.totals, true);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(printedAt);
    const part = (type) => parts.find((value) => value.type === type).value;
    const stamp = `${formatDate(`${part('year')}-${part('month')}-${part('day')}`, true)} ${part('hour')}:${part('minute')}`;
    const range = doc.bufferedPageRange();
    for (let page = 0; page < range.count; page++) {
        doc.switchToPage(page);
        text('Powered By IT-DEPARTMENT', 31, doc.page.height - 33.5, 240, { size: 8 });
        text(`Page ${page + 1} of ${range.count}`, left - 8, doc.page.height - 33.5, width, {
            size: 8,
            align: 'center'
        });
        text(`Print Date: ${stamp}`, doc.page.width - 225, doc.page.height - 33.5, 210, { size: 8 });
    }
    doc.end();
};

module.exports = { renderLedgerStatementPdf };
