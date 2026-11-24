// Explicit administrator bootstrap only. Never run automatically at startup.
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { z } = require('zod');
const seed = async () => {
    const email = z.string().email().parse(process.env.ADMIN_EMAIL).toLowerCase();
    const password = z.string().min(12).parse(process.env.ADMIN_PASSWORD);
    const existing = (await db.execute('SELECT id FROM users WHERE email=?', [email]))[0][0];
    if (existing) {
        console.log('Administrator already exists; no changes made.');
        return;
    }
    const password_hash = await bcrypt.hash(password, 12);
    await db.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'ADMIN')", [
        process.env.ADMIN_NAME || 'Administrator',
        email,
        password_hash
    ]);
    console.log('Administrator created.');
};
seed()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
