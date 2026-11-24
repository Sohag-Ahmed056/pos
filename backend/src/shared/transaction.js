const crypto = require('crypto');
const pool = require('../config/db');
const { assert } = require('./financial');

const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((k) => [k, canonical(value[k])])
        );
    return value;
};
const audit = async (tx, user, action, table, id, details = {}) => {
    await tx.execute(
        'INSERT INTO audit_logs (user_id, action_code, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [String(user.id), action, table, id ? String(id) : null, JSON.stringify(details)]
    );
};
const withTransaction = async (work) => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const connection = await pool.getConnection();
        try {
            await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
            await connection.beginTransaction();
            const result = await work(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            if (attempt < 2 && ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) continue;
            throw error;
        } finally {
            connection.release();
        }
    }
};
const transaction = async (user, action, key, payload, work) => {
    assert(
        typeof key === 'string' && /^[\w-]{8,100}$/.test(key),
        'An Idempotency-Key header of 8–100 letters, digits, underscores or hyphens is required',
        400
    );
    const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonical(payload)))
        .digest('hex');
    return withTransaction(async (tx) => {
        await tx.execute(
            'INSERT INTO idempotency_keys (actor_user_id, action_code, request_key) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
            [String(user.id), action, key]
        );
        const [[entry]] = await tx.execute(
            'SELECT id, response_ref FROM idempotency_keys WHERE actor_user_id=? AND action_code=? AND request_key=? FOR UPDATE',
            [String(user.id), action, key]
        );
        if (entry.response_ref) {
            const [savedHash, id] = entry.response_ref.split(':');
            assert(savedHash === hash, 'This idempotency key was used for a different request', 409);
            return { id, replayed: true };
        }
        const result = await work(tx);
        await tx.execute('UPDATE idempotency_keys SET response_ref=? WHERE id=?', [
            `${hash}:${result.id}`,
            String(entry.id)
        ]);
        await audit(tx, user, action, action.split('.')[0], result.id);
        return result;
    });
};
module.exports = { transaction, withTransaction, audit };
