import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Panel } from '../../../components/layout/Panel';
import { Empty } from '../../../components/ui/EmptyState';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
export const StockWatchPanel = ({ rows, isLoading, error }) => {
    return (
        <Panel
            title="Stock watch"
            description="Items at or below their reorder level"
            action={<AlertTriangle size={17} className="text-amber-600" />}
            footer={
                <Link
                    className="flex items-center justify-between border-t px-5 py-4 text-xs font-semibold text-pine"
                    to="/reports?report=low-stock"
                >
                    View stock report
                    <ArrowUpRight size={15} />
                </Link>
            }
        >
            {isLoading ? (
                <Loading />
            ) : error ? (
                <ErrorBox error={error} />
            ) : rows?.length ? (
                <div className="divide-y">
                    {rows.map((row) => (
                        <div
                            key={`${row.product_id}-${row.warehouse_id}`}
                            className="flex items-center justify-between gap-3 px-5 py-4"
                        >
                            <div>
                                <p className="text-sm font-medium">{row.product}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {row.sku} · {row.warehouse}
                                </p>
                            </div>
                            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                                {row.quantity_pcs} PCS
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty text="Stock is in good shape" detail="Low-stock items will be listed here." />
            )}
        </Panel>
    );
};
