const { z } = require('zod');
const db = require('../../config/db');
const { date } = require('../operations/operations.validation');
const { id } = require('../catalog/catalog.validation');

const auditFilters = z
    .object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(180).default(''),
        from: date.optional(),
        to: date.optional(),
        user_id: id.optional(),
        action: z.string().trim().min(1).max(100).optional(),
        entity: z.string().trim().min(1).max(100).optional()
    })
    .refine((f) => !f.from || !f.to || f.from <= f.to, 'From date must not exceed to date');

const safeDetails = (value) => {
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return {};
        }
    }
    const clean = (item) => {
        if (Array.isArray(item)) return item.map(clean);
        if (item && typeof item === 'object')
            return Object.fromEntries(
                Object.entries(item)
                    .filter(([key]) => !/password|token|secret|authorization|cookie|^sid$/i.test(key))
                    .map(([key, nested]) => [key, clean(nested)])
            );
        return item;
    };
    return clean(value || {});
};

const list = async (query) => {
    const f = auditFilters.parse(query);
    const clauses = [],
        params = [];
    if (f.search) {
        clauses.push(
            '(u.name LIKE ? OR u.email LIKE ? OR a.action_code LIKE ? OR a.entity_type LIKE ? OR CAST(a.entity_id AS CHAR) LIKE ?)'
        );
        params.push(...Array(5).fill(`%${f.search}%`));
    }
    if (f.from) {
        clauses.push('a.created_at>=?');
        params.push(f.from);
    }
    if (f.to) {
        clauses.push("a.created_at<=CONCAT(?, ' 23:59:59.999999')");
        params.push(f.to);
    }
    for (const [input, column] of [
        ['user_id', 'user_id'],
        ['action', 'action_code'],
        ['entity', 'entity_type']
    ])
        if (f[input]) {
            clauses.push(`a.${column}=?`);
            params.push(f[input]);
        }
    const from = `FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}`;
    const [[rows], [[count]]] = await Promise.all([
        db.query(
            `SELECT a.id,a.created_at,a.user_id,u.name user_name,a.action_code,a.entity_type,a.entity_id,a.details ${from} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`,
            [...params, f.limit, (f.page - 1) * f.limit]
        ),
        db.execute(`SELECT COUNT(*) total ${from}`, params)
    ]);
    return {
        data: rows.map((row) => ({ ...row, details: safeDetails(row.details) })),
        meta: {
            page: f.page,
            limit: f.limit,
            total: Number(count.total),
            pages: Math.ceil(Number(count.total) / f.limit)
        }
    };
};
module.exports = { list, safeDetails, auditFilters };
