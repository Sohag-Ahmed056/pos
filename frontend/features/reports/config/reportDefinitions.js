export const reportDefinitions = [
    ['customer-ledger', 'Customer ledger'],
    ['supplier-ledger', 'Supplier ledger'],
    ['sales', 'Daily sales'],
    ['monthly-sales', 'Monthly sales'],
    ['product-sales', 'Product sales'],
    ['purchases', 'Purchase history'],
    ['stock', 'Product stock'],
    ['stock-movements', 'Stock movements'],
    ['valuation', 'Inventory valuation'],
    ['low-stock', 'Low stock'],
    ['customer-outstanding', 'Customer outstanding'],
    ['supplier-outstanding', 'Supplier outstanding'],
    ['collections', 'Customer collections'],
    ['supplier-payments', 'Supplier payments'],
    ['cash-bank', 'Cash & bank'],
    ['expenses', 'Expenses'],
    ['profit-loss', 'Profit & loss'],
    ['general-ledger', 'General ledger'],
    ['reconciliation', 'Reconciliation']
];
export const reportRestrictions = {
    CASHIER: [
        'customer-ledger',
        'sales',
        'monthly-sales',
        'product-sales',
        'stock',
        'customer-outstanding',
        'collections'
    ],
    PURCHASE: [
        'supplier-ledger',
        'purchases',
        'stock',
        'stock-movements',
        'low-stock',
        'supplier-outstanding',
        'supplier-payments'
    ],
    WAREHOUSE: ['stock', 'stock-movements', 'low-stock']
};
