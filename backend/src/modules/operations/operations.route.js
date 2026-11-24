const router = require('express').Router();
const auth = require('../../middlewares/auth');
const c = require('./operations.controller');
const { documentReaders, documentWriters: writers } = require('../../shared/permissions');
router.get('/pending-purchases', auth(...documentReaders.grns), c.pendingPurchases);
for (const [kind, roles] of Object.entries(writers)) {
    router.get(`/${kind}`, auth(...documentReaders[kind]), c.list(kind));
    router.get(`/${kind}/:id`, auth(...documentReaders[kind]), c.get(kind));
    router.post(`/${kind}`, auth(...roles), c.save(kind));
    router.put(`/${kind}/:id`, auth(...roles), c.save(kind));
    router.post(
        `/${kind}/:id/post`,
        auth(...(kind === 'adjustments' ? ['ADMIN', 'MANAGER'] : roles)),
        c.post(kind)
    );
    if (['receipts', 'payments'].includes(kind))
        router.post(`/${kind}/:id/allocations`, auth(...roles), c.allocate(kind));
}

const catchAsync = require('../../shared/catchAsync');
const send = require('../../shared/sendResponse');
const journals = require('./journal.service');
router.post(
    '/journals',
    auth('ADMIN', 'ACCOUNTANT'),
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 201,
            success: true,
            message: 'Journal posted',
            data: await journals.create(req.body, req.user, req.get('Idempotency-Key'))
        })
    )
);
router.post(
    '/journals/:id/reverse',
    auth('ADMIN', 'ACCOUNTANT'),
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Reversal posted',
            data: await journals.reverse(req.params.id, req.body, req.user, req.get('Idempotency-Key'))
        })
    )
);

module.exports = router;
