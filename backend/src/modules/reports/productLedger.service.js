const db = require('../../config/db');
const { z } = require('zod');
const { D, money, cost, assert } = require('../../shared/financial');
const { salesCtes, purchaseCtes, movementCtes } = require('./productLedger.queries');
const { buildProductStatement } = require('./productLedger.layout');

const id = z.string().regex(/^[1-9]\d{0,19}$/);
const optionalId = z.preprocess((value) => (value === '' ? undefined : value), id.optional());
const date = z.iso.date();
const filtersSchema = z
    .object({
        from: z.preprocess((value) => value || undefined, date.default('1900-01-01')),
        to: z.preprocess((value) => value || undefined, date.default('9999-12-31')),
        product_id: optionalId,
        warehouse_id: optionalId,
        customer_id: optionalId,
        supplier_id: optionalId,
        type: z
            .enum([
                '',
                'ORDER',
                'GRN',
                'SALE',
                'SALE_RETURN',
                'PURCHASE_RETURN',
                'OPENING',
                'ADJUST_IN',
                'ADJUST_OUT'
            ])
            .default(''),
        search: z.string().trim().max(100).default(''),
        voucher: z.string().trim().max(80).default(''),
        page: z.coerce.number().int().min(1).max(10000000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        section: z
            .enum(['movements', 'sales', 'purchases', 'sales-returns', 'purchase-returns'])
            .default('movements'),
        format: z.enum(['json', 'pdf', 'print', 'xlsx']).optional()
    })
    .refine((value) => value.from <= value.to, {
        message: 'Start date must not follow end date',
        path: ['to']
    });

// mysql2 query(sql, values) binds and escapes every value. Use its bound text
// protocol for these window/UNION CTEs: MySQL 8.0.45 can incorrectly reuse pushed
// predicates in cached prepared CTE executions. Regression tests repeat product
// filters and pages on the same pooled connections. SQL identifiers remain fixed.
// One consistent read snapshot covers rows, summaries, current balances and export metadata.
// Reports never lock business rows or change stock, journals or posted documents.
const snapshot = async (work) => {
    const tx = await db.getConnection();
    try {
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await tx.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const result = await work(tx);
        await tx.commit();
        return result;
    } catch (error) {
        await tx.rollback();
        throw error;
    } finally {
        tx.release();
    }
};
const metadata = async (tx, table, selectedId) => {
    assert(['customers', 'suppliers', 'products'].includes(table), 'Invalid selection');
    const [[selection]] = await tx.query(`SELECT * FROM ${table} WHERE id=?`, [id.parse(String(selectedId))]);
    assert(selection, 'Selected record not found', 404);
    const [[company]] = await tx.query('SELECT * FROM company_settings LIMIT 1');
    return { selection, company };
};
const criteria = (filters, movement = false) => {
    const parts = [],
        params = [];
    const bind = (sql, value) => {
        parts.push(sql);
        params.push(value);
    };
    bind(`${movement ? 'occurred_at' : 'date'} >= ?`, filters.from);
    bind(`${movement ? "occurred_at <= CONCAT(?,' 23:59:59.999999')" : 'date <= ?'}`, filters.to);
    for (const field of ['product_id', 'warehouse_id', 'customer_id', 'supplier_id'])
        if (filters[field]) bind(`${field}=?`, filters[field]);
    if (filters.type) bind(`${movement ? 'movement_type' : 'type'}=?`, filters.type);
    // LOCATE treats %, _ and backslashes as literal search characters.
    if (filters.voucher)
        bind(
            "LOCATE(?,CONCAT_WS(' ',voucher," +
                (movement ? 'reference' : 'original_voucher,order_voucher') +
                '))>0',
            filters.voucher
        );
    if (filters.search)
        bind(
            "LOCATE(?,CONCAT_WS(' ',product,sku,voucher,party," +
                (movement ? 'reference' : 'original_voucher,order_voucher') +
                '))>0',
            filters.search
        );
    return { sql: parts.join(' AND '), params };
};
const activityAggregate = `COALESCE(SUM(sold),0) sold,COALESCE(SUM(received),0) received,
 COALESCE(SUM(returned),0) returned,COALESCE(SUM(ordered),0) ordered,
 COALESCE(SUM(net_quantity),0) net_quantity,COALESCE(SUM(gross_amount),0) gross_amount,
 COALESCE(SUM(discount),0) discount,COALESCE(SUM(amount),0) amount,
 COALESCE(SUM(ordered_value),0) ordered_value`;
const pagination = (total, filters, all) => ({
    total: Number(total),
    page: all ? 1 : filters.page,
    limit: all ? Number(total) : filters.limit,
    pages: all ? 1 : Math.ceil(Number(total) / filters.limit)
});
const exportLimit = (total, all) =>
    assert(!all || Number(total) <= 50000, 'Export exceeds 50,000 rows. Narrow the dates or filters.');

const activity = async (tx, kind, filters, all, details) => {
    const sale = kind === 'customer';
    // Scope by party before windows, but never by product before invoice discount windows.
    const selected = filters[sale ? 'customer_id' : 'supplier_id'];
    const scopes = selected ? [`${sale ? 'h.customer_id' : 'p.supplier_id'}=?`] : [];
    const parameters = selected ? [selected] : [];
    if (filters.product_id) {
        // Restrict eligible invoices, keeping every line of each eligible invoice
        // inside the discount window. Purchase discounts are already line based.
        scopes.push(
            sale
                ? 'EXISTS (SELECT 1 FROM sales_invoice_items eligible WHERE eligible.sales_invoice_id=h.id AND eligible.product_id=?)'
                : 'i.product_id=?'
        );
        parameters.push(filters.product_id);
    }
    const scope = scopes.join(' AND ') || '1=1';
    const ctes = sale ? salesCtes(scope) : purchaseCtes(scope);
    const source = sale ? 'sales_activity' : 'purchase_activity';
    const where = criteria(filters);
    const prefix = `WITH ${ctes}, filtered AS (SELECT * FROM ${source} WHERE ${where.sql})`;
    const args = [...parameters, ...where.params];
    const [[totals]] = await tx.query(
        `${prefix} SELECT COUNT(*) count,${activityAggregate} FROM filtered`,
        args
    );
    exportLimit(totals.count, all);
    const [products] = await tx.query(
        `${prefix} SELECT product_id,MIN(product) product,MIN(sku) sku,
        ${activityAggregate} FROM filtered GROUP BY product_id ORDER BY product_id`,
        args
    );
    const [rows] = await tx.query(
        `${prefix} SELECT *,
        CASE WHEN type='ORDER' THEN ROUND(ordered_value/NULLIF(ordered,0),4)
        ELSE ROUND(ABS(amount)/NULLIF(ABS(net_quantity),0),4) END adjusted_rate
        FROM filtered ORDER BY date,sort_at,document_resource,document_id,line_id
        LIMIT ? OFFSET ?`,
        [...args, all ? 50000 : filters.limit, all ? 0 : (filters.page - 1) * filters.limit]
    );
    for (const row of rows)
        row.return_condition =
            row.type === 'SALE_RETURN' ? (D(row.saleable).eq(1) ? 'Saleable' : 'Damaged / no stock in') : '';
    const result = {
        name: `${kind}-product-ledger`,
        kind,
        period: { from: filters.from, to: filters.to },
        filters,
        selection: details.selection,
        rows,
        products,
        totals,
        meta: pagination(totals.count, filters, all),
        note: sale
            ? 'Posted sales and all posted returns, including damaged returns. Discounts include the original line and allocated invoice discount. Negative amounts reverse sales. Financial dues remain in the Financial Ledger.'
            : 'Confirmed orders are shown separately with zero received value. Only posted GRNs and returns affect received quantities and value. Adjusted unit cost is rounded to four decimals; the stored receipt amount and exact return basis determine totals.'
    };
    result.statement = buildProductStatement(result, details.company);
    return result;
};

// A sale/outflow stores the average cost in effect at that point. This is an exact
// historical anchor. Only the incoming tail after the last outflow needs replaying.
// Replay uses stock()'s four-decimal weighted average and two-decimal book valuation.
const replayValuation = (rows) => {
    const warehouses = new Map();
    for (const row of rows) {
        let state = warehouses.get(String(row.warehouse_id));
        if (!state) {
            state = { quantity: D(0), avg_cost: D(0) };
            warehouses.set(String(row.warehouse_id), state);
        }
        if (Number(row.anchor) === 1) {
            state.quantity = D(row.warehouse_running_quantity);
            state.avg_cost = cost(row.unit_cost);
        } else {
            const next = state.quantity.plus(row.quantity_delta_pcs);
            assert(
                D(row.quantity_delta_pcs).gt(0) && next.gt(0),
                'Invalid historical stock valuation sequence',
                409
            );
            state.avg_cost = cost(
                state.avg_cost
                    .times(state.quantity)
                    .plus(D(row.unit_cost).times(row.quantity_delta_pcs))
                    .div(next)
            );
            state.quantity = next;
        }
    }
    return [...warehouses].map(([warehouse_id, state]) => ({
        warehouse_id,
        quantity: state.quantity.toFixed(0),
        avg_cost: state.avg_cost.toFixed(4),
        value: money(state.quantity.times(state.avg_cost)).toFixed(2)
    }));
};
const historicalValuation = async (tx, ctes, args, boundary, before) => {
    const [rows] = await tx.query(
        `WITH ${ctes}, numbered AS (
        SELECT m.*,ROW_NUMBER() OVER(PARTITION BY warehouse_id ORDER BY occurred_at,id) sequence_no
        FROM physical_movements m WHERE occurred_at ${before ? '< ?' : "<= CONCAT(?,' 23:59:59.999999')"}
    ), anchors AS (
        SELECT warehouse_id,MAX(CASE WHEN quantity_delta_pcs<0 THEN sequence_no ELSE 0 END) anchor_no
        FROM numbered GROUP BY warehouse_id
    ) SELECT n.*,n.sequence_no=a.anchor_no anchor FROM numbered n
      JOIN anchors a ON a.warehouse_id=n.warehouse_id
      WHERE n.sequence_no>=a.anchor_no ORDER BY n.occurred_at,n.id`,
        [...args, boundary]
    );
    return replayValuation(rows);
};
const total = (rows, key, places = 0) =>
    rows.reduce((value, row) => value.plus(row[key] || 0), D(0)).toFixed(places);

const productStock = async (tx, filters, all, details) => {
    const ctes = movementCtes(!!filters.warehouse_id);
    const args = [filters.product_id, ...(filters.warehouse_id ? [filters.warehouse_id] : [])];
    const where = criteria(filters, true);
    const prefix = `WITH ${ctes}, filtered AS (SELECT * FROM physical_movements WHERE ${where.sql})`;
    const [[visible]] = await tx.query(
        `${prefix} SELECT COUNT(*) count,
        COALESCE(SUM(quantity_in),0) quantity_in,COALESCE(SUM(quantity_out),0) quantity_out FROM filtered`,
        [...args, ...where.params]
    );
    exportLimit(visible.count, all);
    const [rows] = await tx.query(
        `${prefix} SELECT * FROM filtered ORDER BY occurred_at,id LIMIT ? OFFSET ?`,
        [...args, ...where.params, all ? 50000 : filters.limit, all ? 0 : (filters.page - 1) * filters.limit]
    );
    const [physical] = await tx.query(
        `WITH ${ctes} SELECT warehouse_id,MAX(warehouse) warehouse,
        SUM(CASE WHEN occurred_at<? THEN quantity_delta_pcs ELSE 0 END) opening,
        SUM(CASE WHEN occurred_at>=? AND occurred_at<=CONCAT(?,' 23:59:59.999999') THEN quantity_in ELSE 0 END) quantity_in,
        SUM(CASE WHEN occurred_at>=? AND occurred_at<=CONCAT(?,' 23:59:59.999999') THEN quantity_out ELSE 0 END) quantity_out,
        SUM(CASE WHEN occurred_at<=CONCAT(?,' 23:59:59.999999') THEN quantity_delta_pcs ELSE 0 END) closing,
        SUM(quantity_delta_pcs) all_time_quantity FROM physical_movements GROUP BY warehouse_id`,
        [...args, filters.from, filters.from, filters.to, filters.from, filters.to, filters.to]
    );
    const [balances] = await tx.query(
        `SELECT b.*,w.name warehouse,ROUND(b.on_hand_pcs*b.avg_cost,2) value
        FROM inventory_balances b JOIN warehouses w ON w.id=b.warehouse_id
        WHERE b.product_id=? ${filters.warehouse_id ? 'AND b.warehouse_id=?' : ''} ORDER BY b.warehouse_id`,
        args
    );
    const openingValues = await historicalValuation(tx, ctes, args, filters.from, true);
    const closingValues = await historicalValuation(tx, ctes, args, filters.to, false);
    const byId = new Map(physical.map((row) => [String(row.warehouse_id), row]));
    const current = new Map(balances.map((row) => [String(row.warehouse_id), row]));
    const warehouses = [...new Set([...byId.keys(), ...current.keys()])].map((warehouseId) => {
        const movement = byId.get(warehouseId),
            balance = current.get(warehouseId);
        const row = {
            warehouse_id: warehouseId,
            warehouse: movement?.warehouse || balance.warehouse,
            opening: String(movement?.opening || 0),
            quantity_in: String(movement?.quantity_in || 0),
            quantity_out: String(movement?.quantity_out || 0),
            closing: String(movement?.closing || 0),
            all_time_quantity: String(movement?.all_time_quantity || 0),
            current_quantity: String(balance?.on_hand_pcs || 0),
            current_avg_cost: balance?.avg_cost || '0.0000',
            current_value: balance?.value || '0.00',
            opening_value: openingValues.find((value) => value.warehouse_id === warehouseId)?.value || '0.00',
            closing_value: closingValues.find((value) => value.warehouse_id === warehouseId)?.value || '0.00'
        };
        row.reconciled = D(row.all_time_quantity).eq(row.current_quantity);
        row.low_stock = D(row.current_quantity).lte(details.selection.reorder_level_pcs);
        return row;
    });
    const stock = Object.fromEntries(
        ['opening', 'quantity_in', 'quantity_out', 'closing', 'all_time_quantity', 'current_quantity'].map(
            (key) => [key, total(warehouses, key)]
        )
    );
    for (const key of ['opening_value', 'closing_value', 'current_value'])
        stock[key] = total(warehouses, key, 2);
    const weightedValue = balances.reduce(
        (value, row) => value.plus(D(row.avg_cost).times(row.on_hand_pcs)),
        D(0)
    );
    stock.current_avg_cost = D(stock.current_quantity).eq(0)
        ? '0.0000'
        : cost(weightedValue.div(stock.current_quantity)).toFixed(4);
    stock.reconciled = warehouses.every((row) => row.reconciled);
    stock.low_stock = D(stock.current_quantity).lte(details.selection.reorder_level_pcs);
    const result = {
        name: 'product-stock-ledger',
        kind: 'stock',
        period: { from: filters.from, to: filters.to },
        filters,
        selection: { ...details.selection, unit: 'PCS' },
        stock,
        warehouses,
        rows,
        totals: { quantity_in: String(visible.quantity_in), quantity_out: String(visible.quantity_out) },
        meta: pagination(visible.count, filters, all),
        profitability: {
            available: false,
            reason: 'Historical movement unit costs are retained, but per-line booked COGS is not stored. Weighted-cost rounding can differ from quantity × unit cost. Exact product gross profit is therefore not reported.'
        },
        note: 'Physical opening, running and closing PCS include every posted movement in the selected product/warehouse scope. Customer, supplier, type and search filters only narrow visible rows. Times are UTC posting times. Movement cost is signed quantity × historical inventory unit cost; it is not sales revenue or exact booked COGS. Historical valuation replays the original four-decimal weighted-cost rule.'
    };
    result.statement = buildProductStatement(result, details.company);
    return result;
};

const partyLedger = (kind, partyId, query = {}, all = false) =>
    snapshot(async (tx) => {
        assert(['customer', 'supplier'].includes(kind), 'Invalid product ledger');
        const filters = filtersSchema.parse(query);
        filters[`${kind}_id`] = id.parse(String(partyId));
        // Cross-party filters are not meaningful on a selected party report.
        assert(
            !filters[kind === 'customer' ? 'supplier_id' : 'customer_id'],
            'Use the selected party filter only'
        );
        const details = await metadata(tx, kind === 'customer' ? 'customers' : 'suppliers', partyId);
        return activity(tx, kind, filters, all, details);
    });
const productLedger = (productId, query = {}, all = false) =>
    snapshot(async (tx) => {
        const filters = filtersSchema.parse(query);
        filters.product_id = id.parse(String(productId));
        const details = await metadata(tx, 'products', productId);
        if (filters.section === 'movements') return productStock(tx, filters, all, details);
        const sale = ['sales', 'sales-returns'].includes(filters.section);
        if (filters.section.endsWith('-returns')) filters.type = sale ? 'SALE_RETURN' : 'PURCHASE_RETURN';
        return activity(tx, sale ? 'customer' : 'supplier', filters, all, details);
    });

module.exports = { partyLedger, productLedger, filtersSchema, replayValuation };
