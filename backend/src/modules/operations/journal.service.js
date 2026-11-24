const { z } = require('zod');
const db = require('../../config/db');
const { date } = require('./operations.validation');
const { id, currency, text, optional } = require('../catalog/catalog.validation');
const { assert, money } = require('../../shared/financial');
const { transaction, audit } = require('../../shared/transaction');
const { journal, lock } = require('./accounting.service');
const schema = z
    .object({
        gl_date: date,
        type: z.enum(['OPENING_BALANCE', 'ADJUSTMENT']),
        reference_no: optional(80),
        reason: text(255),
        lines: z
            .array(
                z
                    .object({
                        account_id: id,
                        customer_id: id.nullable().optional(),
                        supplier_id: id.nullable().optional(),
                        debit: currency.default('0'),
                        credit: currency.default('0')
                    })
                    .strict()
            )
            .min(2)
            .max(100)
    })
    .strict();
const create = async (payload, user, key) => {
    const input = schema.parse(payload);
    return transaction(user, 'journal.create', key, payload, async (tx) => {
        const customerIds = [
            ...new Set(input.lines.filter((l) => l.customer_id).map((l) => l.customer_id))
        ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
        const supplierIds = [
            ...new Set(input.lines.filter((l) => l.supplier_id).map((l) => l.supplier_id))
        ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
        for (const customer of customerIds) await lock(tx, 'customers', customer);
        for (const supplier of supplierIds) await lock(tx, 'suppliers', supplier);
        assert(
            (customerIds.length <= 1 && !supplierIds.length) ||
                (supplierIds.length <= 1 && !customerIds.length),
            'Create separate journals per party to preserve grouping snapshots'
        );
        for (const line of input.lines) {
            const [[a]] = await tx.execute('SELECT code FROM chart_of_accounts WHERE id=?', [
                line.account_id
            ]);
            assert(a, 'Account does not exist');
            assert(a.code !== 'INVENTORY', 'Use inventory adjustments for inventory accounting');
            assert(a.code !== 'AR' || line.customer_id, 'Receivable lines require a customer');
            assert(a.code !== 'AP' || line.supplier_id, 'Payable lines require a supplier');
            assert(!line.customer_id || a.code === 'AR', 'Customer tags belong only on receivable lines');
            assert(!line.supplier_id || a.code === 'AP', 'Supplier tags belong only on payable lines');
        }
        const [log] = await tx.execute(
            "INSERT INTO audit_logs (user_id,action_code,entity_type,details) VALUES (?, 'MANUAL_JOURNAL', 'journal_entries', ?)",
            [user.id, JSON.stringify({ reason: input.reason })]
        );
        const sourceId = String(log.insertId);
        const voucher = `JV-${sourceId}`;
        const customer = customerIds.length
            ? (await tx.execute('SELECT * FROM customers WHERE id=?', [customerIds[0]]))[0][0]
            : null;
        await journal(
            tx,
            {
                voucher_no: voucher,
                gl_date: input.gl_date,
                source_type: input.type,
                source_id: sourceId,
                reference_no: input.reference_no
            },
            input.lines,
            customer
        );
        const [[entry]] = await tx.execute('SELECT id FROM journal_entries WHERE voucher_no=?', [voucher]);
        assert(entry, 'Journal must have a positive amount');
        return { id: String(entry.id) };
    });
};
const reverse = async (rawId, payload, user, key) => {
    const input = z
        .object({ gl_date: date, reason: text(255) })
        .strict()
        .parse(payload);
    return transaction(user, 'journal.reverse', key, { id: rawId, ...payload }, async (tx) => {
        const [[entry]] = await tx.execute('SELECT * FROM journal_entries WHERE id=? FOR UPDATE', [
            id.parse(rawId)
        ]);
        assert(
            entry && ['OPENING_BALANCE', 'ADJUSTMENT', 'EXPENSES'].includes(entry.source_type),
            'Use a sales or purchase return to correct an inventory transaction'
        );
        const [[existing]] = await tx.execute(
            "SELECT id FROM journal_entries WHERE source_type='REVERSAL' AND source_id=?",
            [String(entry.id)]
        );
        if (existing) return { id: String(existing.id) };
        const [lines] = await tx.execute('SELECT * FROM journal_lines WHERE journal_entry_id=? ORDER BY id', [
            String(entry.id)
        ]);
        const customers = [...new Set(lines.filter((l) => l.customer_id).map((l) => String(l.customer_id)))];
        const suppliers = [...new Set(lines.filter((l) => l.supplier_id).map((l) => String(l.supplier_id)))];
        for (const c of customers.sort()) await lock(tx, 'customers', c);
        for (const s of suppliers.sort()) await lock(tx, 'suppliers', s);
        await journal(
            tx,
            {
                voucher_no: `REV-${entry.id}`,
                gl_date: input.gl_date,
                source_type: 'REVERSAL',
                source_id: String(entry.id),
                reference_no: entry.voucher_no
            },
            lines.map((l) => ({
                account_id: l.account_id,
                customer_id: l.customer_id,
                supplier_id: l.supplier_id,
                debit: l.credit,
                credit: l.debit
            })),
            {
                party_name: entry.party_snapshot,
                area_name: entry.area_snapshot,
                sales_channel: entry.sales_channel_snapshot
            }
        );
        if (entry.source_type === 'EXPENSES')
            await tx.execute("UPDATE expenses SET status='VOID' WHERE id=?", [String(entry.source_id)]);
        await audit(tx, user, 'REVERSE_JOURNAL', 'journal_entries', entry.id, { reason: input.reason });
        const [[created]] = await tx.execute(
            "SELECT id FROM journal_entries WHERE source_type='REVERSAL' AND source_id=?",
            [String(entry.id)]
        );
        return { id: String(created.id) };
    });
};
module.exports = { create, reverse };
