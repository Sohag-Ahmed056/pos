// Explicit demo data only. Never called during application startup.
const db = require('../config/db');
const catalog = require('../modules/catalog/catalog.service');
const operations = require('../modules/operations/operations.service');
const journals = require('../modules/operations/journal.service');
const reports = require('../modules/reports/reports.service');
const { withTransaction, audit } = require('../shared/transaction');
const { D, assert } = require('../shared/financial');
const { date: validDate } = require('../modules/operations/operations.validation');

const DATASET = 'battery-pos-demo-v1';
const DEMO_PASSWORD = 'Demo@2026Test!';
const ROLES = ['ADMIN', 'MANAGER', 'PURCHASE', 'WAREHOUSE', 'CASHIER', 'ACCOUNTANT'];
const today = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
const dateAt = (anchor, offset) => {
    const value = new Date(`${anchor}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
};
const marker = async (action) => {
    const [[row]] = await db.execute(
        "SELECT user_id, details FROM audit_logs WHERE action_code=? AND entity_type='demo_dataset' AND JSON_UNQUOTE(JSON_EXTRACT(details,'$.dataset'))=? ORDER BY id LIMIT 1",
        [action, DATASET]
    );
    return row
        ? { ...row, details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details }
        : null;
};

const seedDemo = async ({ anchorDate = today(), onProgress = () => {} } = {}) => {
    validDate.parse(anchorDate);
    const [[database]] = await db.query('SELECT DATABASE() name');
    assert(
        database.name === 'batteryPos' || /^batteryPos_test_[a-f0-9]{16}$/.test(database.name),
        'Demo data is supported only in batteryPos or an isolated batteryPos test database'
    );
    const lockName = `${database.name}:demo:v1`;
    const connection = await db.getConnection();
    let locked = false;
    try {
        const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 0) acquired', [lockName]);
        assert(Number(lock.acquired) === 1, 'Another demo loader is already running');
        locked = true;
        const started = await marker('DEMO_SEED_START');
        const [[user]] = started
            ? await db.execute("SELECT id,role FROM users WHERE id=? AND role='ADMIN' AND is_active=1", [
                  String(started.user_id)
              ])
            : await db.query(
                  "SELECT id,role FROM users WHERE role='ADMIN' AND is_active=1 ORDER BY id LIMIT 1"
              );
        assert(user, 'Create an active administrator with npm run seed before loading demo data');
        const actor = { id: String(user.id), role: user.role };
        const [accounts] = await db.query('SELECT id,code FROM chart_of_accounts');
        const accountIds = Object.fromEntries(accounts.map((row) => [row.code, String(row.id)]));
        for (const code of [
            'AR',
            'AP',
            'INVENTORY',
            'SALES',
            'SALES_RETURN',
            'COGS',
            'EXPENSE',
            'STOCK_LOSS',
            'STOCK_GAIN',
            'OPENING_EQUITY'
        ])
            assert(accountIds[code], `Missing existing chart of accounts code: ${code}`);
        if (started) anchorDate = validDate.parse(started.details.anchorDate);
        else
            await withTransaction((tx) =>
                audit(tx, actor, 'DEMO_SEED_START', 'demo_dataset', null, {
                    dataset: DATASET,
                    anchorDate
                })
            );
        const date = (offset = 0) => dateAt(anchorDate, offset);
        const key = (label) => `demo-v1-${label}`;
        const documents = [];
        const masterKeys = {
            users: 'email',
            products: 'sku',
            warehouses: 'code',
            chart_of_accounts: 'code',
            customers: 'name',
            suppliers: 'name',
            payment_accounts: 'name'
        };
        const master = async (resource, payload) => {
            const field = masterKeys[resource];
            assert(field, 'Unsupported demo directory');
            const [[existing]] = await db.execute(`SELECT * FROM ${resource} WHERE ${field}=? LIMIT 1`, [
                payload[field]
            ]);
            if (existing) {
                assert(
                    existing.name.startsWith('[DEMO]'),
                    `Demo identifier already belongs to another record: ${payload[field]}`
                );
                return { ...existing, id: String(existing.id) };
            }
            return catalog.save(resource, null, payload, actor);
        };
        const document = async (label, kind, values, post = true, payment = {}) => {
            const saved = await operations.save(kind, null, values, actor, key(`${label}-save`));
            if (post) await operations.post(kind, saved.id, payment, actor, key(`${label}-post`));
            const row = await operations.get(kind, saved.id);
            const [, number, dateField] = operations.definitions[kind];
            documents.push({
                label,
                kind,
                id: String(row.id),
                voucher: row[number],
                status: row.status,
                date: row[dateField]
            });
            return row;
        };
        const manual = (label, values) => journals.create(values, actor, key(label));

        onProgress('Creating demo directories and six role accounts');
        const users = [];
        for (const role of ROLES)
            users.push(
                await master('users', {
                    name: `[DEMO] ${role.charAt(0)}${role.slice(1).toLowerCase()}`,
                    email: `demo.${role.toLowerCase()}@batterypos.test`,
                    password: DEMO_PASSWORD,
                    role
                })
            );
        await withTransaction(async (tx) => {
            const [[company]] = await tx.execute('SELECT id FROM company_settings WHERE id=1 FOR UPDATE');
            if (!company) {
                await tx.execute(
                    'INSERT INTO company_settings (id,company_code,company_name,address) VALUES (1,?,?,?)',
                    ['DEMO', '[DEMO] BatteryPOS Trading', 'Demo showroom, Dhaka, Bangladesh']
                );
                await audit(tx, actor, 'CREATE', 'company_settings', '1', { dataset: DATASET });
            }
        });
        const warehouses = [];
        for (const [code, name] of [
            ['DEMO-MAIN', 'Dhaka Main Showroom'],
            ['DEMO-BRANCH', 'Chattogram Branch'],
            ['DEMO-SERVICE', 'Service and Warranty Store']
        ])
            warehouses.push(await master('warehouses', { code, name: `[DEMO] ${name}` }));
        const suppliers = [];
        for (const [index, name] of [
            'Battery Distribution',
            'Auto Power Importers',
            'IPS and Solar Supply',
            'Battery Accessories'
        ].entries()) {
            suppliers.push(
                await master('suppliers', {
                    name: `[DEMO] ${name}`,
                    phone: `0000000200${index}`,
                    address: `Demo supplier street ${index + 1}, Bangladesh`
                })
            );
        }
        const customers = [];
        const customerNames = [
            'Dhaka Battery House',
            'Mirpur Auto Care',
            'Gazipur Transport',
            'Chattogram Motors',
            'Uttara Power Shop',
            'Narayanganj Traders',
            'Cumilla Auto Parts',
            'Sylhet Battery Center',
            'Fleet Services',
            'Cash Retail Customer',
            'Advance Customer',
            'New Prospect'
        ];
        for (const [index, name] of customerNames.entries())
            customers.push(
                await master('customers', {
                    name: `[DEMO] ${name}`,
                    shop_name: `[DEMO] ${name}`,
                    phone: `00000001${String(index).padStart(3, '0')}`,
                    address: `Demo customer street ${index + 1}, Bangladesh`,
                    nid_number: `000000000${String(index + 1).padStart(4, '0')}`,
                    tin_number: `00000000${String(index + 1).padStart(4, '0')}`,
                    trade_license_number: `DEMO-TL-${index + 1}`,
                    bank_name: '[DEMO] Sample Bank',
                    cheque_number: `00000${index + 1}`,
                    party_name: `[DEMO] ${['North Dealers', 'Retail Partners', 'Fleet Accounts'][index % 3]}`,
                    area_name: ['Dhaka', 'Gazipur', 'Chattogram', 'Sylhet'][index % 4],
                    sales_channel: ['Dealer', 'Retail', 'Corporate'][index % 3]
                })
            );
        const products = [];
        const productSpecs = [
            ['BAT-45AH', 'Automotive Battery 45Ah', '4500', '5800', 'Automotive'],
            ['BAT-60AH', 'Automotive Battery 60Ah', '6000', '7800', 'Automotive'],
            ['BAT-80AH', 'Automotive Battery 80Ah', '8000', '10500', 'Automotive'],
            ['BAT-100AH', 'Automotive Battery 100Ah', '10000', '13000', 'Automotive'],
            ['BAT-130AH', 'Truck Battery 130Ah', '12500', '16000', 'Commercial'],
            ['BAT-150AH', 'Truck Battery 150Ah', '15000', '19000', 'Commercial'],
            ['BAT-165AH', 'Truck Battery 165Ah', '16500', '21000', 'Commercial'],
            ['BAT-200AH', 'Heavy Duty Battery 200Ah', '21000', '27000', 'Commercial'],
            ['IPS-150AH', 'IPS Deep Cycle Battery 150Ah', '18000', '24000', 'IPS and Solar'],
            ['CHARGER-12V', 'Smart Battery Charger 12V', '2200', '3200', 'Accessories'],
            ['TERMINAL', 'Battery Terminal Pair', '150', '250', 'Accessories'],
            ['ACID-1L', 'Battery Water 1L', '100', '180', 'Accessories'],
            ['OLD-40AH', 'Discontinued Battery 40Ah', '3000', '4200', 'Automotive']
        ];
        for (const [index, [sku, name, cost, price, category]] of productSpecs.entries())
            products.push(
                await master('products', {
                    sku: `DEMO-${sku}`,
                    name: `[DEMO] ${name}`,
                    category,
                    brand: index % 2 ? '[DEMO] PowerCell' : '[DEMO] VoltMax',
                    model: sku,
                    default_purchase_price: cost,
                    selling_price: price,
                    reorder_level_pcs: 10,
                    is_active: index !== 12
                })
            );
        const payments = [];
        for (const [type, name, opening] of [
            ['CASH', 'Showroom Cash', '500000'],
            ['BANK', 'Sample Bank', '1000000'],
            ['BKASH', 'bKash Wallet', '100000'],
            ['NAGAD', 'Nagad Wallet', '100000'],
            ['OTHER', 'Card Clearing', '100000']
        ]) {
            const gl = await master('chart_of_accounts', {
                code: `DEMO_${type}`,
                name: `[DEMO] ${name}`,
                account_type: 'ASSET'
            });
            const payment = await master('payment_accounts', {
                name: `[DEMO] ${name}`,
                account_type: type,
                gl_account_id: String(gl.id)
            });
            payments.push(payment);
            await manual(`opening-${type.toLowerCase()}`, {
                gl_date: date(-46),
                type: 'OPENING_BALANCE',
                reference_no: `DEMO-OPEN-${type}`,
                reason: `[DEMO] Initial ${name} float`,
                lines: [
                    { account_id: String(gl.id), debit: opening },
                    { account_id: accountIds.OPENING_EQUITY, credit: opening }
                ]
            });
        }
        await manual('opening-customer', {
            gl_date: date(-46),
            type: 'OPENING_BALANCE',
            reference_no: 'DEMO-OPEN-AR',
            reason: '[DEMO] Customer previous due',
            lines: [
                { account_id: accountIds.AR, customer_id: customers[0].id, debit: '12000' },
                { account_id: accountIds.OPENING_EQUITY, credit: '12000' }
            ]
        });
        await manual('opening-supplier', {
            gl_date: date(-46),
            type: 'OPENING_BALANCE',
            reference_no: 'DEMO-OPEN-AP',
            reason: '[DEMO] Supplier opening payable',
            lines: [
                { account_id: accountIds.OPENING_EQUITY, debit: '15000' },
                { account_id: accountIds.AP, supplier_id: suppliers[0].id, credit: '15000' }
            ]
        });

        onProgress('Posting opening stock, purchases and partial goods receipts');
        for (let index = 0; index < 11; index++)
            await document(`opening-main-${index}`, 'adjustments', {
                product_id: products[index].id,
                warehouse_id: warehouses[0].id,
                adjustment_date: date(-45),
                adjustment_type: 'OPENING',
                quantity_pcs: index === 10 ? 3 : 60,
                unit_cost: productSpecs[index][2],
                reason: '[DEMO] Showroom opening stock'
            });
        for (let index = 0; index < 6; index++)
            await document(`opening-branch-${index}`, 'adjustments', {
                product_id: products[index].id,
                warehouse_id: warehouses[1].id,
                adjustment_date: date(-45),
                adjustment_type: 'OPENING',
                quantity_pcs: 25,
                unit_cost: productSpecs[index][2],
                reason: '[DEMO] Branch opening stock'
            });
        const purchaseLine = (index, quantity, discount = '0') => ({
            product_id: products[index].id,
            quantity_pcs: quantity,
            unit_cost: productSpecs[index][2],
            discount_amount: discount
        });
        const purchase = await document('purchase-completed', 'purchases', {
            supplier_id: suppliers[0].id,
            warehouse_id: warehouses[0].id,
            purchase_date: date(-38),
            supplier_invoice_no: 'DEMO-SUP-001',
            notes: '[DEMO] Fully received in two deliveries',
            items: [purchaseLine(0, 40), purchaseLine(1, 30, '300')]
        });
        const receive = (label, source, quantities, offset, post = true) =>
            document(
                label,
                'grns',
                {
                    purchase_id: source.id,
                    received_date: date(offset),
                    items: quantities.map(([index, quantity]) => ({
                        purchase_item_id: String(source.items[index].id),
                        quantity_pcs: quantity
                    }))
                },
                post
            );
        const firstReceipt = await receive(
            'grn-first-delivery',
            purchase,
            [
                [0, 20],
                [1, 30]
            ],
            -37
        );
        const secondReceipt = await receive('grn-final-delivery', purchase, [[0, 20]], -35);
        const partialPurchase = await document('purchase-partial', 'purchases', {
            supplier_id: suppliers[1].id,
            warehouse_id: warehouses[1].id,
            purchase_date: date(-20),
            supplier_invoice_no: 'DEMO-SUP-002',
            notes: '[DEMO] Partially received; use Pending purchases for the remaining 25 PCS',
            items: [purchaseLine(2, 25), purchaseLine(3, 20)]
        });
        const branchReceipt = await receive(
            'grn-branch-partial',
            partialPurchase,
            [
                [0, 10],
                [1, 10]
            ],
            -19
        );
        await receive(
            'grn-draft',
            partialPurchase,
            [
                [0, 5],
                [1, 5]
            ],
            0,
            false
        );
        const ipsPurchase = await document('purchase-ips', 'purchases', {
            supplier_id: suppliers[2].id,
            warehouse_id: warehouses[0].id,
            purchase_date: date(-12),
            supplier_invoice_no: 'DEMO-SUP-003',
            notes: '[DEMO] IPS batteries and chargers',
            items: [purchaseLine(8, 10), purchaseLine(9, 30)]
        });
        const ipsReceipt = await receive(
            'grn-ips-complete',
            ipsPurchase,
            [
                [0, 10],
                [1, 30]
            ],
            -11
        );
        await document('purchase-pending', 'purchases', {
            supplier_id: suppliers[3].id,
            warehouse_id: warehouses[0].id,
            purchase_date: date(-2),
            supplier_invoice_no: 'DEMO-SUP-004',
            notes: '[DEMO] Confirmed but not received; no stock or payable yet',
            items: [purchaseLine(10, 20), purchaseLine(11, 50)]
        });
        await document(
            'purchase-draft',
            'purchases',
            {
                supplier_id: suppliers[0].id,
                warehouse_id: warehouses[0].id,
                purchase_date: date(),
                supplier_invoice_no: 'DEMO-SUP-DRAFT',
                notes: '[DEMO] Edit and confirm this purchase',
                items: [purchaseLine(2, 10), purchaseLine(3, 10)]
            },
            false
        );

        onProgress('Posting 37 sales with paid, partial and outstanding balances');
        const invoices = [];
        for (let index = 0; index < 36; index++) {
            const branch = index % 4 === 0;
            const productIndex = index % (branch ? 6 : 10);
            const nextIndex = (productIndex + 1) % (branch ? 6 : 10);
            const items = [productIndex, nextIndex].map((item, line) => ({
                product_id: products[item].id,
                quantity_pcs: line ? 1 : 1 + (index % 3),
                unit_price: productSpecs[item][3],
                discount_amount: !line && index % 7 === 0 ? '50' : '0'
            }));
            const discount = index % 7 === 0 ? '100' : '0';
            const total = items
                .reduce(
                    (sum, row) =>
                        sum.plus(D(row.unit_price).times(row.quantity_pcs).minus(row.discount_amount)),
                    D(0)
                )
                .minus(discount);
            const amount = index % 4 === 0 ? total.toFixed(2) : index % 4 === 1 ? '3000.00' : null;
            invoices.push(
                await document(
                    `sale-${index}`,
                    'sales',
                    {
                        customer_id: customers[index % 8].id,
                        warehouse_id: warehouses[branch ? 1 : 0].id,
                        invoice_date: date(-35 + Math.floor((index * 35) / 35)),
                        discount_amount: discount,
                        items
                    },
                    true,
                    amount
                        ? {
                              payment: {
                                  payment_account_id: payments[index % 5].id,
                                  amount,
                                  reference_no: `DEMO-SALE-${index}`
                              }
                          }
                        : {}
                )
            );
        }
        await document(
            'sale-retail-paid',
            'sales',
            {
                customer_id: customers[9].id,
                warehouse_id: warehouses[0].id,
                invoice_date: date(),
                items: [{ product_id: products[0].id, quantity_pcs: 1, unit_price: '5800' }]
            },
            true,
            {
                payment: {
                    payment_account_id: payments[0].id,
                    amount: '5800',
                    reference_no: 'DEMO-RETAIL-CASH'
                }
            }
        );
        await document(
            'sale-draft',
            'sales',
            {
                customer_id: customers[8].id,
                warehouse_id: warehouses[0].id,
                invoice_date: date(),
                items: [
                    { product_id: products[0].id, quantity_pcs: 2, unit_price: '5800' },
                    { product_id: products[10].id, quantity_pcs: 1, unit_price: '250' }
                ]
            },
            false
        );

        onProgress('Adding collections, supplier payments, returns and allocations');
        await document('receipt-multi-invoice', 'receipts', {
            customer_id: customers[1].id,
            receipt_date: date(-1),
            payment_account_id: payments[1].id,
            amount: '2000',
            reference_no: 'DEMO-MULTI-INVOICE',
            bank_name: '[DEMO] Sample Bank',
            cheque_number: '00000123',
            allocations: [
                { document_id: invoices[1].id, amount: '1000' },
                { document_id: invoices[9].id, amount: '1000' }
            ]
        });
        const laterReceipt = await document('receipt-later-allocation', 'receipts', {
            customer_id: customers[2].id,
            receipt_date: date(),
            payment_account_id: payments[2].id,
            amount: '2000',
            reference_no: 'DEMO-ALLOCATE-LATER'
        });
        await operations.addAllocations(
            'receipts',
            laterReceipt.id,
            {
                allocations: [{ document_id: invoices[2].id, amount: '1000' }]
            },
            actor,
            key('receipt-later-allocate')
        );
        await document('receipt-advance', 'receipts', {
            customer_id: customers[10].id,
            receipt_date: date(),
            payment_account_id: payments[3].id,
            amount: '5000',
            reference_no: 'DEMO-CUSTOMER-ADVANCE'
        });
        await document(
            'receipt-draft',
            'receipts',
            {
                customer_id: customers[0].id,
                receipt_date: date(),
                payment_account_id: payments[0].id,
                amount: '500',
                reference_no: 'DEMO-DRAFT-COLLECTION'
            },
            false
        );
        await document('payment-multi-grn', 'payments', {
            supplier_id: suppliers[0].id,
            payment_date: date(-10),
            payment_account_id: payments[1].id,
            amount: '15000',
            reference_no: 'DEMO-MULTI-GRN',
            allocations: [
                { document_id: firstReceipt.id, amount: '10000' },
                { document_id: secondReceipt.id, amount: '5000' }
            ]
        });
        const laterPayment = await document('payment-later-allocation', 'payments', {
            supplier_id: suppliers[0].id,
            payment_date: date(-5),
            payment_account_id: payments[0].id,
            amount: '5000',
            reference_no: 'DEMO-PAYMENT-ALLOCATE-LATER'
        });
        await operations.addAllocations(
            'payments',
            laterPayment.id,
            {
                allocations: [{ document_id: firstReceipt.id, amount: '5000' }]
            },
            actor,
            key('payment-later-allocate')
        );
        for (const [index, supplier, grn, amount, account] of [
            [1, suppliers[1], branchReceipt, '10000', payments[1]],
            [2, suppliers[2], ipsReceipt, '6000', payments[2]]
        ])
            await document(`payment-supplier-${index}`, 'payments', {
                supplier_id: supplier.id,
                payment_date: date(-3),
                payment_account_id: account.id,
                amount,
                reference_no: `DEMO-SUPPLIER-PAY-${index}`,
                allocations: [{ document_id: grn.id, amount }]
            });
        await document(
            'payment-draft',
            'payments',
            {
                supplier_id: suppliers[0].id,
                payment_date: date(),
                payment_account_id: payments[0].id,
                amount: '1000',
                reference_no: 'DEMO-DRAFT-PAYMENT'
            },
            false
        );
        for (const [label, invoice, saleable] of [
            ['return-saleable', invoices[3], true],
            ['return-damaged', invoices[6], false]
        ])
            await document(label, 'sales-returns', {
                sales_invoice_id: invoice.id,
                return_date: date(-1),
                items: [{ sales_invoice_item_id: String(invoice.items[0].id), quantity_pcs: 1, saleable }]
            });
        await document('return-full-paid-invoice', 'sales-returns', {
            sales_invoice_id: invoices[0].id,
            return_date: date(),
            items: invoices[0].items.map((row) => ({
                sales_invoice_item_id: String(row.id),
                quantity_pcs: row.quantity_pcs,
                saleable: true
            }))
        });
        await document(
            'return-sales-draft',
            'sales-returns',
            {
                sales_invoice_id: invoices[5].id,
                return_date: date(),
                items: [
                    {
                        sales_invoice_item_id: String(invoices[5].items[0].id),
                        quantity_pcs: 1,
                        saleable: true
                    }
                ]
            },
            false
        );
        await document('return-purchase', 'purchase-returns', {
            goods_receipt_id: firstReceipt.id,
            return_date: date(-1),
            items: [{ goods_receipt_item_id: String(firstReceipt.items[0].id), quantity_pcs: 2 }]
        });
        await document(
            'return-purchase-draft',
            'purchase-returns',
            {
                goods_receipt_id: ipsReceipt.id,
                return_date: date(),
                items: [{ goods_receipt_item_id: String(ipsReceipt.items[1].id), quantity_pcs: 1 }]
            },
            false
        );

        onProgress('Adding stock corrections, expenses and reversible accounting entries');
        for (const [label, index, type, quantity, post] of [
            ['stock-increase', 9, 'INCREASE', 2, true],
            ['stock-decrease', 0, 'DECREASE', 1, true],
            ['stock-draft', 10, 'INCREASE', 3, false]
        ])
            await document(
                label,
                'adjustments',
                {
                    product_id: products[index].id,
                    warehouse_id: warehouses[0].id,
                    adjustment_date: date(),
                    adjustment_type: type,
                    quantity_pcs: quantity,
                    unit_cost: productSpecs[index][2],
                    reason: `[DEMO] ${label}`
                },
                post
            );
        for (const [index, [name, amount, offset, account]] of [
            ['Shop rent', '12000', -25, 1],
            ['Utilities', '1500', -20, 0],
            ['Transport', '800', -15, 2],
            ['Transport', '600', -8, 3],
            ['Repairs', '750', -5, 0],
            ['Courier', '300', -3, 3],
            ['Office supplies', '450', 0, 4]
        ].entries())
            await document(`expense-${index}`, 'expenses', {
                expense_date: date(offset),
                expense_name: `[DEMO] ${name}`,
                payment_account_id: payments[account].id,
                amount,
                notes: '[DEMO] Posted operating expense'
            });
        const reversedExpense = await document('expense-reversed', 'expenses', {
            expense_date: date(-2),
            expense_name: '[DEMO] Incorrect delivery charge',
            payment_account_id: payments[0].id,
            amount: '650',
            notes: '[DEMO] Reversed on the next day for correction testing'
        });
        const [[expenseJournal]] = await db.execute(
            "SELECT id FROM journal_entries WHERE source_type='EXPENSES' AND source_id=?",
            [reversedExpense.id]
        );
        await journals.reverse(
            String(expenseJournal.id),
            { gl_date: date(-1), reason: '[DEMO] Duplicate delivery charge correction' },
            actor,
            key('reverse-expense')
        );
        await document(
            'expense-draft',
            'expenses',
            {
                expense_date: date(),
                expense_name: '[DEMO] Draft stationery',
                payment_account_id: payments[0].id,
                amount: '999',
                notes: '[DEMO] Edit and post this expense'
            },
            false
        );
        await manual('manual-bank-fee', {
            gl_date: date(),
            type: 'ADJUSTMENT',
            reference_no: 'DEMO-BANK-FEE',
            reason: '[DEMO] Manual bank fee adjustment',
            lines: [
                { account_id: accountIds.EXPENSE, debit: '100' },
                { account_id: payments[1].gl_account_id, credit: '100' }
            ]
        });
        const correction = await manual('manual-reversal-example', {
            gl_date: date(-2),
            type: 'ADJUSTMENT',
            reference_no: 'DEMO-JV-REVERSAL',
            reason: '[DEMO] Adjustment to demonstrate reversal',
            lines: [
                { account_id: accountIds.EXPENSE, debit: '250' },
                { account_id: payments[0].gl_account_id, credit: '250' }
            ]
        });
        await journals.reverse(
            correction.id,
            { gl_date: date(-1), reason: '[DEMO] Reverse sample adjustment' },
            actor,
            key('reverse-manual')
        );
        if (!(await marker('DEMO_SEED_COMPLETE')))
            await withTransaction((tx) =>
                audit(tx, actor, 'DEMO_SEED_COMPLETE', 'demo_dataset', null, {
                    dataset: DATASET,
                    anchorDate,
                    documentCount: documents.length
                })
            );
        // Refresh statuses so replaying after a tester posts a draft does not misreport it.
        for (const entry of documents) entry.status = (await operations.get(entry.kind, entry.id)).status;
        return {
            database: database.name,
            dataset: DATASET,
            from: date(-46),
            to: anchorDate,
            users: users.map(({ email, role }) => ({ email, role })),
            products: products.map(({ id, sku }) => ({ id, sku })),
            customers: customers.map(({ id, name }) => ({ id, name })),
            suppliers: suppliers.map(({ id, name }) => ({ id, name })),
            warehouses: warehouses.map(({ id, name }) => ({ id, name })),
            paymentAccounts: payments.map(({ id, name }) => ({ id, name })),
            documents,
            reconciliation: await reports.reconciliation()
        };
    } finally {
        try {
            if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
        } finally {
            connection.release();
        }
    }
};

if (require.main === module) {
    seedDemo({ onProgress: (message) => console.log(message) })
        .then((result) => {
            const fs = require('node:fs');
            const path = require('node:path');
            const destination = path.resolve(__dirname, '../../artifacts/demo-data.json');
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
            console.log(
                `Demo data ready in ${result.database}: ${result.products.length} products, ${result.customers.length} customers, ${result.documents.length} documents.`
            );
            console.log(`Report period: ${result.from} through ${result.to}`);
            console.log(`Demo accounts and voucher references: ${destination}`);
            console.log(JSON.stringify(result.reconciliation, null, 2));
            console.log(`Demo account password: ${DEMO_PASSWORD}`);
        })
        .catch((error) => {
            console.error('Demo data loader:', error.message);
            process.exitCode = 1;
        })
        .finally(() => db.end());
}

module.exports = { seedDemo, DEMO_PASSWORD };
