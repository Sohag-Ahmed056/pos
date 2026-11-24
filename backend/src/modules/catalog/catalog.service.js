const db = require('../../config/db');
const bcrypt = require('bcrypt');
const { schemas, pagination, id } = require('./catalog.validation');
const { assert } = require('../../shared/financial');
const { audit, withTransaction } = require('../../shared/transaction');
const { calculatePagination } = require('../../helpers/pagination');
const safeUser = 'id, name, email, role, is_active, created_at';
const searchFields = {
    products: ['name', 'sku', 'brand', 'model'],
    customers: ['name', 'phone', 'shop_name'],
    suppliers: ['name', 'phone'],
    warehouses: ['name', 'code'],
    users: ['name', 'email'],
    payment_accounts: ['name'],
    chart_of_accounts: ['name', 'code'],
    company_settings: ['company_name']
};
const table = (resource) => {
    assert(Object.hasOwn(searchFields, resource), 'Unknown resource', 404);
    return resource;
};
const list = async (resource, query) => {
    table(resource);
    const input = pagination.parse(query);
    const { page, limit, skip } = calculatePagination(input);
    const conditions = [];
    const params = [];
    if (input.search) {
        conditions.push(`(${searchFields[resource].map((f) => `${f} LIKE ?`).join(' OR ')})`);
        params.push(...searchFields[resource].map(() => `%${input.search}%`));
    }
    if (resource === 'products')
        for (const field of ['category', 'brand'])
            if (input[field]) {
                conditions.push(`${field}=?`);
                params.push(input[field]);
            }
    if (input.active && ['products', 'users', 'payment_accounts'].includes(resource)) {
        conditions.push('is_active=?');
        params.push(input.active === 'true' ? 1 : 0);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [[data], [[count]]] = await Promise.all([
        db.query(
            `SELECT ${resource === 'users' ? safeUser : '*'} FROM ${resource} ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
            [...params, limit, skip]
        ),
        db.execute(`SELECT COUNT(*) AS total FROM ${resource} ${where}`, params)
    ]);
    return {
        data,
        meta: { page, limit, total: Number(count.total), pages: Math.ceil(Number(count.total) / limit) }
    };
};
const get = async (resource, rawId) => {
    table(resource);
    const [[row]] = await db.execute(
        `SELECT ${resource === 'users' ? safeUser : '*'} FROM ${resource} WHERE id=?`,
        [id.parse(rawId)]
    );
    assert(row, 'Record not found', 404);
    return row;
};
const save = async (resource, rawId, payload, user) => {
    table(resource);
    assert(
        resource !== 'chart_of_accounts' || !rawId,
        'Existing chart of accounts entries cannot be changed',
        405
    );
    const data = schemas[resource].parse(payload);
    if (resource === 'users') {
        assert(rawId || data.password, 'Password is required for a new user', 400);
        if (data.password) data.password_hash = await bcrypt.hash(data.password, 12);
        delete data.password;
        assert(
            !rawId || String(rawId) !== String(user.id) || (data.is_active && data.role === 'ADMIN'),
            'You cannot remove your own administrator access'
        );
    }
    return withTransaction(async (tx) => {
        if (resource === 'payment_accounts') {
            const [[account]] = await tx.execute('SELECT * FROM chart_of_accounts WHERE id=? FOR UPDATE', [
                data.gl_account_id
            ]);
            assert(
                account?.account_type === 'ASSET' && !['AR', 'INVENTORY'].includes(account.code),
                'Select a cash or bank asset account'
            );
            if (rawId) {
                const [[existing]] = await tx.execute(
                    'SELECT gl_account_id FROM payment_accounts WHERE id=?',
                    [id.parse(rawId)]
                );
                assert(
                    String(existing?.gl_account_id) === data.gl_account_id,
                    'An existing payment account cannot change its GL account'
                );
            }
        }
        if (['customers', 'suppliers'].includes(resource) && !rawId) {
            // Serialize quick-add using an existing chart row; no new lock table is needed.
            await tx.execute('SELECT id FROM chart_of_accounts WHERE code=? FOR UPDATE', [
                resource === 'customers' ? 'AR' : 'AP'
            ]);
            const [[existing]] = await tx.execute(
                `SELECT * FROM ${resource} WHERE name=? AND phone <=> ? AND address <=> ? LIMIT 1`,
                [data.name, data.phone || null, data.address || null]
            );
            if (existing) return existing;
        }
        const fields = Object.keys(data).filter((k) => data[k] !== undefined);
        const values = fields.map((k) => (typeof data[k] === 'boolean' ? Number(data[k]) : data[k]));
        let key = rawId ? id.parse(rawId) : null;
        if (resource === 'company_settings') {
            await tx.execute(
                `INSERT INTO company_settings (id, ${fields.join(',')}) VALUES (1, ${fields.map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${fields.map((f) => `${f}=?`).join(',')}`,
                [...values, ...values]
            );
            key = '1';
        } else if (key) {
            const [[exists]] = await tx.execute(`SELECT id FROM ${resource} WHERE id=? FOR UPDATE`, [key]);
            assert(exists, 'Record not found', 404);
            await tx.execute(`UPDATE ${resource} SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`, [
                ...values,
                key
            ]);
        } else {
            const [result] = await tx.execute(
                `INSERT INTO ${resource} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
                values
            );
            key = String(result.insertId);
        }
        await audit(tx, user, rawId ? 'UPDATE' : 'CREATE', resource, key);
        const [[row]] = await tx.execute(
            `SELECT ${resource === 'users' ? safeUser : '*'} FROM ${resource} WHERE id=?`,
            [key]
        );
        return row;
    });
};
const remove = async (resource, rawId, user) => {
    assert(
        ['products', 'suppliers', 'customers', 'warehouses'].includes(resource),
        'Deletion is not supported',
        405
    );
    return withTransaction(async (tx) => {
        const key = id.parse(rawId);
        const [result] = await tx.execute(`DELETE FROM ${resource} WHERE id=?`, [key]);
        assert(result.affectedRows, 'Record not found', 404);
        await audit(tx, user, 'DELETE', resource, key);
        return { id: key };
    });
};
const { history } = require('./catalog.history');
module.exports = { list, get, save, remove, history };
