const bcrypt = require('bcrypt');
const crypto = require('crypto');
const AppError = require('../../app/error/AppError');
const { generateToken, verifyToken } = require('../../helpers/jwtHelper');
const config = require('../../config');
const db = require('../../config/db');
const { withTransaction, audit } = require('../../shared/transaction');
const { loginValidationSchema, changePasswordValidationSchema } = require('./auth.validation');
const version = (hash) => crypto.createHash('sha256').update(hash).digest('hex');
const safe = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active
});
const tokens = (user, sid = crypto.randomUUID()) => {
    const payload = { id: String(user.id), role: user.role, pv: version(user.password_hash), sid };
    return {
        accessToken: generateToken(payload, config.jwt.access_secret, '15m'),
        refreshToken: generateToken(payload, config.jwt.refresh_secret, config.jwt.refresh_expires_in),
        admin: safe(user)
    };
};
const session = async (payload, connection = db) => {
    const user = (await connection.execute('SELECT * FROM users WHERE id=?', [String(payload.id)]))[0][0];
    if (!user || !user.is_active || payload.pv !== version(user.password_hash) || !payload.sid)
        throw new AppError(401, 'Session expired. Please sign in again.');
    const revoked = (
        await connection.execute(
            "SELECT id FROM audit_logs WHERE user_id=? AND action_code='REVOKE_SESSION' AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.sid'))=? LIMIT 1",
            [String(user.id), payload.sid]
        )
    )[0][0];
    if (revoked) throw new AppError(401, 'Session expired. Please sign in again.');
    return user;
};
const login = async (payload) => {
    const input = loginValidationSchema.parse(payload);
    const user = (
        await db.execute('SELECT * FROM users WHERE email=? LIMIT 1', [input.email.toLowerCase()])
    )[0][0];
    if (!user || !user.is_active || !(await bcrypt.compare(input.password, user.password_hash)))
        throw new AppError(401, 'Invalid email or password');
    await db.execute(
        "INSERT INTO audit_logs (user_id, action_code, entity_type, entity_id) VALUES (?, 'LOGIN', 'users', ?)",
        [String(user.id), String(user.id)]
    );
    return tokens(user);
};
const refresh = async (token) => {
    let payload;
    try {
        payload = verifyToken(token, config.jwt.refresh_secret);
    } catch {
        throw new AppError(401, 'Invalid refresh token');
    }
    return withTransaction(async (connection) => {
        await connection.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [String(payload.id)]);
        const user = await session(payload, connection);
        await logout(payload, connection);
        return tokens(user);
    });
};
const logout = async (payload, connection = db) => {
    await connection.execute(
        "INSERT INTO audit_logs (user_id, action_code, entity_type, entity_id, details) VALUES (?, 'REVOKE_SESSION', 'users', ?, ?)",
        [String(payload.id), String(payload.id), JSON.stringify({ sid: payload.sid })]
    );
};
const getMe = async (id) => {
    const user = (await db.execute('SELECT * FROM users WHERE id=?', [String(id)]))[0][0];
    if (!user) throw new AppError(404, 'User not found');
    return safe(user);
};
const changePassword = async (id, payload) => {
    const input = changePasswordValidationSchema.parse(payload);
    return withTransaction(async (tx) => {
        const user = (await tx.execute('SELECT * FROM users WHERE id=? FOR UPDATE', [String(id)]))[0][0];
        if (!user || !(await bcrypt.compare(input.oldPassword, user.password_hash)))
            throw new AppError(401, 'Old password is incorrect');
        await tx.execute('UPDATE users SET password_hash=? WHERE id=?', [
            await bcrypt.hash(input.newPassword, config.bcrypt_salt_rounds),
            String(user.id)
        ]);
        await audit(tx, user, 'CHANGE_PASSWORD', 'users', user.id);
    });
};
module.exports = { login, logout, refresh, getMe, changePassword, session, safe };
