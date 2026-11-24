const assert = require('node:assert/strict');
const { D, sum } = require('../src/shared/financial');
const { returnBases } = require('../src/shared/returns');
const ledger = require('../src/modules/reports/productLedger.service');

const productLedgers = async (t, { db, catalog, ops, reports, user, save, post }) => {
    const date = '2026-07-07';
    const customer = await catalog.save('customers', null, { name: 'Ledger customer A' }, user);
    const otherCustomer = await catalog.save('customers', null, { name: 'Ledger customer B' }, user);
    const supplier = await catalog.save('suppliers', null, { name: 'Ledger supplier A' }, user);
    const otherSupplier = await catalog.save('suppliers', null, { name: 'Ledger supplier B' }, user);
    const warehouse = await catalog.save(
        'warehouses',
        null,
        { code: 'LEDGER-A', name: 'Ledger warehouse A' },
        user
    );
    const otherWarehouse = await catalog.save(
        'warehouses',
        null,
        { code: 'LEDGER-B', name: 'Ledger warehouse B' },
        user
    );
    const a = await catalog.save(
        'products',
        null,
        {
            sku: 'LEDGER-A',
            name: 'Original ledger product A',
            selling_price: '9',
            default_purchase_price: '2'
        },
        user
    );
    const b = await catalog.save(
        'products',
        null,
        { sku: 'LEDGER-B', name: 'Original ledger product B' },
        user
    );
    const create = async (kind, payload) => {
        const row = await save(kind, payload);
        await post(kind, row.id);
        return ops.get(kind, row.id);
    };
    const adjustment = (product, wh, type, qty, unit_cost = '0.3333') =>
        create('adjustments', {
            product_id: product.id,
            warehouse_id: wh.id,
            adjustment_date: date,
            adjustment_type: type,
            quantity_pcs: qty,
            unit_cost,
            reason: 'Product ledger test'
        });
    await adjustment(a, warehouse, 'OPENING', 20);
    await adjustment(b, warehouse, 'OPENING', 10);
    await adjustment(a, otherWarehouse, 'OPENING', 5, '9');
    const purchase = await create('purchases', {
        supplier_id: supplier.id,
        warehouse_id: warehouse.id,
        purchase_date: date,
        items: [
            { product_id: a.id, quantity_pcs: 6, unit_cost: '0.3333', discount_amount: '0.01' },
            { product_id: b.id, quantity_pcs: 3, unit_cost: '0.3333' }
        ]
    });
    const first = await create('grns', {
        purchase_id: purchase.id,
        received_date: date,
        items: [
            { purchase_item_id: purchase.items[0].id, quantity_pcs: 3 },
            { purchase_item_id: purchase.items[1].id, quantity_pcs: 3 }
        ]
    });
    await create('grns', {
        purchase_id: purchase.id,
        received_date: date,
        items: [{ purchase_item_id: purchase.items[0].id, quantity_pcs: 3 }]
    });
    const otherPurchase = await create('purchases', {
        supplier_id: otherSupplier.id,
        warehouse_id: otherWarehouse.id,
        purchase_date: date,
        items: [{ product_id: a.id, quantity_pcs: 2, unit_cost: '9' }]
    });
    await create('grns', {
        purchase_id: otherPurchase.id,
        received_date: date,
        items: [{ purchase_item_id: otherPurchase.items[0].id, quantity_pcs: 2 }]
    });
    const invoice = await create('sales', {
        customer_id: customer.id,
        warehouse_id: warehouse.id,
        invoice_date: date,
        discount_amount: '0.01',
        items: [
            { product_id: a.id, quantity_pcs: 3, unit_price: '0.3333' },
            { product_id: b.id, quantity_pcs: 3, unit_price: '0.3333' }
        ]
    });
    await create('sales', {
        customer_id: otherCustomer.id,
        warehouse_id: otherWarehouse.id,
        invoice_date: date,
        items: [{ product_id: a.id, quantity_pcs: 1, unit_price: '8' }]
    });
    const salesReturns = [];
    for (const [line, saleable] of [
        [0, true],
        [0, false],
        [1, true],
        [1, true],
        [1, true]
    ])
        salesReturns.push(
            await create('sales-returns', {
                sales_invoice_id: invoice.id,
                return_date: date,
                items: [{ sales_invoice_item_id: invoice.items[line].id, quantity_pcs: 1, saleable }]
            })
        );
    const purchaseReturns = [];
    for (let i = 0; i < 3; i++)
        purchaseReturns.push(
            await create('purchase-returns', {
                goods_receipt_id: first.id,
                return_date: date,
                items: [{ goods_receipt_item_id: first.items[0].id, quantity_pcs: 1 }]
            })
        );
    await adjustment(a, warehouse, 'INCREASE', 2, '0.1234');
    await adjustment(a, warehouse, 'DECREASE', 1);
    await save('sales', {
        customer_id: customer.id,
        warehouse_id: warehouse.id,
        invoice_date: date,
        items: [{ product_id: a.id, quantity_pcs: 999, unit_price: '999' }]
    });
    const pending = await create('purchases', {
        supplier_id: supplier.id,
        warehouse_id: warehouse.id,
        purchase_date: date,
        items: [{ product_id: a.id, quantity_pcs: 7, unit_cost: '1' }]
    });
    await save('grns', {
        purchase_id: pending.id,
        received_date: date,
        items: [{ purchase_item_id: pending.items[0].id, quantity_pcs: 7 }]
    });
    await save('sales-returns', {
        sales_invoice_id: invoice.id,
        return_date: date,
        items: [{ sales_invoice_item_id: invoice.items[0].id, quantity_pcs: 1, saleable: true }]
    });
    await catalog.save(
        'products',
        a.id,
        {
            sku: 'LEDGER-A-NEW',
            name: 'Renamed current product A',
            selling_price: '999',
            default_purchase_price: '777'
        },
        user
    );
    const financialBefore = {};
    for (const kind of ['customer', 'supplier'])
        financialBefore[kind] = await reports.ledger(kind, { from: date, to: date }, true);
    const fixture = { a, b, customer, supplier, warehouse, otherWarehouse, date, invoice, purchase };

    await t.test(
        'customer product ledger isolates posted customer activity and retains historic product snapshots and rates',
        async () => {
            const result = await ledger.partyLedger('customer', customer.id, {}, true);
            assert.equal(result.totals.sold, '6');
            assert.equal(result.totals.returned, '5');
            assert.equal(result.totals.net_quantity, '1');
            assert.ok(result.rows.every((row) => String(row.customer_id) === String(customer.id)));
            assert.ok(
                result.rows
                    .filter((row) => String(row.product_id) === String(a.id))
                    .every((row) => row.product === a.name && row.sku === a.sku && row.rate === '0.3333')
            );
            const bases = returnBases(invoice.items, true, invoice.discount_amount);
            const expected = D(invoice.total_amount).minus(sum(salesReturns.map((row) => row.total_amount)));
            assert.equal(result.totals.amount, expected.toFixed(2));
            assert.equal(
                result.rows
                    .filter((row) => row.type === 'SALE')
                    .reduce((value, row) => value.plus(row.amount), D(0))
                    .toFixed(2),
                invoice.total_amount
            );
            assert.equal(
                bases.reduce((value, row) => value.plus(row.return_basis_amount), D(0)).toFixed(2),
                invoice.total_amount
            );
            const thirds = result.rows.filter(
                (row) => row.type === 'SALE_RETURN' && String(row.product_id) === String(b.id)
            );
            assert.deepEqual(
                thirds.map((row) => row.amount),
                ['-0.33', '-0.34', '-0.33']
            );
            assert.equal(
                result.rows.filter((row) => row.type === 'SALE_RETURN' && D(row.saleable).eq(0)).length,
                1
            );
        }
    );
    await t.test(
        'customer filters and pagination retain complete totals, discounts and return bases',
        async () => {
            const all = await ledger.partyLedger(
                'customer',
                customer.id,
                { product_id: String(b.id), from: date, to: date },
                true
            );
            assert.equal(all.totals.amount, '0.00');
            assert.equal(all.totals.sold, '3');
            assert.equal(all.totals.returned, '3');
            assert.equal(all.totals.gross_amount, '0.00');
            assert.equal(all.totals.discount, '0.00', 'Full return must not invent a rounding discount');
            for (let page = 1; page <= all.rows.length; page++) {
                const one = await ledger.partyLedger('customer', customer.id, {
                    product_id: String(b.id),
                    from: date,
                    to: date,
                    page,
                    limit: 1
                });
                assert.deepEqual(one.totals, all.totals);
                assert.deepEqual(one.rows[0], all.rows[page - 1]);
            }
            const search = await ledger.partyLedger(
                'customer',
                customer.id,
                { voucher: invoice.invoice_no, search: b.sku },
                true
            );
            assert.equal(search.rows.length, 4);
            assert.equal(
                (await ledger.partyLedger('customer', customer.id, { from: '2026-07-08' })).meta.total,
                0
            );
            assert.equal(
                (await ledger.partyLedger('customer', customer.id, { search: "%' OR 1=1 --" })).meta.total,
                0
            );
        }
    );
    await t.test(
        'supplier product ledger separates orders, partial GRNs, draft receipts and precise purchase returns',
        async () => {
            const result = await ledger.partyLedger('supplier', supplier.id, {}, true);
            assert.ok(result.rows.every((row) => String(row.supplier_id) === String(supplier.id)));
            assert.equal(result.totals.ordered, '16'); // 9 received-order PCS + 7 unreceived-order PCS, once each.
            assert.equal(result.totals.received, '9');
            assert.equal(result.totals.returned, '3');
            assert.equal(result.totals.net_quantity, '6');
            assert.equal(result.totals.amount, '1.99'); // 2.99 received - 1.00 returned.
            assert.ok(
                result.rows
                    .filter((row) => row.type === 'ORDER')
                    .every((row) => D(row.amount).eq(0) && D(row.received).eq(0))
            );
            assert.deepEqual(
                result.rows.filter((row) => row.type === 'PURCHASE_RETURN').map((row) => row.amount),
                ['-0.33', '-0.34', '-0.33']
            );
            assert.ok(
                result.rows
                    .filter((row) => row.type === 'GRN' && String(row.product_id) === String(a.id))
                    .every((row) => D(row.ordered).eq(0))
            );
            const one = await ledger.partyLedger('supplier', supplier.id, {
                product_id: String(a.id),
                voucher: purchase.purchase_no,
                limit: 1,
                page: 2
            });
            assert.equal(one.totals.ordered, '6');
            assert.equal(one.totals.received, '6');
            assert.equal(one.totals.returned, '3'); // PO search also follows returns through the original GRN.
            assert.equal(one.rows.length, 1);
        }
    );
    await t.test(
        'standalone ledger includes every stock type and reconciles both warehouses and weighted historical valuation',
        async () => {
            const result = await ledger.productLedger(a.id, {}, true);
            assert.deepEqual([...new Set(result.rows.map((row) => row.movement_type))].sort(), [
                'ADJUST_IN',
                'ADJUST_OUT',
                'GRN',
                'OPENING',
                'PURCHASE_RETURN',
                'SALE',
                'SALE_RETURN'
            ]);
            assert.equal(result.stock.reconciled, true);
            assert.equal(result.stock.closing, result.stock.current_quantity);
            assert.equal(result.stock.closing_value, result.stock.current_value);
            assert.equal(result.stock.opening_value, '0.00');
            assert.equal(result.selection.selling_price, '999.0000');
            assert.equal(result.profitability.available, false);
            let balance = D(0);
            for (const row of result.rows) {
                balance = balance.plus(row.quantity_delta_pcs);
                assert.equal(row.running_quantity, balance.toFixed(0));
            }
            assert.equal(result.stock.closing, balance.toFixed(0));
            assert.equal(
                D(result.stock.opening)
                    .plus(result.stock.quantity_in)
                    .minus(result.stock.quantity_out)
                    .toFixed(0),
                result.stock.closing
            );
            const sales = result.rows.filter((row) => row.movement_type === 'SALE');
            assert.ok(sales.some((row) => row.selling_rate === '0.3333'));
            assert.ok(sales.some((row) => row.selling_rate === '8.0000'));
        }
    );
    await t.test(
        'physical running balances survive party/type/search filters and server-side pagination',
        async () => {
            const all = await ledger.productLedger(a.id, {}, true);
            for (const filter of [
                { customer_id: String(customer.id) },
                { supplier_id: String(supplier.id) },
                { type: 'SALE' },
                { search: 'Original ledger' }
            ]) {
                const scoped = await ledger.productLedger(a.id, filter, true);
                assert.deepEqual(scoped.stock, all.stock);
                assert.ok(scoped.rows.length > 0);
                for (const row of scoped.rows)
                    assert.equal(
                        row.running_quantity,
                        all.rows.find((item) => String(item.id) === String(row.id)).running_quantity
                    );
            }
            const page = await ledger.productLedger(a.id, { page: 2, limit: 2 });
            assert.deepEqual(page.rows, all.rows.slice(2, 4));
            assert.deepEqual(page.totals, all.totals);
            assert.deepEqual(page.stock, all.stock);
            const wh = await ledger.productLedger(a.id, { warehouse_id: String(otherWarehouse.id) }, true);
            assert.ok(wh.rows.every((row) => String(row.warehouse_id) === String(otherWarehouse.id)));
            assert.equal(wh.stock.current_quantity, '6');
            assert.equal(wh.stock.closing_value, '54.00');
            assert.equal(wh.rows.at(-1).running_quantity, '6');
        }
    );
    await t.test(
        'date-filtered opening is all prior physical movements and historical value never uses current purchase price',
        async () => {
            const all = await ledger.productLedger(a.id, {}, true);
            const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            const after = await ledger.productLedger(a.id, { from: tomorrow });
            assert.equal(after.stock.opening, all.stock.closing);
            assert.equal(after.stock.opening_value, all.stock.current_value);
            assert.equal(after.stock.quantity_in, '0');
            assert.equal(after.stock.quantity_out, '0');
            assert.equal(after.meta.total, 0);
            const empty = await ledger.productLedger(a.id, { to: '1901-01-01' });
            assert.equal(empty.stock.closing, '0');
            assert.equal(empty.stock.closing_value, '0.00');
            assert.equal(empty.stock.current_value, all.stock.current_value);
        }
    );
    await t.test(
        'standalone purchase, sales and return sections keep original document navigation and product isolation',
        async () => {
            for (const section of ['purchases', 'sales', 'sales-returns', 'purchase-returns']) {
                const result = await ledger.productLedger(a.id, { section }, true);
                assert.ok(result.rows.length);
                assert.ok(result.rows.every((row) => String(row.product_id) === String(a.id)));
                for (const row of result.rows) {
                    assert.equal(
                        String((await ops.get(row.document_resource, row.document_id)).id),
                        String(row.document_id)
                    );
                    assert.equal(
                        String((await ops.get(row.original_resource, row.original_id)).id),
                        String(row.original_id)
                    );
                }
            }
        }
    );
    await t.test(
        'existing customer and supplier financial JSON, opening, subtotals, columns and layouts remain unchanged after all new reports',
        async () => {
            for (const kind of ['customer', 'supplier'])
                assert.deepEqual(
                    await reports.ledger(kind, { from: date, to: date }, true),
                    financialBefore[kind]
                );
            assert.equal(financialBefore.customer.columns.length, 11);
        }
    );
    return fixture;
};

