// Uses the installed Chromium and its DevTools protocol; no browser package is needed.
const { spawn } = require('child_process');
const fs = require('fs/promises');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browserQA = async (origin, customerId, fixtures) => {
    const directory = await fs.mkdtemp('/tmp/battery-pos-browser-');
    const child = spawn(
        '/usr/bin/chromium',
        [
            '--headless',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--remote-debugging-port=0',
            `--user-data-dir=${directory}`,
            'about:blank'
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let ws;
    const pending = new Map();
    let seq = 0;
    try {
        const endpoint = await new Promise((resolve, reject) => {
            let output = '';
            const timer = setTimeout(() => reject(new Error('Chromium startup timed out')), 15000);
            child.stderr.on('data', (chunk) => {
                output += chunk;
                const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
                if (match) {
                    clearTimeout(timer);
                    resolve(match[1]);
                }
            });
            child.on('error', reject);
            child.on('exit', (code) => {
                clearTimeout(timer);
                reject(new Error(`Chromium exited: ${code}`));
            });
        });
        ws = new WebSocket(endpoint);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            const handler = pending.get(msg.id);
            if (handler) {
                clearTimeout(handler.timer);
                pending.delete(msg.id);
                msg.error ? handler.reject(new Error(msg.error.message)) : handler.resolve(msg.result);
            }
        });
        const send = (method, params = {}, sessionId) =>
            new Promise((resolve, reject) => {
                const id = ++seq;
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Browser command timed out: ${method}`));
                }, 15000);
                pending.set(id, { resolve, reject, timer });
                ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
            });
        const target = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', {
            targetId: target.targetId,
            flatten: true
        });
        const command = (method, params) => send(method, params, sessionId);
        const evaluate = async (expression) => {
            const r = await command('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            if (r.exceptionDetails)
                throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
            return r.result?.value;
        };
        const wait = async (expression) => {
            for (let i = 0; i < 100; i++) {
                if (await evaluate(expression)) return;
                await pause(100);
            }
            throw new Error(`Browser condition timed out: ${expression}`);
        };
        await command('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 1100,
            deviceScaleFactor: 1,
            mobile: false
        });
        await command('Page.navigate', { url: origin });
        await wait("!!document.querySelector('input[type=email]')");
        await evaluate(
            `(()=>{const set=(selector,value)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('input[type=email]','test@example.invalid');set('input[type=password]','Test-only-password');document.querySelector('button[type=submit], form button').click();return true;})()`
        );
        await wait("document.body.innerText.includes('Recent activity')");
        await fs.mkdir('artifacts', { recursive: true });
        const screenshot = await command('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true
        });
        await fs.writeFile('artifacts/dashboard.png', Buffer.from(screenshot.data, 'base64'));
        for (const route of [
            '/masters/products',
            '/masters/customers',
            '/documents/sales',
            '/documents/purchases',
            '/reports?report=customer-ledger'
        ]) {
            await command('Page.navigate', { url: origin + route });
            await wait("!!document.querySelector('aside') && !document.body.innerText.includes('Loading…')");
            const text = await evaluate('document.body.innerText');
            if (/unexpected server error|could not be completed|workspace could not be displayed/i.test(text))
                throw new Error(`Browser page error at ${route}`);
            if (route === '/documents/purchases') {
                await evaluate(
                    "[...document.querySelectorAll('button')].find(button => button.textContent.includes('New purchase order')).click()"
                );
                await wait("!!document.querySelector('dialog[open]')");
                await evaluate(
                    "[...document.querySelectorAll('dialog button')].find(button => button.textContent.includes('Quick add')).click()"
                );
                await wait("document.querySelectorAll('dialog[open]').length === 2");
                await evaluate(
                    `(() => { const dialog = [...document.querySelectorAll('dialog[open]')].at(-1); const input = dialog.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Browser supplier'); input.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`
                );
                await pause(100);
                await evaluate(
                    "[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('button[type=submit]').click()"
                );
                await wait(
                    "document.querySelectorAll('dialog[open]').length === 1 && document.querySelector('select[aria-label=Supplier]')?.selectedOptions[0]?.textContent.includes('Browser supplier')"
                );
                await evaluate(
                    'document.querySelector(\'dialog[open] button[aria-label="Close dialog"]\').click()'
                );
                await wait("!document.querySelector('dialog[open]')");
            }
            if (route === '/reports?report=customer-ledger') {
                await wait(
                    `[...document.querySelector('select[aria-label=Customer]')?.options || []].some(option => option.value === ${JSON.stringify(String(customerId))})`
                );
                await evaluate(
                    `(() => { const select = document.querySelector('select[aria-label=Customer]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(String(customerId))}); select.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`
                );
                await pause(100);
                await evaluate(
                    "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Apply filters')).click()"
                );
                await wait(
                    `new URLSearchParams(window.location.search).get('customer_id') === ${JSON.stringify(String(customerId))} && [...(document.querySelector('table thead tr')?.cells || [])].reduce((count,cell)=>count+cell.colSpan,0) === 11`
                );
                const downloads = await fs.mkdtemp('/tmp/battery-pos-downloads-');
                await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
                await evaluate(
                    "[...document.querySelectorAll('button')].find(button => button.textContent.includes('Excel export')).click()"
                );
                let workbook;
                for (let i = 0; i < 100; i++) {
                    try {
                        workbook = await fs.readFile(downloads + '/customer-ledger.xlsx');
                        break;
                    } catch {
                        await pause(100);
                    }
                }
                if (!workbook || workbook.subarray(0, 2).toString() !== 'PK')
                    throw new Error('Filtered ledger Excel download failed');
            }
            if (route === '/documents/sales') {
                await evaluate(
                    "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New sales invoice')).click()"
                );
                await wait("!!document.querySelector('dialog[open]')");
                if (!(await evaluate("document.querySelector('dialog').innerText.includes('Previous due')")))
                    throw new Error('Sales calculation panel missing');
                await wait(
                    "['Customer','Warehouse','Add product by name or SKU'].every(name=>document.querySelector('select[aria-label=\"'+name+'\"]')?.options.length>1)"
                );
                await evaluate(
                    `(()=>{const values=${JSON.stringify(fixtures?.browserSale ? { Customer: String(fixtures.browserSale.customerId), Warehouse: String(fixtures.browserSale.warehouseId), 'Add product by name or SKU': String(fixtures.browserSale.productId) } : {})};for(const name of ['Customer','Warehouse','Add product by name or SKU']){const select=document.querySelector('select[aria-label="'+name+'"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,values[name]||select.options[1].value);select.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()`
                );
                await pause(150);
                await evaluate(
                    "[...document.querySelectorAll('dialog button')].find(b=>b.textContent.includes('Add item')).click()"
                );
                await wait("!!document.querySelector('dialog table tbody tr')");
                await evaluate(
                    "[...document.querySelectorAll('dialog button')].find(b=>b.textContent.includes('Save & post')).click()"
                );
                await wait("document.querySelectorAll('dialog[open]').length===2");
                await evaluate(
                    "[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('button.btn').click()"
                );
                await wait("!document.querySelector('dialog[open]')");
                if (!(await evaluate("document.body.innerText.includes('Document posted')")))
                    throw new Error('Sales form did not post successfully');
            }
        }
        if (fixtures)
            await require('./browserFeatures')({ origin, fixtures, command, evaluate, wait, pause });
        await command('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true
        });
        await command('Page.navigate', { url: origin + '/masters/products' });
        await wait("!!document.querySelector('aside') && !document.body.innerText.includes('Loading…')");
        const mobile = await command('Page.captureScreenshot', { format: 'png' });
        await fs.writeFile('artifacts/mobile-products.png', Buffer.from(mobile.data, 'base64'));
        // A second synthetic user verifies route guards independently of hidden navigation links.
        const created = await evaluate(
            `(async () => { const response = await fetch('/api/v1/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test cashier',email:'cashier@example.invalid',password:'Test-only-password',role:'CASHIER',is_active:true})}); return response.status; })()`
        );
        if (created !== 201) throw new Error('Cashier fixture creation failed');
        await evaluate('document.querySelector(\'button[aria-label="Sign out"]\').click()');
        await wait("!!document.querySelector('input[type=email]')");
        await evaluate(
            `(() => { const set=(selector,value)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};set('input[type=email]','cashier@example.invalid');set('input[type=password]','Test-only-password');return true; })()`
        );
        await pause(100);
        await evaluate("document.querySelector('form button').click()");
        await wait(
            "window.location.pathname === '/documents/sales' && document.querySelector('h1')?.textContent === 'Sales invoices'"
        );
        for (const restricted of [
            '/masters/users',
            '/documents/payments',
            '/documents/expenses',
            '/documents/purchases',
            '/audit',
            '/accounting'
        ]) {
            await command('Page.navigate', { url: origin + restricted });
            await wait(
                "window.location.pathname === '/documents/sales' && document.querySelector('h1')?.textContent === 'Sales invoices'"
            );
        }
        return { desktop: 'artifacts/dashboard.png', mobile: 'artifacts/mobile-products.png' };
    } finally {
        if (ws) ws.close();
        for (const value of pending.values()) clearTimeout(value.timer);
        child.kill('SIGTERM');
    }
};
module.exports = browserQA;
