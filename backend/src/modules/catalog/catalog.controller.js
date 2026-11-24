const service = require('./catalog.service');
const catchAsync = require('../../shared/catchAsync');
const send = require('../../shared/sendResponse');
exports.list = (resource) =>
    catchAsync(async (req, res) => {
        const result = await service.list(resource, req.query);
        send(res, { statusCode: 200, success: true, message: 'Records retrieved', ...result });
    });
exports.get = (resource) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Record retrieved',
            data: await service.get(resource, req.params.id)
        })
    );
exports.save = (resource) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: req.params.id ? 200 : 201,
            success: true,
            message: 'Record saved',
            data: await service.save(resource, req.params.id, req.body, req.user)
        })
    );
exports.remove = (resource) =>
    catchAsync(async (req, res) =>
        send(res, {
            statusCode: 200,
            success: true,
            message: 'Record deleted',
            data: await service.remove(resource, req.params.id, req.user)
        })
    );
exports.history = (resource) =>
    catchAsync(async (req, res) => {
        const result = await service.history(resource, req.params.id, req.query, req.user);
        send(res, {
            statusCode: 200,
            success: true,
            message: 'History retrieved',
            ...result
        });
    });
