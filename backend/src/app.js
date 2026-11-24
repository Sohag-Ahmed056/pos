const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const router = require('./routes');
const globalErrorHandler = require('./middlewares/globalErrorHandler');
const notFound = require('./middlewares/notFound');

const app = express();

// Middlewares
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
);
app.use(compression());
app.use(morgan('dev'));
app.use(
    cors({
        origin: require('./config').frontend_origin,
        credentials: true
    })
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
    const origin = req.get('Origin');
    if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        origin &&
        origin !== require('./config').frontend_origin
    )
        return res.status(403).json({ success: false, message: 'Untrusted request origin' });
    next();
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static upload directory
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Main Routes
app.use('/api/v1', router);

// Serve the compiled React client from the same origin in production.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (require('fs').existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    app.get(/^\/(?!api(?:\/|$)|health$|uploads(?:\/|$)).*/, (req, res) =>
        res.sendFile(path.join(frontendDist, 'index.html'))
    );
}

// Health Check
app.get('/', (req, res) => {
    res.json({ message: "Don't worry, I'm running smoothly!" });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Not Found and Error Handlers
app.use(notFound);
app.use(globalErrorHandler);

module.exports = app;
