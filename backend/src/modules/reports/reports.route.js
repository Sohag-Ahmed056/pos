const router = require('express').Router();
const auth = require('../../middlewares/auth');
const c = require('./reports.controller');
router.get('/audit-logs', auth('ADMIN', 'MANAGER'), c.audit);
router.get('/dashboard', auth('ADMIN', 'MANAGER', 'ACCOUNTANT'), c.dashboard);
router.get(
    '/reports/customer-ledger',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'CASHIER'),
    c.ledger('customer')
);
router.get(
    '/reports/supplier-ledger',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASE'),
    c.ledger('supplier')
);
router.get('/reports/reconciliation', auth('ADMIN', 'MANAGER', 'ACCOUNTANT'), c.reconciliation);
router.get(
    '/reports/:name',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASE', 'WAREHOUSE', 'CASHIER'),
    (req, res, next) => {
        const allowed = {
            CASHIER: [
                'sales',
                'monthly-sales',
                'product-sales',
                'stock',
                'customer-outstanding',
                'collections'
            ],
            PURCHASE: [
                'purchases',
                'stock',
                'stock-movements',
                'low-stock',
                'supplier-outstanding',
                'supplier-payments'
            ],
            WAREHOUSE: ['stock', 'stock-movements', 'low-stock']
        };
        if (allowed[req.user.role] && !allowed[req.user.role].includes(req.params.name))
            return next(
                new (require('../../app/error/AppError'))(403, 'This report is restricted to your role')
            );
        next();
    },
    c.report
);
router.get(
    '/settlements/customer/:id',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'CASHIER'),
    require('../../shared/catchAsync')(async (req, res) =>
        res.json({
            success: true,
            data: await require('./reports.service').openItems('customer', req.params.id)
        })
    )
);
router.get(
    '/settlements/supplier/:id',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASE'),
    require('../../shared/catchAsync')(async (req, res) =>
        res.json({
            success: true,
            data: await require('./reports.service').openItems('supplier', req.params.id)
        })
    )
);

module.exports = router;
