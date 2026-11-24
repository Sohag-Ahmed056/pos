const express = require('express');
const AuthController = require('./auth.controller');
const auth = require('../../middlewares/auth');

const router = express.Router();

const { rateLimit } = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
router.post('/login', limiter, AuthController.login);
router.post('/logout', auth(), AuthController.logout);
router.post('/refresh', AuthController.refresh);
router.get('/me', auth(), AuthController.getMe);
router.post('/change-password', auth(), AuthController.changePassword);

module.exports = router;
