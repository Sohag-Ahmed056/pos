const am = ['ADMIN', 'MANAGER'];
export const catalogResources = {
    accounts: {
        title: 'Asset accounts',
        description: 'Create distinct cash, bank, and mobile payment asset accounts.',
        writers: ['ADMIN', 'ACCOUNTANT'],
        columns: ['code', 'name', 'account_type'],
        fields: [
            ['code', 'GL code', 'text', true],
            ['name', 'GL account name', 'text', true],
            ['account_type', 'Account type', 'select', true, ['ASSET']]
        ]
    },
    products: {
        title: 'Products',
        description: 'One catalog. Clear prices. Stock managed through transactions.',
        writers: [...am, 'PURCHASE'],
        columns: ['sku', 'name', 'category', 'brand', 'selling_price', 'reorder_level_pcs', 'is_active'],
        fields: [
            ['sku', 'SKU', 'text', true],
            ['name', 'Product name', 'text', true],
            ['category', 'Category'],
            ['brand', 'Brand'],
            ['model', 'Model'],
            ['default_purchase_price', 'Default purchase price', 'decimal'],
            ['selling_price', 'Selling price', 'decimal'],
            ['reorder_level_pcs', 'Reorder level · PCS', 'integer'],
            ['is_active', 'Active', 'checkbox']
        ]
    },
    customers: {
        title: 'Customers',
        description: 'Customer accounts, contact details, and transaction history.',
        writers: [...am, 'CASHIER'],
        columns: ['name', 'phone', 'shop_name', 'party_name', 'area_name', 'sales_channel'],
        fields: [
            ['name', 'Customer name', 'text', true],
            ['phone', 'Phone'],
            ['address', 'Address'],
            ['shop_name', 'Shop name'],
            ['nid_number', 'NID number'],
            ['tin_number', 'TIN number'],
            ['trade_license_number', 'Trade license number'],
            ['bank_name', 'Bank name'],
            ['cheque_number', 'Cheque number'],
            ['party_name', 'Party name'],
            ['area_name', 'Area name'],
            ['sales_channel', 'Sales channel']
        ]
    },
    suppliers: {
        title: 'Suppliers',
        description: 'Reuse supplier accounts across your purchases and payments.',
        writers: [...am, 'PURCHASE'],
        columns: ['name', 'phone', 'address'],
        fields: [
            ['name', 'Supplier name', 'text', true],
            ['phone', 'Phone'],
            ['address', 'Address']
        ]
    },
    warehouses: {
        title: 'Warehouses',
        description: 'Your inventory locations and warehouse configuration.',
        writers: am,
        columns: ['code', 'name'],
        fields: [
            ['code', 'Warehouse code', 'text', true],
            ['name', 'Warehouse name', 'text', true]
        ]
    },
    'payment-accounts': {
        title: 'Payment accounts',
        description: 'Cash, bank, bKash, and Nagad accounts connected to the general ledger.',
        writers: ['ADMIN', 'ACCOUNTANT'],
        columns: ['name', 'account_type', 'gl_account_id', 'is_active'],
        fields: [
            ['name', 'Account name', 'text', true],
            ['account_type', 'Account type', 'select', true, ['CASH', 'BANK', 'BKASH', 'NAGAD', 'OTHER']],
            ['gl_account_id', 'GL account', 'account', true],
            ['is_active', 'Active', 'checkbox']
        ]
    },
    users: {
        title: 'Team members',
        description: 'Manage individual user access and responsibilities.',
        writers: ['ADMIN'],
        columns: ['name', 'email', 'role', 'is_active'],
        fields: [
            ['name', 'Full name', 'text', true],
            ['email', 'Email address', 'email', true],
            ['password', 'Password · at least 12 characters', 'password'],
            [
                'role',
                'Role',
                'select',
                true,
                ['ADMIN', 'MANAGER', 'PURCHASE', 'WAREHOUSE', 'CASHIER', 'ACCOUNTANT']
            ],
            ['is_active', 'Active', 'checkbox']
        ]
    },
    company: {
        title: 'Company settings',
        description: 'Company details shown in your business workspace.',
        writers: ['ADMIN'],
        columns: ['company_code', 'company_name', 'address'],
        fields: [
            ['company_code', 'Company code', 'text', true],
            ['company_name', 'Company name', 'text', true],
            ['address', 'Address']
        ]
    }
};
