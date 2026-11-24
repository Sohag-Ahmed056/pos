import { MetricCard } from '../../../components/layout/MetricCard';
import { money } from '../../../lib/format';
import { dashboardMetrics } from '../config/dashboardMetrics';
export const DashboardMetrics = ({ summary }) => {
    return (
        <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map(([title, key, Icon], index) => (
                <MetricCard
                    key={key}
                    title={title}
                    icon={Icon}
                    featured={index === 0}
                    value={
                        key === 'low_stock_products' ? (
                            summary[key] || 0
                        ) : (
                            <>
                                <span className="mr-1.5 text-sm font-normal opacity-50">৳</span>
                                {money(summary[key])}
                            </>
                        )
                    }
                    caption={
                        index === 0
                            ? 'Posted today'
                            : index === 1
                              ? 'Current month'
                              : 'From posted transactions'
                    }
                />
            ))}
        </div>
    );
};
