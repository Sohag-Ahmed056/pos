require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    mysql: {
        host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '4406', 10),
        user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
        password:
            process.env.DB_PASSWORD !== undefined
                ? process.env.DB_PASSWORD
                : process.env.MYSQL_PASSWORD || 'root',
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'batteryPos'
    },
    frontend_origin: process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173',
    jwt: {
        access_secret: process.env.JWT_ACCESS_SECRET || 'secret_key',
        access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refresh_secret: process.env.JWT_REFRESH_SECRET || 'refresh_secret_key',
        refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },
    bcrypt_salt_rounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10)
};

if (module.exports.env === 'production') {
    const { access_secret, refresh_secret } = module.exports.jwt;
    if (access_secret.length < 32 || refresh_secret.length < 32 || access_secret === refresh_secret) {
        throw new Error('Production requires distinct JWT secrets with at least 32 characters each');
    }
    if (!process.env.FRONTEND_ORIGIN)
        throw new Error('Set FRONTEND_ORIGIN to the production application origin');
}
