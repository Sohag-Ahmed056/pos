const router = require('express').Router();
const auth = require('../../middlewares/auth');
const { assert } = require('../../shared/financial');
const { handler } = require('./productLedger.controller');
router.get(
    '/product-ledgers/customers/:id',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'CASHIER'),
    handler('customer')
);
router.get(
    '/product-ledgers/suppliers/:id',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASE'),
    handler('supplier')
);
router.get(
    '/product-ledgers/products/:id',
    auth('ADMIN', 'MANAGER', 'ACCOUNTANT', 'PURCHASE', 'WAREHOUSE'),
    (req, res, next) => {
        try {
            const section = req.query.section || 'movements';
            if (['sales', 'sales-returns'].includes(section))
                assert(
                    ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(req.user.role),
                    'Sales history is restricted to your role',
                    403
                );
            if (section === 'purchase-returns')
                assert(req.user.role !== 'WAREHOUSE', 'Purchase returns are restricted to your role', 403);
            next();
        } catch (error) {
            next(error);
        }
    },
    handler('product')
);
module.exports = router;
