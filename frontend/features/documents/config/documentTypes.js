const am = ['ADMIN', 'MANAGER'];
export const documentTypes = {
    purchases: {
        title: 'Purchases',
        singular: 'Purchase order',
        number: 'purchase_no',
        date: 'purchase_date',
        party: 'supplier_id',
        partyResource: 'suppliers',
        writers: [...am, 'PURCHASE']
    },
    sales: {
        title: 'Sales invoices',
        singular: 'Sales invoice',
        number: 'invoice_no',
        date: 'invoice_date',
        party: 'customer_id',
        partyResource: 'customers',
        writers: [...am, 'CASHIER']
    },
    grns: {
        title: 'Goods receipts',
        singular: 'Goods receipt',
        number: 'grn_no',
        date: 'received_date',
        source: 'purchase_id',
        sourceResource: 'purchases',
        sourceLine: 'purchase_item_id',
        writers: [...am, 'PURCHASE', 'WAREHOUSE']
    },
    receipts: {
        title: 'Customer collections',
        singular: 'Customer receipt',
        number: 'voucher_no',
        date: 'receipt_date',
        party: 'customer_id',
        partyResource: 'customers',
        writers: [...am, 'CASHIER', 'ACCOUNTANT']
    },
    payments: {
        title: 'Supplier payments',
        singular: 'Supplier payment',
        number: 'voucher_no',
        date: 'payment_date',
        party: 'supplier_id',
        partyResource: 'suppliers',
        writers: [...am, 'ACCOUNTANT']
    },
    'sales-returns': {
        title: 'Sales returns',
        singular: 'Sales return',
        number: 'return_no',
        date: 'return_date',
        source: 'sales_invoice_id',
        sourceResource: 'sales',
        sourceLine: 'sales_invoice_item_id',
        writers: [...am, 'CASHIER']
    },
    'purchase-returns': {
        title: 'Purchase returns',
        singular: 'Purchase return',
        number: 'return_no',
        date: 'return_date',
        source: 'goods_receipt_id',
        sourceResource: 'grns',
        sourceLine: 'goods_receipt_item_id',
        writers: [...am, 'PURCHASE']
    },
    adjustments: {
        title: 'Stock adjustments',
        singular: 'Stock adjustment',
        number: 'adjustment_no',
        date: 'adjustment_date',
        writers: [...am, 'WAREHOUSE']
    },
    expenses: {
        title: 'Expenses',
        singular: 'Expense',
        number: 'expense_no',
        date: 'expense_date',
        writers: [...am, 'ACCOUNTANT']
    }
};
