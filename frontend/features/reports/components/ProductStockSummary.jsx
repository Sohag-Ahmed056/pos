import { statementValue } from '../model/statementFormat';
const value = (input, type = 'quantity') => statementValue(input, { type });
export const ProductStockSummary = ({ result }) => {
    const { selection: product, stock, warehouses } = result;
    const info = [
        ['Product ID', product.id],
        ['Category', product.category || '—'],
        ['Brand', product.brand || '—'],
        ['Model', product.model || '—'],
        ['Unit', 'PCS'],
        ['Status', product.is_active ? 'Active' : 'Inactive'],
        ['Default purchase price', `BDT ${value(product.default_purchase_price, 'cost')}`],
        ['Current selling price', `BDT ${value(product.selling_price, 'cost')}`],
        ['Current average cost', `BDT ${value(stock.current_avg_cost, 'cost')}`],
        ['Reorder level', `${value(product.reorder_level_pcs)} PCS`],
        ['Current stock', `${value(stock.current_quantity)} PCS`],
        ['Current inventory value', `BDT ${value(stock.current_value, 'money')}`]
    ];
    return (
        <>
            <section className="mb-5 rounded-xl border bg-white p-5" aria-label="Product information">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-pine">
                            {product.sku}
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold">{product.name}</h2>
                    </div>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${stock.low_stock ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-pine'}`}
                    >
                        {stock.low_stock ? 'Low stock' : 'Stock available'}
                    </span>
                </div>
                <dl className="grid gap-5 sm:grid-cols-3 xl:grid-cols-4">
                    {info.map(([title, content]) => (
                        <div key={title}>
                            <dt className="text-xs text-slate-500">{title}</dt>
                            <dd className="mt-1 text-sm font-medium">{content}</dd>
                        </div>
                    ))}
                </dl>
            </section>
            <section className="mb-5" aria-label="Physical stock summary">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Physical stock · Full product / warehouse scope</h3>
                    <span className={`text-xs ${stock.reconciled ? 'text-pine' : 'text-red-700'}`}>
                        {stock.reconciled
                            ? 'All-time quantities reconcile with inventory balances'
                            : 'Stock reconciliation discrepancy — review source movements'}
                    </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['opening', 'Opening PCS'],
                        ['quantity_in', 'Stock in PCS'],
                        ['quantity_out', 'Stock out PCS'],
                        ['closing', 'Closing PCS']
                    ].map(([key, title]) => (
                        <div key={key} className="rounded-xl border bg-white p-4">
                            <p className="text-xs text-slate-500">{title}</p>
                            <p className="mt-2 text-2xl font-semibold tabular-nums">{value(stock[key])}</p>
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                    Opening + In − Out = Closing. Party, movement-type and search filters narrow displayed
                    transactions only. Historical opening value: BDT {value(stock.opening_value, 'money')} ·
                    Historical closing value: BDT {value(stock.closing_value, 'money')}.
                </p>
            </section>
            <section
                className="mb-5 overflow-hidden rounded-xl border bg-white"
                aria-label="Warehouse-wise stock"
            >
                <h3 className="border-b p-4 font-semibold">Warehouse-wise stock</h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                        <thead className="bg-slate-50">
                            <tr>
                                {[
                                    'Warehouse',
                                    'Opening PCS',
                                    'In PCS',
                                    'Out PCS',
                                    'Closing PCS',
                                    'Historical closing value (BDT)',
                                    'Current PCS',
                                    'Current avg cost (BDT)',
                                    'Current value (BDT)',
                                    'Status'
                                ].map((title) => (
                                    <th key={title} className="p-3">
                                        {title}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {warehouses.map((row) => (
                                <tr key={row.warehouse_id}>
                                    <td className="p-3">{row.warehouse}</td>
                                    {[
                                        'opening',
                                        'quantity_in',
                                        'quantity_out',
                                        'closing',
                                        'closing_value',
                                        'current_quantity',
                                        'current_avg_cost',
                                        'current_value'
                                    ].map((key) => (
                                        <td key={key} className="p-3 tabular-nums">
                                            {value(
                                                row[key],
                                                key.includes('value')
                                                    ? 'money'
                                                    : key.includes('cost')
                                                      ? 'cost'
                                                      : 'quantity'
                                            )}
                                        </td>
                                    ))}
                                    <td className="p-3">
                                        {row.reconciled
                                            ? row.low_stock
                                                ? 'Low stock'
                                                : 'Reconciled'
                                            : 'Mismatch'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <details className="mb-5 rounded-xl border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                    Product profitability · Data limitation
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-600">{result.profitability.reason}</p>
            </details>
        </>
    );
};
