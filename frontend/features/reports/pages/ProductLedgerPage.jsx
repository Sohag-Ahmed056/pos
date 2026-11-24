import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRole } from '../../auth/authSlice';
import { canReadDocument } from '../../auth/permissions';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ResourceLookup } from '../../../components/data/ResourceLookup';
import { Button } from '../../../components/ui/Button';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Loading } from '../../../components/ui/Loading';
import { useGetProductLedgerQuery } from '../productLedgerApi';
import { ProductLedgerFilters, ProductLedgerExports } from '../components/ProductLedgerFilters';
import { ProductStockSummary } from '../components/ProductStockSummary';
import { ProductLedgerTable } from '../components/ProductLedgerTable';
import { ProductActivitySummary } from '../components/ProductLedgerReport';

const ProductLedgerPage = () => {
    const [params, setParams] = useSearchParams();
    const id = params.get('product_id') || '';
    const role = useSelector(selectRole);
    const [section, setSection] = useState('movements');
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const queryFilters = { ...filters, section, page, limit: 20 };
    const { currentData, error, isFetching } = useGetProductLedgerQuery(
        { resource: 'products', id, filters: queryFilters },
        { skip: !id }
    );
    const result = currentData?.data;
    const stockQuery = useGetProductLedgerQuery(
        { resource: 'products', id, filters: { ...filters, section: 'movements', page: 1, limit: 1 } },
        { skip: !id || section === 'movements' }
    );
    const stockResult = section === 'movements' ? result : stockQuery.currentData?.data;
    const tabs = [
        ['movements', 'Stock movements'],
        ['purchases', 'Purchases & GRNs'],
        ['sales', 'Sales'],
        ['sales-returns', 'Sales returns'],
        ['purchase-returns', 'Purchase returns']
    ].filter(([key]) => key === 'movements' || canReadDocument(key === 'purchases' ? 'grns' : key, role));
    return (
        <>
            <PageHeader
                eyebrow="INVENTORY"
                title="Product Ledger"
                description="Product information, posted stock movements and historical purchase, sale and return activity."
            >
                {id && <ProductLedgerExports resource="products" id={id} filters={queryFilters} />}
            </PageHeader>
            <div className="mb-5 max-w-xl rounded-xl border bg-white p-4">
                <ResourceLookup
                    resource="products"
                    title="Product or SKU"
                    value={id}
                    onChange={(next) => {
                        setParams(next ? { product_id: next } : {});
                        setPage(1);
                    }}
                />
            </div>
            {!id ? (
                <div className="rounded-xl border border-dashed bg-white p-12 text-center text-slate-500">
                    Select a product or search its SKU to view the complete ledger.
                </div>
            ) : (
                <>
                    <ProductLedgerFilters
                        key={id}
                        value={filters}
                        productSelected
                        standalone
                        onApply={(next) => {
                            setFilters(next);
                            setPage(1);
                        }}
                        busy={isFetching}
                    />
                    <p className="mb-4 text-xs text-slate-500">
                        Stock dates use UTC posting time. Purchase, sales and return history dates use the
                        document business date.
                    </p>
                    {stockResult && <ProductStockSummary result={stockResult} />}
                    {section !== 'movements' && stockQuery.error && <ErrorBox error={stockQuery.error} />}
                    <div
                        className="mb-5 flex flex-wrap gap-2"
                        role="tablist"
                        aria-label="Product ledger sections"
                    >
                        {tabs.map(([key, title]) => (
                            <Button
                                key={key}
                                role="tab"
                                aria-selected={key === section}
                                variant={key === section ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setSection(key);
                                    setPage(1);
                                }}
                            >
                                {title}
                            </Button>
                        ))}
                    </div>
                    {error ? (
                        <ErrorBox error={error} />
                    ) : !result ? (
                        <Loading />
                    ) : (
                        <div aria-busy={isFetching}>
                            {section === 'movements' ? (
                                <>
                                    <p className="mb-4 text-xs text-slate-500">
                                        Visible filtered movements: In {result.totals.quantity_in} PCS · Out{' '}
                                        {result.totals.quantity_out} PCS · {result.meta.total} rows. Physical
                                        balances above include all movement types and parties.
                                    </p>
                                </>
                            ) : (
                                <ProductActivitySummary result={result} />
                            )}
                            <ProductLedgerTable result={result} page={page} onPageChange={setPage} />
                        </div>
                    )}
                </>
            )}
        </>
    );
};
export default ProductLedgerPage;
