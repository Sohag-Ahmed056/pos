const router = require('express').Router();
const auth = require('../../middlewares/auth');
const c = require('./catalog.controller');
const roles = ['ADMIN', 'MANAGER', 'PURCHASE', 'WAREHOUSE', 'CASHIER', 'ACCOUNTANT'];
for (const [path, resource, writers] of [
    ['products', 'products', ['ADMIN', 'MANAGER', 'PURCHASE']],
    ['suppliers', 'suppliers', ['ADMIN', 'MANAGER', 'PURCHASE']],
    ['customers', 'customers', ['ADMIN', 'MANAGER', 'CASHIER']],
    ['warehouses', 'warehouses', ['ADMIN', 'MANAGER']],
    ['payment-accounts', 'payment_accounts', ['ADMIN', 'ACCOUNTANT']],
    ['company', 'company_settings', ['ADMIN']],
    ['users', 'users', ['ADMIN']],
    ['accounts', 'chart_of_accounts', ['ADMIN', 'ACCOUNTANT']]
]) {
    const readers = resource === 'users' ? ['ADMIN'] : roles;
    router.get(`/${path}`, auth(...readers), c.list(resource));
    router.get(`/${path}/:id/history`, auth(...readers), c.history(resource));
    router.get(`/${path}/:id`, auth(...readers), c.get(resource));
    if (writers.length) {
        router.post(`/${path}`, auth(...writers), c.save(resource));
        if (resource !== 'chart_of_accounts') {
            router.put(`/${path}/:id`, auth(...writers), c.save(resource));
            router.delete(`/${path}/:id`, auth('ADMIN', 'MANAGER'), c.remove(resource));
        }
    }
}
module.exports = router;
