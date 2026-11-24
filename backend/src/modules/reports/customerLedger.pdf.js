const PDFDocument = require('pdfkit');
const path = require('node:path');
const { amountColumns, formatAmount, formatDate, transactionLabel } = require('./customerLedger.layout');

const renderCustomerLedgerPdf = (res, result, { inline = false, printedAt = new Date() } = {}) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });
    doc.registerFont('Ledger', path.join(__dirname, 'fonts/Arimo-Regular.ttf'));
    doc.registerFont('LedgerBold', path.join(__dirname, 'fonts/Arimo-Bold.ttf'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="customer-ledger.pdf"`
    );
    doc.pipe(res);
    const layout = result.layout;
    const left = 17,
        right = doc.page.width - 14,
        width = right - left;
    const proportions = [50, 54, 54, 67, 117, 86, 72, 81, 68, 67, 95];
    const widths = proportions.map((value) => (value * width) / 811);
    const edges = [left];
    for (const cellWidth of widths) edges.push(edges.at(-1) + cellWidth);
    const bottom = doc.page.height - 48;
    let y = 0,
        active;
    const text = (value, x, top, cellWidth, { bold = false, size = 7, align = 'left', ...options } = {}) => {
        doc.font(bold ? 'LedgerBold' : 'Ledger')
            .fontSize(size)
            .fillColor('black')
            .text(String(value ?? ''), x, top, { width: cellWidth, align, lineGap: 0, ...options });
    };
    const line = (x1, y1, x2, y2, dotted = false) => {
        doc.save().lineWidth(0.4).strokeColor('black');
        if (dotted) doc.dash(0.45, { space: 0.65 });
        doc.moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
    };
    const height = (value, cellWidth, size = 7, bold = false) => {
        doc.font(bold ? 'LedgerBold' : 'Ledger').fontSize(size);
        return doc.heightOfString(String(value ?? ''), { width: cellWidth, lineGap: 0 });
    };
    const tableHeading = () => {
        const top = y,
            split = top + 17.5,
            end = top + 38.5;
        doc.save().fillColor('#f2f2f2').rect(left, top, width, 38.5).fill().restore();
        line(left, top, right, top);
        line(left, end, right, end);
        for (const index of [0, 1, 2, 3, 4, 5, 7, 10, 11]) line(edges[index], top, edges[index], end);
        for (const index of [6, 8, 9]) line(edges[index], split, edges[index], end);
        line(edges[5], split, edges[10], split);
        for (const [index, title] of [
            'GL Date',
            'Voucher',
            'Company',
            'Transaction Type',
            'Reference'
        ].entries()) {
            text(title, edges[index] + 3, top + 2.7, widths[index] - 6, {
                bold: true,
                size: 10,
                align: index === 4 ? 'left' : 'center'
            });
        }
        text('Debit', edges[5], top + 2.7, widths[5] + widths[6], { bold: true, size: 10, align: 'center' });
        text('Credit', edges[7], top + 2.7, widths[7] + widths[8] + widths[9], {
            bold: true,
            size: 10,
            align: 'center'
        });
        text('Closing Balance', edges[10] + 3, top + 2.7, widths[10] - 6, {
            bold: true,
            size: 10,
            align: 'center'
        });
        for (const [index, title] of ['Sales', 'Adj', 'Collection', 'Return', 'Adj'].entries()) {
            text(title, edges[index + 5] + 2, split + 4, widths[index + 5] - 4, {
                bold: true,
                size: 10,
                align: 'center'
            });
        }
        y = end + 3;
    };
    const pageHeading = (group, newPage = false) => {
        if (newPage) doc.addPage();
        const extra = Math.max(
            0,
            height(layout.company.name, doc.page.width, 13, true) -
                height('Company', doc.page.width, 13, true)
        );
        text(layout.company.name, 0, 14.4, doc.page.width, { bold: true, size: 13, align: 'center' });
        text('Customer Ledger Accounts', 0, 29.5 + extra, doc.page.width, { size: 10, align: 'center' });
        text(
            `From ${formatDate(result.period.from, true)} To ${formatDate(result.period.to, true)}`,
            0,
            43.4 + extra,
            doc.page.width,
            { size: 9, align: 'center' }
        );
        y = 57 + extra;
        for (const [title, value, size, valueX, bold] of [
            ['Sales Channel', group.channel, 11, left + 168, false],
            ['Area', group.area, 11, left + 105, false],
            ['Party Name', group.party, 10, left + 109, false],
            ['Address', group.address, 10, left + 109, false],
            ['Customer Name', group.customer, 10, left + 109, true]
        ]) {
            const rowHeight = Math.max(size === 11 ? 13.1 : 11.9, height(value, right - valueX, size, bold));
            text(title, left + 4, y - 1.7, valueX - left - 12, { bold: true, size });
            text(':', valueX - 14, y - 1.7, 10, { bold: true, size });
            text(value, valueX, y - 1.7, right - valueX, { bold, size });
            y += rowHeight;
        }
        y += 1;
        tableHeading();
    };
    const ensure = (rowHeight) => {
        if (y + rowHeight > bottom) pageHeading(active || layout.heading, true);
    };
    const dataRow = (row, trailingHeight = 0) => {
        const values = [
            formatDate(row['GL Date']),
            row.Voucher,
            layout.company.code,
            transactionLabel(row['Transaction Type']),
            row.Reference,
            ...amountColumns.map((column) => formatAmount(row[column]))
        ];
        const sizes = values.map(() => 7);
        // Preserve the complete generated voucher while keeping long IDs legible in the reference's narrow column.
        while (
            sizes[1] > 6 &&
            height(values[1], widths[1] - 6, sizes[1]) > 2 * height('M', widths[1] - 6, sizes[1])
        )
            sizes[1] -= 0.25;
        const rowHeight = Math.max(
            13.9,
            ...values.map((value, index) => height(value, widths[index] - 6, sizes[index]) + 5)
        );
        ensure(rowHeight + trailingHeight);
        for (let index = 0; index <= widths.length; index++)
            line(edges[index], y, edges[index], y + rowHeight, true);
        line(left, y, right, y, true);
        for (const [index, value] of values.entries())
            text(value, edges[index] + 3, y + 3, widths[index] - 6, {
                size: sizes[index],
                align: index >= 5 ? 'right' : index === 0 || index === 2 ? 'center' : 'left'
            });
        y += rowHeight;
        line(left, y, right, y, true);
    };
    const totalHeight = (label, grand = false) =>
        Math.max(grand ? 17 : 14.6, height(label, edges[5] - left - 6, grand ? 9 : 7, true) + 5);
    const totalRow = (label, totals, grand = false) => {
        const rowHeight = totalHeight(label, grand);
        ensure(rowHeight);
        line(left, y, right, y);
        line(left, y + rowHeight, right, y + rowHeight);
        for (const index of [0, 5, 6, 7, 8, 9, 10, 11]) line(edges[index], y, edges[index], y + rowHeight);
        text(label, left + 3, y + 3, edges[5] - left - 6, { bold: true, size: grand ? 9 : 7 });
        for (const [index, column] of amountColumns.entries())
            text(formatAmount(totals[column]), edges[index + 5] + 3, y + 3, widths[index + 5] - 6, {
                align: 'right',
                bold: index === 5 && !label.startsWith('Customer (')
            });
        y += rowHeight;
    };
    if (!layout.sections.length) {
        active = layout.heading;
        pageHeading(active);
        text('No transactions in the selected period.', left + 4, y + 5, width - 8);
        y += 23;
    }
    for (const [index, section] of layout.sections.entries()) {
        active = section;
        // Each customer/snapshot section starts with its own identity block.
        pageHeading(section, index > 0);
        const trailerHeight =
            section.trailers.reduce((sum, trailer) => sum + totalHeight(trailer.label), 0) +
            (index === layout.sections.length - 1 ? totalHeight('Grand Total:', true) : 0);
        for (const [position, rowIndex] of section.indexes.entries()) {
            dataRow(result.rows[rowIndex], position === section.indexes.length - 1 ? trailerHeight : 0);
        }
        for (const trailer of section.trailers) totalRow(trailer.label, trailer.totals);
    }
    totalRow('Grand Total:', layout.totals, true);
    const pageRange = doc.bufferedPageRange();
    const printParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(printedAt);
    const part = (type) => printParts.find((value) => value.type === type).value;
    const stamp = `${formatDate(`${part('year')}-${part('month')}-${part('day')}`, true)}  ${part('hour')}:${part('minute')}`;
    for (let page = 0; page < pageRange.count; page++) {
        doc.switchToPage(page);
        text('Powered By IT-DEPARTMENT', 31, doc.page.height - 33.5, 250, { size: 8 });
        text(`Page ${page + 1} of ${pageRange.count}`, left - 8, doc.page.height - 33.5, width, {
            size: 8,
            align: 'center'
        });
        text(`Print Date: ${stamp}`, doc.page.width - 225, doc.page.height - 33.5, 210, { size: 8 });
    }
    doc.end();
};

module.exports = { renderCustomerLedgerPdf };
