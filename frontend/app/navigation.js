import { documentReadRoles } from '../features/auth/permissions.js';
import {
    LayoutDashboard,
    Package,
    Users,
    Truck,
    Warehouse,
    ShoppingCart,
    ShoppingBag,
    ClipboardCheck,
    Banknote,
    Receipt,
    RotateCcw,
    SlidersHorizontal,
    BarChart3,
    Settings
} from 'lucide-react';
const managers = ['ADMIN', 'MANAGER'];
const entry = (label, path, icon, roles) => ({ label, path, icon, roles });
export const navigation = [
    {
        title: 'Workspace',
        items: [
            entry('Overview', '/', LayoutDashboard, [...managers, 'ACCOUNTANT']),
            entry('Sales', '/documents/sales', ShoppingCart, documentReadRoles['sales']),
            entry('Customers', '/masters/customers', Users, [...managers, 'CASHIER', 'ACCOUNTANT']),
            entry('Collections', '/documents/receipts', Banknote, documentReadRoles['receipts'])
        ]
    },
    {
        title: 'Operations',
        items: [
            entry('Products', '/masters/products', Package, [
                ...managers,
                'PURCHASE',
                'WAREHOUSE',
                'ACCOUNTANT'
            ]),
            entry('Purchases', '/documents/purchases', ShoppingBag, documentReadRoles['purchases']),
            entry('Goods receipts', '/documents/grns', ClipboardCheck, documentReadRoles['grns']),
            entry('Suppliers', '/masters/suppliers', Truck, [...managers, 'PURCHASE', 'ACCOUNTANT']),
            entry('Supplier payments', '/documents/payments', Banknote, documentReadRoles['payments']),
            entry('Warehouses', '/masters/warehouses', Warehouse, [...managers, 'WAREHOUSE']),
            entry(
                'Stock adjustments',
                '/documents/adjustments',
                SlidersHorizontal,
                documentReadRoles['adjustments']
            ),
            entry('Sales returns', '/documents/sales-returns', RotateCcw, documentReadRoles['sales-returns']),
            entry(
                'Purchase returns',
                '/documents/purchase-returns',
                RotateCcw,
                documentReadRoles['purchase-returns']
            ),
            entry('Expenses', '/documents/expenses', Receipt, documentReadRoles['expenses'])
        ]
    },
    {
        title: 'Inventory',
        items: [
            entry('Product Ledger', '/inventory/product-ledger', Package, [
                ...managers,
                'PURCHASE',
                'WAREHOUSE',
                'ACCOUNTANT'
            ])
        ]
    },
    {
        title: 'Insights',
        items: [
            entry('Reports & ledgers', '/reports', BarChart3, [
                ...managers,
                'CASHIER',
                'ACCOUNTANT',
                'PURCHASE',
                'WAREHOUSE'
            ]),
            entry('Accounting', '/accounting', Receipt, ['ADMIN', 'ACCOUNTANT'])
        ]
    },
    {
        title: 'Administration',
        items: [
            entry('Payment accounts', '/masters/payment-accounts', Banknote, ['ADMIN', 'ACCOUNTANT']),
            entry('Team members', '/masters/users', Users, ['ADMIN']),
            entry('Company settings', '/masters/company', Settings, ['ADMIN']),
            entry('Audit history', '/audit', Receipt, managers)
        ]
    }
];
export const visibleNavigation = (role) =>
    navigation
        .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role)) }))
        .filter((section) => section.items.length);
export const homeForRole = (role) => visibleNavigation(role)[0]?.items[0]?.path || '/reports';
export const routeRoles = (path) => {
    return navigation.flatMap((section) => section.items).find((item) => item.path === path)?.roles || [];
};
