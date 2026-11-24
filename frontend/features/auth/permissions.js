const managers = ['ADMIN', 'MANAGER'];
export const documentReadRoles = {
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
export const canReadDocument = (kind, role) => documentReadRoles[kind]?.includes(role) || false;
