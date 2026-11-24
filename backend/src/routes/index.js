const express = require('express');

const authRoutes = require('../modules/auth/auth.route');

const router = express.Router();

const moduleRoutes = [
    {
        path: '/auth',
        route: authRoutes
    }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

router.use(require('../modules/catalog/catalog.route'));
router.use(require('../modules/operations/operations.route'));
router.use(require('../modules/reports/reports.route'));
router.use(require('../modules/reports/productLedger.route'));

module.exports = router;
