const { test } = require('node:test');
const assert = require('node:assert/strict');
test('professional ledger filters retain only their own account, payment and inventory selections', async () => {
    const { reportFilters } = await import('../features/reports/model/reportFilters.js');
    const form = {
        from: '2026-10-01',
        to: '2026-10-26',
        account_id: '5',
        payment_account_id: '7',
        product_id: '8',
        warehouse_id: '9'
    };
    assert.deepEqual(reportFilters('general-ledger', form), {
        from: form.from,
        to: form.to,
        account_id: '5'
    });
    assert.deepEqual(reportFilters('cash-bank', form), {
        from: form.from,
        to: form.to,
        payment_account_id: '7'
    });
    assert.deepEqual(reportFilters('stock-movements', form), {
        from: form.from,
        to: form.to,
        product_id: '8',
        warehouse_id: '9'
    });
});
test('ledger statement formatting preserves PCS, four-decimal costs and grouped monetary headings', async () => {
    const { statementValue, statementBands } = await import('../features/reports/model/statementFormat.js');
    assert.equal(statementValue('-2500', { type: 'quantity' }), '-2,500');
    assert.equal(statementValue('1234.5678', { type: 'cost' }), '1,234.5678');
    assert.equal(statementValue('999999999999.99', { type: 'money' }), '999,999,999,999.99');
    assert.equal(
        statementBands([
            { title: 'Date' },
            { title: 'In', group: 'PCS' },
            { title: 'Out', group: 'PCS' },
            { title: 'Net', group: 'PCS' }
        ])[1].span,
        3
    );
});
test('customer ledger reference formatting preserves large decimals, advances, dates and column meanings', async () => {
    const { ledgerAmount, ledgerDate, ledgerAmounts, ledgerTransaction, ledgerPrintDate } =
        await import('../features/reports/model/ledgerFormat.js');
    assert.equal(ledgerAmount('999999999999.99'), '999,999,999,999.99');
    assert.equal(ledgerAmount('-60000'), '-60,000.00');
    assert.equal(ledgerDate('2026-10-26'), '26-OCT-26');
    assert.equal(ledgerDate('2026-10-26', true), '26-OCT-2026');
    assert.equal(ledgerAmounts.length, 6);
    assert.equal(ledgerTransaction('RECEIPTS'), 'Receipts');
    assert.equal(ledgerTransaction('OPENING_BALANCE'), 'Opening Balance');
    assert.equal(ledgerPrintDate(new Date('2026-10-18T09:43:00Z')), '18-OCT-2026 15:43');
});
test('return previews preserve cumulative cents and reject excess or fractional PCS', async () => {
    const { sourceLinePreview, sourceTotalPreview } =
        await import('../features/documents/model/sourcePreview.js');
    const line = { source_quantity_pcs: 3, quantity_pcs: 1, remaining_pcs: 3, return_basis_amount: '1.00' };
    assert.deepEqual(
        [0, 1, 2].map((returned_pcs) => sourceLinePreview({ ...line, returned_pcs }).amount),
        ['0.33', '0.34', '0.33']
    );
    assert.equal(sourceLinePreview({ ...line, quantity_pcs: 4 }).valid, false);
    assert.equal(sourceLinePreview({ ...line, quantity_pcs: 0.5 }).valid, false);
    assert.equal(sourceTotalPreview([{ ...line, quantity_pcs: 4 }]), null);
});
test('partial GRN preview calculates the specification total of 16000 from the original purchase lines', async () => {
    const { sourceItems } = await import('../features/documents/model/documentDraft.js');
    const { sourceTotalPreview } = await import('../features/documents/model/sourcePreview.js');
    const rows = sourceItems('grns', {
        items: [
            { id: '1', quantity_pcs: 100, remaining_pcs: 100, unit_cost: '100', discount_amount: '0' },
            { id: '2', quantity_pcs: 50, remaining_pcs: 50, unit_cost: '200', discount_amount: '0' }
        ]
    });
    rows[0].quantity_pcs = 60;
    rows[1].quantity_pcs = 50;
    assert.equal(sourceTotalPreview(rows), '16000.00');
});
test('expense export filters retain the selected name/account and do not leak into other reports', async () => {
    const { reportFilters } = await import('../features/reports/model/reportFilters.js');
    const form = { from: '2026-08-15', to: '2026-08-15', expense_name: 'Transport', payment_account_id: '3' };
    assert.deepEqual(reportFilters('expenses', form), form);
    assert.deepEqual(reportFilters('sales', form), { from: form.from, to: form.to });
});
test('document pages use the explicit read policy and Cashier cannot enter purchasing, payment, expense, or audit screens', async () => {
    const { canReadDocument } = await import('../features/auth/permissions.js');
    const { routeRoles } = await import('../app/navigation.js');
    assert.equal(canReadDocument('payments', 'CASHIER'), false);
    assert.equal(canReadDocument('expenses', 'CASHIER'), false);
    assert.equal(canReadDocument('purchases', 'WAREHOUSE'), true);
    assert.equal(routeRoles('/documents/sales').includes('ACCOUNTANT'), true);
    for (const route of ['/documents/purchases', '/documents/payments', '/documents/expenses', '/audit'])
        assert.equal(routeRoles(route).includes('CASHIER'), false);
});
