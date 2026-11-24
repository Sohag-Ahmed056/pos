import { useState } from 'react';
import { useGetProductLedgerQuery } from '../productLedgerApi';
import { ProductLedgerFilters, ProductLedgerExports } from './ProductLedgerFilters';
import { ProductLedgerTable } from './ProductLedgerTable';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Loading } from '../../../components/ui/Loading';
import { statementValue } from '../model/statementFormat';

export const ProductActivitySummary = ({ result }) => {
    const sale = result.kind === 'customer';
    const metrics = [
        ...(!sale
            ? [
                  ['ordered', 'Ordered PCS'],
                  ['received', 'Received PCS']
              ]
            : [['sold', 'Sold PCS']]),
        ['returned', 'Returned PCS'],
        ['net_quantity', sale ? 'Net sold PCS' : 'Net received PCS'],
        ['amount', sale ? 'Net sales value (BDT)' : 'Net received value (BDT)']
    ];
    return (
        <>
            <div
                className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
                aria-label="Product activity totals"
            >
                {metrics.map(([key, title]) => (
                    <div key={key} className="rounded-xl border bg-white p-4">
                        <p className="text-xs text-slate-500">{title}</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums">
                            {statementValue(result.totals[key], {
                                type: key === 'amount' ? 'money' : 'quantity'
                            })}
                        </p>
                    </div>
                ))}
            </div>
            <details className="mb-5 rounded-xl border bg-white p-4" open>
                <summary className="cursor-pointer font-semibold">
                    Product summary · {result.products.length} products · Full filtered scope
                </summary>
                <div className="mt-4 max-h-80 overflow-auto">
                    <table
                        className="w-full min-w-[650px] text-left text-xs"
                        aria-label="Product-wise summary"
                    >
                        <thead className="bg-slate-50">
                            <tr>
                                {['Product / SKU', ...metrics.map(([, title]) => title)].map((title) => (
                                    <th key={title} className="p-3">
                                        {title}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {result.products.map((row) => (
                                <tr key={row.product_id}>
                                    <td className="p-3">
                                        {row.product}
                                        <span className="block text-slate-400">{row.sku}</span>
                                    </td>
                                    {metrics.map(([key]) => (
                                        <td key={key} className="p-3 tabular-nums">
                                            {statementValue(row[key], {
                                                type: key === 'amount' ? 'money' : 'quantity'
                                            })}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </>
    );
};
export const ProductLedgerReport = ({ resource, id, section }) => {
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const query = { ...filters, ...(section ? { section } : {}), page, limit: 20 };
    const { currentData, error, isFetching } = useGetProductLedgerQuery({ resource, id, filters: query });
    const result = currentData?.data;
    return (
        <div className="space-y-5" aria-busy={isFetching}>
            <ProductLedgerFilters
                value={filters}
                productSelected={resource === 'products'}
                onApply={(next) => {
                    setFilters(next);
                    setPage(1);
                }}
                busy={isFetching}
            />
            <ProductLedgerExports resource={resource} id={id} filters={query} />
            {error ? (
                <ErrorBox error={error} />
            ) : !result ? (
                <Loading />
            ) : (
                <>
                    <ProductActivitySummary result={result} />
                    <ProductLedgerTable result={result} page={page} onPageChange={setPage} />
                </>
            )}
        </div>
    );
};
