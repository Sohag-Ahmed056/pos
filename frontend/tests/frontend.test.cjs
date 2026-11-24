const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let documents, catalog, journals, reports, keys;
before(async () => {
    [documents, catalog, journals, reports, keys] = await Promise.all([
        import('../features/documents/model/documentDraft.js'),
        import('../features/catalog/model/catalogForm.js'),
        import('../features/accounting/model/journalDraft.js'),
        import('../features/reports/model/reportFilters.js'),
        import('../lib/idempotency.js')
    ]);
});
test('sale payload keeps previous due and transaction snapshots out of new revenue', () => {
    const values = documents.serializeDocument('sales', {
        form: {
            invoice_date: '2026-10-25',
            customer_id: '10',
            warehouse_id: '2',
            discount_amount: '10',
            previous_due_snapshot: '2000',
            total_amount: '99999',
            status: 'POSTED'
        },
        items: [
            {
                product_id: 1,
                quantity_pcs: '2',
                unit_price: '0.3333',
                discount_amount: 0,
                sku_snapshot: 'OLD'
            }
        ]
    });
    assert.deepEqual(values, {
        invoice_date: '2026-10-25',
        customer_id: '10',
        warehouse_id: '2',
        items: [{ product_id: '1', quantity_pcs: 2, unit_price: '0.3333', discount_amount: '0' }],
        discount_amount: '10'
    });
});
test('POS totals preserve decimal arithmetic and the previous-due example', () => {
    const totals = documents.documentTotals(
        [{ quantity_pcs: 5, unit_price: '1460', discount_amount: 0 }],
        0,
        '2000',
        '3000'
    );
    assert.deepEqual(totals, {
        subtotal: '7300.00',
        total: '7300.00',
        previous: '2000.00',
        payable: '9300.00',
        closing: '6300.00'
    });
    assert.equal(documents.lineTotal({ quantity_pcs: 3, unit_price: '0.3333' }), '1.00');
    assert.equal(
        documents.documentTotals([
            { quantity_pcs: 1, unit_price: '0.10' },
            { quantity_pcs: 1, unit_price: '0.20' }
        ]).total,
        '0.30'
    );
    assert.equal(documents.lineTotal({ quantity_pcs: '', unit_price: '' }), '0.00');
});
test('receipt payload keeps identity numbers textual and supports multiple allocations', () => {
    const values = documents.serializeDocument('receipts', {
        form: { receipt_date: '2026-10-25', customer_id: '10', payment_account_id: '3', amount: '100' },
        items: [],
        allocations: { 1: '30', 2: '70', 3: '0' }
    });
    assert.deepEqual(values.allocations, [
        { document_id: '1', amount: '30' },
        { document_id: '2', amount: '70' }
    ]);
    assert.equal(values.amount, '100');
    assert.equal(values.reference_no, null);
    const customer = catalog.catalogPayload('customers', {
        name: 'Customer',
        nid_number: '00123',
        tin_number: ''
    });
    assert.equal(customer.nid_number, '00123');
    assert.equal(customer.tin_number, null);
});
test('GRN and return payloads reference source lines and omit unselected quantities', () => {
    const form = { received_date: '2026-10-25', purchase_id: '9' };
    assert.deepEqual(
        documents.serializeDocument('grns', {
            form,
            items: [
                { source_id: 1, quantity_pcs: '0' },
                { source_id: 2, quantity_pcs: '3' }
            ]
        }),
        { received_date: '2026-10-25', purchase_id: '9', items: [{ purchase_item_id: '2', quantity_pcs: 3 }] }
    );
    const returned = documents.serializeDocument('sales-returns', {
        form: { return_date: '2026-10-25', sales_invoice_id: '7' },
        items: [{ source_id: '8', quantity_pcs: '2', saleable: false }]
    });
    assert.deepEqual(returned.items, [{ sales_invoice_item_id: '8', quantity_pcs: 2, saleable: false }]);
});
test('editing a partial GRN preserves saved quantities against the original source', () => {
    const rows = documents.sourceItems(
        'grns',
        { items: [{ id: '2', quantity_pcs: 10, remaining_pcs: 7 }] },
        { items: [{ purchase_item_id: '2', quantity_pcs: 3 }] }
    );
    assert.equal(rows[0].source_id, '2');
    assert.equal(rows[0].quantity_pcs, 3);
    assert.equal(rows[0].remaining_pcs, 7);
});
test('selecting a product reuses its existing cart line', () => {
    const product = {
        id: '1',
        name: 'Battery',
        sku: 'BAT',
        selling_price: '20',
        default_purchase_price: '10'
    };
    const first = documents.addProductLine([], product, 'sales');
    const second = documents.addProductLine(first, { ...product, id: 1 }, 'sales');
    assert.equal(second.length, 1);
    assert.equal(second[0].quantity_pcs, 2);
    assert.equal(second[0].unit_price, '20');
    assert.equal(documents.addProductLine([], product, 'purchases')[0].unit_cost, '10');
});
test('posting payment remains separate from the draft invoice payload', () => {
    assert.deepEqual(documents.salePostingPayment('sales', { amount: 3000, payment_account_id: '1' }), {
        payment: { amount: '3000', payment_account_id: '1' }
    });
    assert.deepEqual(documents.salePostingPayment('sales', { amount: 0 }), {});
    assert.deepEqual(documents.salePostingPayment('purchases', { amount: 3000 }), {});
});
test('manual journals attach party IDs only to the appropriate control accounts', () => {
    const values = journals.journalPayload({
        form: { gl_date: '2026-10-25', type: 'OPENING_BALANCE', reason: 'Opening', reference_no: '' },
        lines: [
            { account_id: '1', debit: 100, credit: '' },
            { account_id: '2', debit: '', credit: 100 }
        ],
        accounts: [
            { id: '1', code: 'AR' },
            { id: '2', code: 'OPENING_EQUITY' }
        ],
        customer: '9',
        supplier: '7'
    });
    assert.deepEqual(values.lines, [
        { account_id: '1', debit: '100', credit: '0', customer_id: '9' },
        { account_id: '2', debit: '0', credit: '100' }
    ]);
    assert.deepEqual(
        journals.journalTotals([
            { debit: '0.10', credit: '0.30' },
            { debit: '0.20', credit: '' }
        ]),
        { debit: '0.30', credit: '0.30' }
    );
});
test('report URLs preserve applicable filters without leaking filters across modules', () => {
    const form = {
        from: '2026-10-01',
        to: '2026-10-25',
        customer_id: '9',
        supplier_id: '8',
        party: 'Retail',
        area: 'Dhaka',
        channel: 'Dealer',
        product_id: '3',
        warehouse_id: '2'
    };
    assert.deepEqual(reports.reportFilters('supplier-ledger', form), {
        from: form.from,
        to: form.to,
        supplier_id: '8'
    });
    assert.deepEqual(reports.reportFilters('stock', form), {
        from: form.from,
        to: form.to,
        product_id: '3',
        warehouse_id: '2'
    });
    const initial = reports.initialReportFilters(new URLSearchParams('from=2026-01-01&customer_id=9'));
    assert.equal(initial.from, '2026-01-01');
    assert.equal(initial.customer_id, '9');
});
test('request keys survive failed retries, are payload-specific, and clear only on success', () => {
    let counter = 0;
    const tracker = keys.createRequestKeys(() => `request-${++counter}`);
    const first = { kind: 'sales', values: { amount: '10', customer_id: '1' } };
    const reordered = { values: { customer_id: '1', amount: '10' }, kind: 'sales' };
    assert.equal(tracker.forRequest(first), tracker.forRequest(reordered));
    assert.notEqual(
        tracker.forRequest(first),
        tracker.forRequest({ ...first, values: { amount: '11', customer_id: '1' } })
    );
    const previous = tracker.forRequest(first);
    tracker.complete(first);
    assert.notEqual(tracker.forRequest(first), previous);
});

test('uncertain posting responses retry the same posted document without re-saving its draft', async () => {
    const { createDocumentSubmission } = await import('../features/documents/model/documentSubmission.js');
    const submit = createDocumentSubmission();
    let saves = 0,
        posts = 0;
    const requests = [];
    const dependencies = {
        saveDraft: async () => {
            saves++;
            return { data: { id: '42' } };
        },
        post: async (args) => {
            requests.push(args);
            if (++posts === 1) throw new Error('Response lost after commit');
        }
    };
    const request = {
        kind: 'sales',
        values: { customer_id: '1', items: [] },
        payment: { payment: { amount: '10', payment_account_id: '1' } },
        postNow: true
    };
    await assert.rejects(() => submit(request, dependencies), /Response lost/);
    assert.deepEqual(await submit(request, dependencies), { id: '42' });
    assert.equal(saves, 1);
    assert.equal(posts, 2);
    assert.deepEqual(requests[0], requests[1]);
});
