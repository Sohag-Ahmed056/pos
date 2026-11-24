const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const browserFeatures = async ({ origin, fixtures, command, evaluate, wait, pause }) => {
    const enter = async (selector, value, select = false) => {
        await evaluate(
            `(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(input,${JSON.stringify(String(value))}); input.dispatchEvent(new Event('${select ? 'change' : 'input'}',{bubbles:true})); return true; })()`
        );
        await pause(100);
    };
    const clickText = async (text, selector = 'button') =>
        evaluate(
            `[...document.querySelectorAll(${JSON.stringify(selector)})].find(button=>button.textContent.includes(${JSON.stringify(text)})).click()`
        );
    const navigate = async (route) => {
        await command('Page.navigate', { url: origin + route });
        await pause(100);
        await wait(
            `window.location.href===${JSON.stringify(origin + route)} && document.readyState==='complete'`
        );
    };
    const close = async () => {
        await evaluate(`document.querySelector('dialog[open] button[aria-label="Close dialog"]').click()`);
        await wait("!document.querySelector('dialog[open]')");
    };

    await navigate('/');
    await wait("document.body.innerText.includes('Today’s collection')");
    await enter('section[aria-label="Dashboard date range"] input[type=date]', fixtures.date);
    // Both date fields are wrapped in labels, so address the end field explicitly.
    await evaluate(
        `(() => { const input=[...document.querySelectorAll('section[aria-label="Dashboard date range"] input[type=date]')][1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(fixtures.date)}); input.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`
    );
    await pause(100);
    await clickText('Apply dates');
    await wait(
        `window.location.search.includes('from=${fixtures.date}') && [...document.querySelectorAll('.metric')].some(card=>card.textContent.includes('Net profit')&&card.textContent.includes('2,000.00'))`
    );

    await navigate('/audit');
    await wait(
        "document.querySelector('h1')?.textContent==='Audit history' && !!document.querySelector('table tbody tr')"
    );
    await enter('input[placeholder="e.g. sales.post"]', 'CHANGE_PASSWORD');
    await clickText('Apply filters');
    await wait(
        "window.location.search.includes('action=CHANGE_PASSWORD') && document.querySelector('table tbody')?.textContent.includes('CHANGE_PASSWORD')"
    );
    await clickText('View details');
    await wait("document.querySelector('dialog[open]')?.textContent.includes('CHANGE_PASSWORD')");
    assert.equal(
        await evaluate("document.querySelector('dialog[open]').textContent.includes('Feature-new-password')"),
        false
    );
    await close();

    await navigate(
        `/reports?report=customer-ledger&customer_id=${fixtures.customer.id}&from=${fixtures.date}&to=${fixtures.date}`
    );
    await wait("!!document.querySelector('.customer-ledger-document table tbody tr')");
    assert.equal(await evaluate("document.querySelector('.customer-ledger-document thead').rows.length"), 2);
    assert.equal(
        await evaluate("document.querySelector('.customer-ledger-document tbody tr').cells.length"),
        11
    );
    assert.ok(
        await evaluate("document.querySelector('.ledger-customer').textContent.includes('Feature customer')")
    );
    assert.ok(
        await evaluate(
            "document.querySelector('.customer-ledger-document tfoot').textContent.includes('Grand Total:')"
        )
    );
    const ledgerHref = await evaluate(
        "[...document.querySelectorAll('a')].find(link=>link.textContent.includes('Print report')).getAttribute('href')"
    );
    assert.ok(ledgerHref.includes(`customer_id=${fixtures.customer.id}`));
    assert.ok(ledgerHref.includes(`from=${fixtures.date}`));
    assert.ok(ledgerHref.includes(`to=${fixtures.date}`));
    const ledgerPdf = await evaluate(`(async()=>{
        const response=await fetch(${JSON.stringify(ledgerHref)});
        const bytes=new Uint8Array(await response.arrayBuffer());
        return {status:response.status,type:response.headers.get('content-type'),data:btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''))};
    })()`);
    assert.equal(ledgerPdf.status, 200);
    assert.equal(ledgerPdf.type, 'application/pdf');
    await fs.writeFile('artifacts/customer-ledger.pdf', Buffer.from(ledgerPdf.data, 'base64'));
    const ledgerScreenshot = await command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile('artifacts/customer-ledger.png', Buffer.from(ledgerScreenshot.data, 'base64'));

    for (const [name, title, filter, count] of [
        ['supplier-ledger', 'Supplier Ledger Accounts', `supplier_id=${fixtures.supplier.id}`, 8],
        ['general-ledger', 'General Ledger Accounts', `account_id=${fixtures.arAccountId}`, 9],
        ['cash-bank', 'Cash and Bank Ledger', 'payment_account_id=1', 8],
        [
            'stock-movements',
            'Stock Movement Ledger',
            `product_id=${fixtures.bulb.id}&warehouse_id=${fixtures.warehouse.id}`,
            10
        ]
    ]) {
        const period =
            name === 'stock-movements'
                ? 'from=1900-01-01&to=9999-12-31'
                : `from=${fixtures.date}&to=${fixtures.date}`;
        await navigate(`/reports?report=${name}&${filter}&${period}`);
        await wait(`!!document.querySelector('section[aria-label=${JSON.stringify(title)}] table tbody tr')`);
        assert.equal(
            await evaluate(
                "[...(document.querySelector('.ledger-statement-document thead tr')?.cells||[])].reduce((count,cell)=>count+cell.colSpan,0)"
            ),
            count
        );
        assert.equal(
            await evaluate("document.querySelector('.ledger-statement-document tbody tr').cells.length"),
            count
        );
        const href = await evaluate(
            "[...document.querySelectorAll('a')].find(link=>link.textContent.includes('Print report')).getAttribute('href')"
        );
        const exported = await evaluate(
            `(async()=>{const r=await fetch(${JSON.stringify(href)});const b=new Uint8Array(await r.arrayBuffer());return{status:r.status,data:btoa(Array.from(b,value=>String.fromCharCode(value)).join(''))};})()`
        );
        assert.equal(exported.status, 200);
        await fs.writeFile(`artifacts/${name}.pdf`, Buffer.from(exported.data, 'base64'));
        const screenshot = await command('Page.captureScreenshot', { format: 'png' });
        await fs.writeFile(`artifacts/${name}.png`, Buffer.from(screenshot.data, 'base64'));
        const excel = await evaluate(
            `(async()=>{const r=await fetch(${JSON.stringify(href.replace('format=print', 'format=xlsx'))});const b=new Uint8Array(await r.arrayBuffer());return{status:r.status,data:btoa(Array.from(b,value=>String.fromCharCode(value)).join(''))};})()`
        );
        assert.equal(excel.status, 200);
        const workbook = new (require('exceljs').Workbook)();
        await workbook.xlsx.load(Buffer.from(excel.data, 'base64'));
        assert.equal(workbook.worksheets[0].columnCount, count);
        assert.equal(workbook.worksheets[0].getCell('A2').value, title);
    }

    await navigate('/documents/purchases');
    await wait('!!document.querySelector(\'input[aria-label="Search voucher number"]\')');
    await enter('input[aria-label="Search voucher number"]', fixtures.purchaseNo);
    await wait(
        `document.querySelectorAll('table tbody tr').length===1 && document.querySelector('table tbody').textContent.includes(${JSON.stringify(fixtures.purchaseNo)})`
    );
    await evaluate('document.querySelector(\'button[aria-label="View transaction"]\').click()');
    await wait(
        "document.querySelector('dialog[open]')?.textContent.includes('Purchase total') && document.querySelector('dialog[open]').textContent.includes('20,000.00') && document.querySelector('dialog[open]').textContent.includes('Feature warehouse')"
    );
    const pdf = await command('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    const bytes = Buffer.from(pdf.data, 'base64');
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    await fs.writeFile('artifacts/purchase-voucher.pdf', bytes);
    await close();

    await navigate('/masters/customers');
    await wait('!!document.querySelector(\'input[aria-label="Search records"]\')');
    await enter('input[aria-label="Search records"]', fixtures.customer.name);
    await wait(
        "document.querySelectorAll('table tbody tr').length===1 && document.querySelector('table tbody').textContent.includes('Feature customer')"
    );
    await evaluate('document.querySelector(\'button[aria-label="View profile"]\').click()');
    await clickText('Financial Ledger', 'dialog button[role="tab"]');
    await wait("document.querySelector('dialog .customer-ledger-document tbody tr')?.cells.length===11");
    await clickText('Product-wise Sales Ledger', 'dialog button[role="tab"]');
    await wait(
        "document.querySelector('table[aria-label=\"Product ledger transactions\"] tbody')?.textContent.includes('Feature bulb')"
    );
    await clickText('Invoice History', 'dialog button[role="tab"]');
    const historyTotal = await evaluate(
        `(async()=>{const response=await fetch('/api/v1/customers/${fixtures.customer.id}/history?limit=10');return (await response.json()).meta.total;})()`
    );
    assert.ok(historyTotal >= 13);
    await wait(
        `document.querySelector('section[aria-label="Transaction history"]')?.textContent.includes('${historyTotal} records')`
    );
    await evaluate(
        'document.querySelector(\'section[aria-label="Transaction history"] button[aria-label="Next page"]\').click()'
    );
    await wait(
        "document.querySelector('section[aria-label=\"Transaction history\"]').textContent.includes('Page 2 of 2')"
    );
    await clickText('Payment History', 'dialog button[role="tab"]');
    await wait(
        "document.querySelector('section[aria-label=\"Payment history\"]')?.textContent.includes('13 records')"
    );
    await evaluate(
        'document.querySelector(\'section[aria-label="Payment history"] button[aria-label="Next page"]\').click()'
    );
    await wait(
        "document.querySelector('section[aria-label=\"Payment history\"]').textContent.includes('Page 2 of 2')"
    );
    await clickText('Invoice History', 'dialog button[role="tab"]');
    await clickText('View transaction', 'section[aria-label="Transaction history"] button');
    await wait(
        "document.querySelectorAll('dialog[open]').length===2 && !!document.querySelectorAll('dialog[open]')[1].querySelector('.print-document')"
    );
    await evaluate(
        "[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('button[aria-label=\"Close dialog\"]').click()"
    );
    await wait("document.querySelectorAll('dialog[open]').length===1");
    await close();

    await navigate(`/inventory/product-ledger?product_id=${fixtures.bulb.id}`);
    await wait(
        "document.querySelector('section[aria-label=\"Physical stock summary\"]')?.textContent.includes('Closing PCS') && document.querySelector('table[aria-label=\"Product ledger transactions\"] tbody')?.textContent.includes('GRN')"
    );
    assert.ok(
        await evaluate(
            "document.querySelector('section[aria-label=\"Product information\"]').textContent.includes('Feature bulb')"
        )
    );
    const productScreenshot = await command('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true
    });
    await fs.writeFile('artifacts/product-ledger.png', Buffer.from(productScreenshot.data, 'base64'));
    await clickText('Sales', 'button[role="tab"]');
    await wait(
        `document.querySelector('table[aria-label="Product ledger transactions"] tbody')?.textContent.includes(${JSON.stringify(fixtures.invoiceNo)})`
    );
    await clickText(fixtures.invoiceNo, 'table[aria-label="Product ledger transactions"] button');
    await wait(
        `document.querySelector('dialog[open]')?.textContent.includes(${JSON.stringify(fixtures.invoiceNo)}) && !!document.querySelector('.print-document')`
    );
    await close();
    await clickText('Purchases & GRNs', 'button[role="tab"]');
    await wait(
        `document.querySelector('table[aria-label="Product ledger transactions"] tbody')?.textContent.includes(${JSON.stringify(fixtures.purchaseNo)})`
    );
    await clickText(fixtures.purchaseNo, 'table[aria-label="Product ledger transactions"] button');
    await wait("!!document.querySelector('dialog[open] .print-document')");
    await close();

    await navigate('/masters/suppliers');
    await wait('!!document.querySelector(\'input[aria-label="Search records"]\')');
    await enter('input[aria-label="Search records"]', fixtures.supplier.name);
    await wait("document.querySelectorAll('table tbody tr').length===1");
    await evaluate('document.querySelector(\'button[aria-label="View profile"]\').click()');
    await clickText('Product-wise Purchase Ledger', 'dialog button[role="tab"]');
    await wait(
        "document.querySelector('table[aria-label=\"Product ledger transactions\"] tbody')?.textContent.includes('Feature bulb')"
    );
    await clickText('Financial Ledger', 'dialog button[role="tab"]');
    await wait(
        "document.querySelector('dialog .ledger-statement-document')?.textContent.includes('Supplier Ledger Accounts')"
    );
    await close();

    await navigate(`/reports?report=expenses&from=${fixtures.date}&to=${fixtures.date}`);
    await wait(
        "document.body.innerText.includes('Expense summary by name') && [...document.querySelectorAll('.metric')].some(card=>card.textContent.includes('Total expenses')&&card.textContent.includes('300.00'))"
    );
    assert.ok(
        await evaluate(
            "document.body.innerText.includes('Feature transport') && document.body.innerText.includes('Feature rent')"
        )
    );

    await navigate('/documents/sales-returns');
    await wait(
        "[...document.querySelectorAll('button')].some(button=>button.textContent.includes('New sales return'))"
    );
    await clickText('New sales return');
    await wait('!!document.querySelector(\'select[aria-label="Original invoice"]\')');
    await enter('input[aria-label="Search Original invoice"]', fixtures.invoiceNo);
    await wait(
        `[...document.querySelector('select[aria-label="Original invoice"]').options].some(option=>option.value===${JSON.stringify(String(fixtures.invoice.id))})`
    );
    await enter('select[aria-label="Original invoice"]', fixtures.invoice.id, true);
    await wait('!!document.querySelector(\'dialog input[aria-label^="Quantity for original line"]\')');
    await enter('dialog input[aria-label^="Quantity for original line"]', '5');
    await wait("document.querySelector('dialog[open]').textContent.includes('Return total: ৳ 750.00')");
    assert.ok(await evaluate("document.querySelector('dialog[open]').textContent.includes('150.0000')"));
    await close();

    await navigate('/documents/grns');
    await wait(
        "[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Pending purchases'))"
    );
    await clickText('Pending purchases');
    await wait('!!document.querySelector(\'input[aria-label="Search pending purchases"]\')');
    await enter('input[aria-label="Search pending purchases"]', fixtures.pendingNo);
    await wait(
        `document.querySelector('table tbody')?.textContent.includes(${JSON.stringify(fixtures.pendingNo)})`
    );
    await evaluate(
        `[...document.querySelectorAll('table tbody tr')].find(row=>row.textContent.includes(${JSON.stringify(fixtures.pendingNo)})).querySelector('button').click()`
    );
    await wait(
        `document.querySelector('select[aria-label="Confirmed purchase"]')?.value===${JSON.stringify(String(fixtures.pending.id))} && !!document.querySelector('dialog input[aria-label^="Quantity for original line"]')`
    );
    await close();
};
module.exports = browserFeatures;
