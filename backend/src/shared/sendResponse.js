const sendResponse = (res, data) => {
    res.status(data.statusCode).json({
        success: data.success,
        message: data.message,
        meta: data.meta || null,
        data: data.data || null
    });
};

module.exports = sendResponse;
