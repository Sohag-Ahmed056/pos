const db = require('../../config/db');
const { pagination, id } = require('./catalog.validation');
const { date } = require('../operations/operations.validation');
const { z } = require('zod');
const { assert } = require('../../shared/financial');
const { documentReaders, movementReaders } = require('../../shared/permissions');
const historyFilters = pagination
    .extend({
        type: z.enum(['movements', 'purchases', 'sales', 'transactions']).optional(),
        from: date.optional(),
        to: date.optional()
    })
    .refine((f) => !f.from || !f.to || f.from <= f.to, 'From date must not exceed to date');

const history = async (resource, rawId, query, user) => {
    assert(['products', 'customers', 'suppliers'].includes(resource), 'History is not supported', 404);
    const key = id.parse(rawId),
        f = historyFilters.parse(query);
    const type = resource === 'products' ? f.type || 'movements' : 'transactions';
    assert(
        resource !== 'products' || type !== 'transactions',
        'Choose stock movements, purchases, or sales',
        400
    );
    const kind = resource === 'customers' ? 'sales' : resource === 'suppliers' ? 'purchases' : type;
    const roles = kind === 'movements' ? movementReaders : documentReaders[kind];
    assert(roles.includes(user?.role), 'You do not have permission to view this history', 403);
    const [[exists]] = await db.execute(`SELECT id FROM ${resource} WHERE id=?`, [key]);
    assert(exists, 'Record not found', 404);
    let columns, from, field, dateField, searchFields, order;
    if (resource === 'products' && type === 'movements') {
        columns = `m.*,w.name warehouse,
          CASE m.source_type WHEN 'GRN' THEN 'grns' WHEN 'SALE' THEN 'sales' WHEN 'SALE_RETURN' THEN 'sales-returns' WHEN 'PURCHASE_RETURN' THEN 'purchase-returns' WHEN 'ADJUSTMENT' THEN 'adjustments' END document_resource,
          CASE m.source_type WHEN 'GRN' THEN g.goods_receipt_id WHEN 'SALE' THEN s.sales_invoice_id WHEN 'SALE_RETURN' THEN sr.sales_return_id WHEN 'PURCHASE_RETURN' THEN pr.purchase_return_id WHEN 'ADJUSTMENT' THEN m.source_line_id END document_id`;
        from = `stock_movements m JOIN warehouses w ON w.id=m.warehouse_id
          LEFT JOIN goods_receipt_items g ON m.source_type='GRN' AND g.id=m.source_line_id
          LEFT JOIN sales_invoice_items s ON m.source_type='SALE' AND s.id=m.source_line_id
          LEFT JOIN sales_return_items sr ON m.source_type='SALE_RETURN' AND sr.id=m.source_line_id
          LEFT JOIN purchase_return_items pr ON m.source_type='PURCHASE_RETURN' AND pr.id=m.source_line_id`;
        field = 'm.product_id';
        dateField = 'm.occurred_at';
        searchFields = ['m.movement_type', 'w.name', 'm.source_type'];
        order = 'm.occurred_at DESC,m.id DESC';
    } else {
        const sale = kind === 'sales';
        const table = sale ? 'sales_invoices' : 'purchases';
        const number = sale ? 'invoice_no' : 'purchase_no';
        dateField = sale ? 'h.invoice_date' : 'h.purchase_date';
        columns = `h.*,h.id document_id,'${kind}' document_resource,h.${number} document_no`;
        from = `${table} h`;
        field = resource === 'products' ? 'i.product_id' : `h.${sale ? 'customer_id' : 'supplier_id'}`;
        if (resource === 'products') {
            from += ` JOIN ${sale ? 'sales_invoice_items' : 'purchase_items'} i ON i.${sale ? 'sales_invoice_id' : 'purchase_id'}=h.id`;
            columns += `,i.quantity_pcs,i.${sale ? 'unit_price' : 'unit_cost'},ROUND(i.quantity_pcs*i.${sale ? 'unit_price' : 'unit_cost'},2)-i.discount_amount line_amount`;
        }
        searchFields = [`h.${number}`];
        order = `${dateField} DESC,h.id DESC`;
    }
    const clauses = [`${field}=?`],
        params = [key];
    if (f.search) {
        clauses.push(`(${searchFields.map((column) => `${column} LIKE ?`).join(' OR ')})`);
        params.push(...searchFields.map(() => `%${f.search}%`));
    }
    if (f.from) {
        clauses.push(`${dateField}>=?`);
        params.push(f.from);
    }
    if (f.to) {
        clauses.push(`${dateField}<=CONCAT(?, ' 23:59:59.999999')`);
        params.push(f.to);
    }
    const source = `FROM ${from} WHERE ${clauses.join(' AND ')}`;
    const [[data], [[count]]] = await Promise.all([
        db.query(`SELECT ${columns} ${source} ORDER BY ${order} LIMIT ? OFFSET ?`, [
            ...params,
            f.limit,
            (f.page - 1) * f.limit
        ]),
        db.execute(`SELECT COUNT(*) total ${source}`, params)
    ]);
    return {
        data,
        meta: {
            page: f.page,
            limit: f.limit,
            total: Number(count.total),
            pages: Math.ceil(Number(count.total) / f.limit)
        }
    };
};
module.exports = { history };
