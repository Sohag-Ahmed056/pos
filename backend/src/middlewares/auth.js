const config = require('../config');
const AppError = require('../app/error/AppError');
const { verifyToken } = require('../helpers/jwtHelper');
const { session } = require('../modules/auth/auth.service');
const auth =
    (...roles) =>
    async (req, res, next) => {
        try {
            const token = req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : req.cookies?.accessToken;
            if (!token) throw new AppError(401, 'Please sign in');
            let payload;
            try {
                payload = verifyToken(token, config.jwt.access_secret);
            } catch {
                throw new AppError(401, 'Invalid or expired token');
            }
            const user = await session(payload);
            req.user = { id: String(user.id), role: user.role, sid: payload.sid };
            if (roles.length && !roles.includes(user.role))
                throw new AppError(403, 'You do not have permission for this action');
            next();
        } catch (error) {
            next(error);
        }
    };
auth.checkToken = auth;
module.exports = auth;
