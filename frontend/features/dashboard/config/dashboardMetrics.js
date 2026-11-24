import {
    ShoppingCart,
    Package,
    Users,
    Truck,
    Banknote,
    Receipt,
    TrendingUp,
    AlertTriangle
} from 'lucide-react';
export const dashboardMetrics = [
    ['Today’s sales', 'today_sales', ShoppingCart],
    ['Monthly sales', 'monthly_sales', TrendingUp],
    ['Today’s collection', 'today_collection', Banknote],
    ['Customer outstanding', 'customer_outstanding', Users],
    ['Stock value', 'stock_value', Package],
    ['Goods received · selected dates', 'total_purchases', Truck],
    ['Supplier outstanding', 'supplier_outstanding', Truck],
    ['Customer collections', 'customer_collections', Banknote],
    ['Supplier payments', 'supplier_payments', Banknote],
    ['Expenses · selected dates', 'expenses', Receipt],
    ['Gross profit', 'gross_profit', TrendingUp],
    ['Net profit', 'net_profit', TrendingUp],
    ['Low-stock locations', 'low_stock_products', AlertTriangle]
];
