const { z } = require('zod');
const text = (max) => z.string().trim().min(1).max(max);
const optional = (max) =>
    z
        .union([z.string().trim().max(max), z.null()])
        .optional()
        .transform((v) => (v === '' ? null : v));
const price = z
    .union([z.string().regex(/^\d{1,12}(\.\d{1,4})?$/), z.number().finite().nonnegative().max(999999999999)])
    .transform(String);
const currency = price.refine(
    (v) => new (require('decimal.js'))(v).decimalPlaces() <= 2,
    'Currency amounts support at most two decimal places'
);
const id = z
    .union([z.string().regex(/^[1-9]\d{0,19}$/), z.number().int().positive().max(Number.MAX_SAFE_INTEGER)])
    .transform(String)
    .refine((v) => BigInt(v) <= 18446744073709551615n, 'Invalid ID');
const person = { name: text(160), phone: optional(30), address: optional(255) };
const schemas = {
    chart_of_accounts: z
        .object({ code: text(30), name: text(140), account_type: z.literal('ASSET') })
        .strict(),
    products: z
        .object({
            sku: text(70),
            name: text(180),
            category: optional(100),
            brand: optional(100),
            model: optional(100),
            default_purchase_price: price.default('0'),
            selling_price: price.default('0'),
            reorder_level_pcs: z.number().int().nonnegative().max(2147483647).default(0),
            is_active: z.boolean().default(true)
        })
        .strict(),
    suppliers: z.object(person).strict(),
    customers: z
        .object({
            ...person,
            shop_name: optional(160),
            nid_number: z.string().regex(/^\d+$/).max(30).nullable().optional(),
            tin_number: z.string().regex(/^\d+$/).max(35).nullable().optional(),
            trade_license_number: optional(70),
            bank_name: optional(160),
            cheque_number: optional(80),
            party_name: optional(160),
            area_name: optional(120),
            sales_channel: optional(120)
        })
        .strict(),
    warehouses: z.object({ code: text(30), name: text(160) }).strict(),
    payment_accounts: z
        .object({
            name: text(120),
            account_type: z.enum(['CASH', 'BANK', 'BKASH', 'NAGAD', 'OTHER']),
            gl_account_id: id,
            is_active: z.boolean().default(true)
        })
        .strict(),
    users: z
        .object({
            name: text(120),
            email: z.string().email().max(160).toLowerCase(),
            password: z.string().min(12).max(128).optional(),
            role: z.enum(['ADMIN', 'MANAGER', 'PURCHASE', 'WAREHOUSE', 'CASHIER', 'ACCOUNTANT']),
            is_active: z.boolean().default(true)
        })
        .strict(),
    company_settings: z
        .object({ company_code: text(20), company_name: text(160), address: optional(255) })
        .strict()
};
const pagination = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(180).default(''),
    category: z.string().max(100).optional(),
    brand: z.string().max(100).optional(),
    active: z.enum(['true', 'false']).optional()
});
module.exports = { schemas, price, currency, id, text, optional, pagination };