productLedgers.verifyHttp = async ({ db, user, request, headers, fixture }) => {
    const ExcelJS = require('exceljs');
    const cases = [
        [`customers/${fixture.customer.id}`, { product_id: fixture.a.id }],
        [`suppliers/${fixture.supplier.id}`, { product_id: fixture.a.id }],
        [`products/${fixture.a.id}`, { warehouse_id: fixture.warehouse.id }]
    ];
    for (const [path, filters] of cases) {
        const suffix = new URLSearchParams(filters).toString();
        const url = `/product-ledgers/${path}?${suffix}`;
        const response = await request(url + '&limit=1&page=2', { headers });
        assert.equal(response.status, 200);
        const json = (await response.json()).data;
        const completeResponse = await request(url + '&limit=100&page=1', { headers });
        const complete = (await completeResponse.json()).data;
        for (const format of ['pdf', 'print', 'xlsx']) {
            const file = await request(url + `&limit=1&page=2&format=${format}`, { headers });
            assert.equal(file.status, 200);
            const bytes = Buffer.from(await file.arrayBuffer());
            if (format === 'xlsx') {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(bytes);
                const values = workbook.worksheets[0].getSheetValues().flatMap((row) => row || []);
                assert.ok(values.includes(json.statement.title));
                assert.ok(values.includes(json.selection.name));
                assert.ok(workbook.worksheets[0].rowCount > json.meta.total);
                const voucherColumn =
                    json.statement.columns.findIndex((column) => column.key === 'voucher') + 1;
                const expectedVouchers = new Set(complete.rows.map((row) => row.voucher));
                const exportedVouchers = workbook.worksheets[0]
                    .getColumn(voucherColumn)
                    .values.filter((value) => expectedVouchers.has(value));
                assert.equal(
                    exportedVouchers.length,
                    json.meta.total,
                    'Excel must export every matching transaction, independently of displayed page'
                );
                const productSummary = workbook.getWorksheet('Product summary');
                if (productSummary) {
                    assert.equal(productSummary.actualRowCount, 2);
                    assert.equal(productSummary.getCell('A2').value, String(fixture.a.id));
                }
                const scope = workbook.getWorksheet('Report scope');
                const productColumn = scope.getRow(1).values.indexOf('product id');
                assert.equal(
                    scope.getRow(2).getCell(productColumn).value,
                    String(filters.product_id || fixture.a.id)
                );
            } else assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
            assert.match(
                file.headers.get('content-disposition'),
                format === 'print' ? /^inline/ : /^attachment/
            );
        }
    }
    for (const role of ['CASHIER', 'PURCHASE', 'WAREHOUSE', 'ACCOUNTANT']) {
        await db.execute('UPDATE users SET role=? WHERE id=?', [role, user.id]);
        assert.equal(
            (await request(`/product-ledgers/customers/${fixture.customer.id}`, { headers })).status,
            ['CASHIER', 'ACCOUNTANT'].includes(role) ? 200 : 403
        );
        assert.equal(
            (await request(`/product-ledgers/suppliers/${fixture.supplier.id}`, { headers })).status,
            ['PURCHASE', 'ACCOUNTANT'].includes(role) ? 200 : 403
        );
        assert.equal(
            (await request(`/product-ledgers/products/${fixture.a.id}`, { headers })).status,
            role === 'CASHIER' ? 403 : 200
        );
        if (['PURCHASE', 'WAREHOUSE'].includes(role))
            assert.equal(
                (await request(`/product-ledgers/products/${fixture.a.id}?section=sales`, { headers }))
                    .status,
                403
            );
    }
    await db.execute("UPDATE users SET role='ADMIN' WHERE id=?", [user.id]);
    assert.equal(
        (await request(`/product-ledgers/products/${fixture.a.id}?from=bad`, { headers })).status,
        400
    );
};
module.exports = productLedgers;
