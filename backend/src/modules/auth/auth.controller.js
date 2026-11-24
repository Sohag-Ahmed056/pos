const catchAsync = require('../../shared/catchAsync');
const AuthService = require('./auth.service');
const sendResponse = require('../../shared/sendResponse');
const { setTokensInCookies, clearTokensInCookies } = require('../../helpers/cookie');

const login = catchAsync(async (req, res) => {
    const result = await AuthService.login(req.body);
    const { accessToken, refreshToken, admin } = result;

    setTokensInCookies(res, accessToken, refreshToken);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Admin logged in successfully!',
        data: {
            accessToken,
            refreshToken,
            admin
        }
    });
});

const logout = catchAsync(async (req, res) => {
    await AuthService.logout(req.user);
    clearTokensInCookies(res);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Logged out successfully!',
        data: null
    });
});

const getMe = catchAsync(async (req, res) => {
    const adminId = req.user.id;
    const result = await AuthService.getMe(adminId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Admin profile retrieved successfully!',
        data: result
    });
});

const changePassword = catchAsync(async (req, res) => {
    const adminId = req.user.id;
    await AuthService.changePassword(adminId, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Password changed successfully!',
        data: null
    });
});

module.exports = {
    login,
    logout,
    getMe,
    changePassword
};

module.exports.refresh = catchAsync(async (req, res) => {
    const result = await AuthService.refresh(req.cookies?.refreshToken || req.body.refreshToken);
    setTokensInCookies(res, result.accessToken, result.refreshToken);
    sendResponse(res, { statusCode: 200, success: true, message: 'Session refreshed', data: result });
});
