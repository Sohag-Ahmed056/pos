const jwt = require('jsonwebtoken');

const generateToken = (payload, secret, expiresIn) => {
    return jwt.sign(payload, secret, {
        expiresIn: expiresIn
    });
};

const verifyToken = (token, secret) => {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
};

module.exports = {
    generateToken,
    verifyToken
};
