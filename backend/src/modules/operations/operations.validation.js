const { z } = require('zod');
const { id, price, currency, text, optional } = require('../catalog/catalog.validation');
const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
        const d = new Date(`${v}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, 'Invalid calendar date');
const qty = z.number().int().positive().max(2147483647);
const items = (shape) =>
    z
        .array(z.object(shape).strict())
        .min(1)
        .max(200)
        .refine(
            (rows) =>
                new Set(
                    rows.map((r) =>
                        String(
                            r.product_id ||
                                r.purchase_item_id ||
                                r.sales_invoice_item_id ||
                                r.goods_receipt_item_id
                        )
                    )
                ).size === rows.length,
            'Each product or source line must occur only once'
        );
const allocations = z
    .array(z.object({ document_id: id, amount: currency }).strict())
    .max(200)
    .default([])
    .refine(
        (rows) => new Set(rows.map((r) => String(r.document_id))).size === rows.length,
        'Duplicate allocation'
    );
const payment = {
    payment_account_id: id,
    amount: currency,
    reference_no: optional(80),
    bank_name: optional(160),
    cheque_number: optional(80),
    allocations
};
const schemas = {
    purchases: z
        .object({
            supplier_id: id,
            warehouse_id: id,
            purchase_date: date,
            supplier_invoice_no: optional(80),
            notes: optional(255),
            items: items({
                product_id: id,
                quantity_pcs: qty,
                unit_cost: price,
                discount_amount: currency.default('0')
            })
        })
        .strict(),
    sales: z
        .object({
            customer_id: id,
            warehouse_id: id,
            invoice_date: date,
            discount_amount: currency.default('0'),
            items: items({
                product_id: id,
                quantity_pcs: qty,
                unit_price: price,
                discount_amount: currency.default('0')
            })
        })
        .strict(),
    grns: z
        .object({
            purchase_id: id,
            received_date: date,
            items: items({ purchase_item_id: id, quantity_pcs: qty })
        })
        .strict(),
    receipts: z.object({ ...payment, customer_id: id, receipt_date: date }).strict(),
    payments: z.object({ ...payment, supplier_id: id, payment_date: date }).strict(),
    'sales-returns': z
        .object({
            sales_invoice_id: id,
            return_date: date,
            items: items({
                sales_invoice_item_id: id,
                quantity_pcs: qty,
                saleable: z.boolean().default(true)
            })
        })
        .strict(),
    'purchase-returns': z
        .object({
            goods_receipt_id: id,
            return_date: date,
            items: items({ goods_receipt_item_id: id, quantity_pcs: qty })
        })
        .strict(),
    adjustments: z
        .object({
            product_id: id,
            warehouse_id: id,
            adjustment_date: date,
            adjustment_type: z.enum(['OPENING', 'INCREASE', 'DECREASE']),
            quantity_pcs: qty,
            unit_cost: price,
            reason: text(255)
        })
        .strict(),
    expenses: z
        .object({
            expense_date: date,
            expense_name: text(120),
            payment_account_id: id,
            amount: currency,
            notes: optional(255)
        })
        .strict()
};
module.exports = { schemas, date, qty, allocations };
