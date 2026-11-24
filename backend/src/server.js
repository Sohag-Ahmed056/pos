const http = require('http');
const app = require('./app');
const config = require('./config');
const db = require('./config/db');

const bootstrap = async () => {
    const port = config.port;
    const server = http.createServer(app);

    server.on('error', async (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${port} is already in use by another process.`);
        } else {
            console.error('❌ Server error:', error);
        }
        process.exit(1);
    });

    try {
        // Test database connection using mysql2 pool
        const connection = await db.getConnection();
        console.log('📦 Successfully connected to the MySQL database via mysql2');
        connection.release();

        server.listen(port, () => {
            console.log(`🚀 Server is running on http://localhost:${port}`);
        });

        const exitHandler = async (signal) => {
            if (server) {
                server.close(async () => {
                    await db.end();
                    console.log('Server closed gracefully.');
                    if (signal === 'SIGUSR2') {
                        process.kill(process.pid, 'SIGUSR2');
                    } else {
                        process.exit(0);
                    }
                });
            } else {
                await db.end();
                process.exit(0);
            }
        };

        process.on('unhandledRejection', (error) => {
            console.log('Unhandled Rejection is detected, closing server...');
            if (server) {
                server.close(async () => {
                    await db.end();
                    console.error(error);
                    process.exit(1);
                });
            } else {
                db.end().then(() => process.exit(1));
            }
        });

        // Handle nodemon restart signal
        process.once('SIGUSR2', () => {
            exitHandler('SIGUSR2');
        });

        process.on('SIGINT', () => {
            exitHandler('SIGINT');
        });

        process.on('SIGTERM', () => {
            exitHandler('SIGTERM');
        });
    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
};

bootstrap();
