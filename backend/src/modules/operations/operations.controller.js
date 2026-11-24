const s = require('./operations.service');
const catchAsync = require('../../shared/catchAsync');
const send = require('../../shared/sendResponse');
exports.list = (kind) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Documents retrieved',
            ...(await s.list(kind, req.query))
        })
    );
exports.get = (kind) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Document retrieved',
            data: await s.get(kind, req.params.id)
        })
    );
exports.save = (kind) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: req.params.id ? 200 : 201,
            success: true,
            message: 'Draft saved',
            data: await s.save(kind, req.params.id, req.body, req.user, req.get('Idempotency-Key'))
        })
    );
exports.post = (kind) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: kind === 'purchases' ? 'Purchase confirmed' : 'Document posted',
            data: await s.post(kind, req.params.id, req.body, req.user, req.get('Idempotency-Key'))
        })
    );
exports.allocate = (kind) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Allocations saved',
            data: await s.addAllocations(kind, req.params.id, req.body, req.user, req.get('Idempotency-Key'))
        })
    );
exports.pendingPurchases = catchAsync(async (req, res) => {
    const result = await s.pendingPurchases(req.query);
    send(res, {
        statusCode: 200,
        success: true,
        message: 'Pending purchases retrieved',
        ...result
    });
});
