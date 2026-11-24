import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useGetDashboardQuery, useGetReportQuery } from '../../reports/reportsApi';
import { selectRole } from '../../auth/authSlice';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { DashboardMetrics } from '../components/DashboardMetrics';
import { SalesActivityChart } from '../components/SalesActivityChart';
import { StockWatchPanel } from '../components/StockWatchPanel';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { DateRangeFilter } from '../../../components/data/DateRangeFilter';
import { today } from '../../../lib/format';
const DashboardPage = () => {
    const [params, setParams] = useSearchParams();
    const period = {
        from: params.get('from') || `${today().slice(0, 7)}-01`,
        to: params.get('to') || today()
    };
    const { currentData: data, isLoading, isFetching, error } = useGetDashboardQuery(period);
    const stock = useGetReportQuery({ name: 'low-stock', filters: { limit: 5 } });
    const role = useSelector(selectRole);
    const summary = data?.data || {};
    return (
        <>
            <PageHeader
                eyebrow="BUSINESS AT A GLANCE"
                title="Overview"
                description="Your sales, stock, and finances in one place."
            >
                {['ADMIN', 'MANAGER'].includes(role) && (
                    <Button as={Link} to="/documents/sales">
                        <Plus size={17} />
                        New sale
                    </Button>
                )}
            </PageHeader>
            <section className="panel mb-6 p-5" aria-label="Dashboard date range">
                <DateRangeFilter value={period} onApply={setParams} busy={isFetching} />
                <p className="mt-3 text-xs text-slate-500">
                    Purchases, collections, payments, expenses, and profit use the selected dates. Today and
                    this month use Bangladesh time. Stock and outstanding balances are current.
                </p>
            </section>
            {error && <ErrorBox error={error} />}
            {isLoading || (isFetching && !data) ? (
                <Loading />
            ) : (
                data && (
                    <>
                        <DashboardMetrics summary={summary} />
                        <div className="mb-7 grid gap-6 xl:grid-cols-3">
                            <SalesActivityChart
                                trend={summary.trend}
                                granularity={summary.trend_granularity}
                            />
                            <StockWatchPanel
                                rows={stock.data?.data?.rows}
                                isLoading={stock.isLoading}
                                error={stock.error}
                            />
                        </div>
                        <RecentActivityTable rows={summary.recent} />
                    </>
                )
            )}
        </>
    );
};

export default DashboardPage;
