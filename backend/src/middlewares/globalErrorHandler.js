const config = require('../config');
const { ZodError } = require('zod');

const globalErrorHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    let statusCode = 500;
    let message = 'Something went wrong!';
    let errorMessages = [];

    // Handle AppError
    if (error.statusCode) {
        statusCode = error.statusCode;
        message =
            statusCode >= 500 && config.env === 'production'
                ? 'An unexpected server error occurred'
                : error.message;
        errorMessages = error.message ? [{ path: '', message: error.message }] : [];
    }
    // Handle Zod Validation Error
    else if (error instanceof ZodError) {
        statusCode = 400;
        message = 'Validation error';
        errorMessages = error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
        }));
    } else if (error.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        message = 'This SKU, code, email, or voucher already exists';
    } else if (['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) {
        statusCode = 409;
        message = 'This record is referenced by another transaction, or a referenced record is missing';
    } else if (
        ['ER_CHECK_CONSTRAINT_VIOLATED', 'ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE'].includes(error.code)
    ) {
        statusCode = 422;
        message = 'A value violates the database constraints';
    }
    // Handle JWT Errors
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        errorMessages = [{ path: '', message: 'Invalid token' }];
    } else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token has expired';
        errorMessages = [{ path: '', message: 'Token has expired' }];
    }
    // Handle Standard Error
    else if (error instanceof Error) {
        message =
            statusCode >= 500 && config.env === 'production'
                ? 'An unexpected server error occurred'
                : error.message;
        errorMessages = error.message ? [{ path: '', message: error.message }] : [];
    }

    if (statusCode >= 500 && config.env === 'production') {
        message = 'An unexpected server error occurred';
        errorMessages = [{ path: '', message }];
    }
    res.status(statusCode).json({
        success: false,
        message,
        errorMessages,
        stack: config.env !== 'production' ? error.stack : undefined
    });
};

module.exports = globalErrorHandler;
