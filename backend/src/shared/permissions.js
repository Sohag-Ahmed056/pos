const managers = ['ADMIN', 'MANAGER'];
// Source-document readers are explicit: warehouse staff receive purchases;
// accountants inspect the documents supporting journal and settlement entries.
const documentReaders = {
    purchases: [...managers, 'PURCHASE', 'WAREHOUSE', 'ACCOUNTANT'],
    grns: [...managers, 'PURCHASE', 'WAREHOUSE', 'ACCOUNTANT'],
    sales: [...managers, 'CASHIER', 'ACCOUNTANT'],
    receipts: [...managers, 'CASHIER', 'ACCOUNTANT'],
    payments: [...managers, 'ACCOUNTANT'],
    'sales-returns': [...managers, 'CASHIER', 'ACCOUNTANT'],
    'purchase-returns': [...managers, 'PURCHASE', 'ACCOUNTANT'],
    adjustments: [...managers, 'WAREHOUSE', 'ACCOUNTANT'],
    expenses: [...managers, 'ACCOUNTANT']
};
const documentWriters = {
    purchases: [...managers, 'PURCHASE'],
    grns: [...managers, 'WAREHOUSE', 'PURCHASE'],
    sales: [...managers, 'CASHIER'],
    receipts: [...managers, 'CASHIER', 'ACCOUNTANT'],
    payments: [...managers, 'ACCOUNTANT'],
    'sales-returns': [...managers, 'CASHIER'],
    'purchase-returns': [...managers, 'PURCHASE'],
    adjustments: [...managers, 'WAREHOUSE'],
    expenses: [...managers, 'ACCOUNTANT']
};
const movementReaders = [...managers, 'PURCHASE', 'WAREHOUSE', 'ACCOUNTANT'];
module.exports = { documentReaders, documentWriters, movementReaders };
