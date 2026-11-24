import Decimal from 'decimal.js';
import { today } from '../../../lib/format.js';
import { documentTypes } from '../config/documentTypes.js';
const decimal = (value) =>
    new Decimal(value === '' || value === null || value === undefined ? 0 : String(value));
const amount = (value) => decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const hasProductLines = (kind) => ['sales', 'purchases'].includes(kind);
export const isPaymentDocument = (kind) => ['receipts', 'payments'].includes(kind);
export const createDocumentDraft = (kind, initial) => {
    return {
        ...initial,
        [documentTypes[kind].date]: initial?.[documentTypes[kind].date] || today(),
        discount_amount: initial?.discount_amount || 0,
        quantity_pcs: initial?.quantity_pcs || 1,
        unit_cost: initial?.unit_cost || 0,
        adjustment_type: initial?.adjustment_type || 'OPENING'
    };
};
export const sourceItems = (kind, source, initial) => {
    const key = documentTypes[kind].sourceLine;
    return (source.items || []).map((row) => {
        const saved = initial?.items?.find((item) => String(item[key]) === String(row.id));
        return {
            ...row,
            source_id: row.id,
            source_quantity_pcs: row.quantity_pcs,
            source_line_amount: kind === 'grns' ? lineTotal(row) : row.return_basis_amount,
            quantity_pcs: saved?.quantity_pcs || 0,
            saleable: saved ? !!saved.saleable : true
        };
    });
};
export const addProductLine = (items, product, kind) => {
    const exists = items.some((item) => String(item.product_id) === String(product.id));
    if (exists)
        return items.map((item) =>
            String(item.product_id) === String(product.id)
                ? { ...item, quantity_pcs: Number(item.quantity_pcs) + 1 }
                : item
        );
    return [
        ...items,
        {
            product_id: String(product.id),
            product_name_snapshot: product.name,
            sku_snapshot: product.sku,
            quantity_pcs: 1,
            [kind === 'sales' ? 'unit_price' : 'unit_cost']:
                kind === 'sales' ? product.selling_price : product.default_purchase_price,
            discount_amount: 0
        }
    ];
};
export const lineTotal = (item) => {
    return amount(decimal(item.quantity_pcs).times(decimal(item.unit_price ?? item.unit_cost ?? 0)))
        .minus(decimal(item.discount_amount))
        .toFixed(2);
};
export const documentTotals = (items, discount = 0, previous = 0, paid = 0) => {
    const subtotal = items.reduce((sum, item) => sum.plus(lineTotal(item)), decimal(0));
    const total = subtotal.minus(decimal(discount));
    const payable = decimal(previous).plus(total);
    return {
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        previous: amount(previous).toFixed(2),
        payable: payable.toFixed(2),
        closing: payable.minus(decimal(paid)).toFixed(2)
    };
};
export const serializeAllocations = (allocations) =>
    Object.entries(allocations)
        .filter(([, value]) => Number(value) > 0)
        .map(([document_id, value]) => ({ document_id, amount: String(value) }));
export const serializeDocument = (kind, { form, items, allocations = {} }) => {
    const config = documentTypes[kind];
    const sale = kind === 'sales';
    const value = { [config.date]: form[config.date] };
    if (config.party) value[config.party] = form[config.party];
    if (config.source) value[config.source] = form[config.source];
    if (hasProductLines(kind) || kind === 'adjustments') value.warehouse_id = form.warehouse_id;
    if (hasProductLines(kind))
        value.items = items.map((item) => ({
            product_id: String(item.product_id),
            quantity_pcs: Number(item.quantity_pcs),
            [sale ? 'unit_price' : 'unit_cost']: String(item.unit_price ?? item.unit_cost),
            discount_amount: String(item.discount_amount || 0)
        }));
    if (sale) value.discount_amount = String(form.discount_amount || 0);
    if (kind === 'purchases') {
        value.supplier_invoice_no = form.supplier_invoice_no || null;
        value.notes = form.notes || null;
    }
    if (config.source)
        value.items = items
            .filter((item) => Number(item.quantity_pcs) > 0)
            .map((item) => ({
                [config.sourceLine]: String(item.source_id),
                quantity_pcs: Number(item.quantity_pcs),
                ...(kind === 'sales-returns' ? { saleable: !!item.saleable } : {})
            }));
    if (isPaymentDocument(kind) || kind === 'expenses') {
        value.payment_account_id = form.payment_account_id;
        value.amount = String(form.amount || 0);
    }
    if (isPaymentDocument(kind)) {
        for (const key of ['reference_no', 'bank_name', 'cheque_number']) value[key] = form[key] || null;
        value.allocations = serializeAllocations(allocations);
    }
    if (kind === 'expenses') {
        value.expense_name = form.expense_name;
        value.notes = form.notes || null;
    }
    if (kind === 'adjustments')
        Object.assign(value, {
            product_id: form.product_id,
            adjustment_type: form.adjustment_type,
            quantity_pcs: Number(form.quantity_pcs),
            unit_cost: String(form.unit_cost || 0),
            reason: form.reason
        });
    return value;
};
export const salePostingPayment = (kind, payment) => {
    return kind === 'sales' && Number(payment.amount) > 0
        ? { payment: { ...payment, amount: String(payment.amount) } }
        : {};
};
