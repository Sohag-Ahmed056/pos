const slugify = require('slugify');
const db = require('../config/db');

/**
 * Generates a unique slug for a given table name.
 * Handles collisions by appending -2, -3, etc.
 * Excludes current record ID during update operations.
 *
 * @param {string} title
 * @param {string} tableName
 * @param {number|null} currentId
 * @returns {Promise<string>} Unique slug string
 */
const createUniqueSlug = async (title, tableName = 'posts', currentId = null) => {
    let baseSlug = slugify(title, {
        lower: true,
        strict: true,
        trim: true
    });

    if (!baseSlug) {
        baseSlug = 'untitled';
    }

    let slug = baseSlug;
    let count = 1;

    while (true) {
        let query = `SELECT id FROM \`${tableName}\` WHERE slug = ?`;
        let params = [slug];

        if (currentId) {
            query += ' AND id != ?';
            params.push(Number(currentId));
        }

        query += ' LIMIT 1';

        const [rows] = await db.query(query, params);

        if (rows.length === 0) {
            return slug;
        }

        count += 1;
        slug = `${baseSlug}-${count}`;
    }
};

module.exports = {
    createUniqueSlug
};
