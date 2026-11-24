import { Panel } from '../../../components/layout/Panel';
import { Empty } from '../../../components/ui/EmptyState';
import { money } from '../../../lib/format';
export const SalesActivityChart = ({ trend = [], granularity = 'day' }) => {
    const maximum = Math.max(...trend.map((row) => Number(row.amount)), 1);
    return (
        <Panel
            className="xl:col-span-2"
            title="Sales activity"
            description={`${granularity === 'month' ? 'Monthly' : 'Daily'} posted sales for the selected dates`}
            action={<span className="text-xs text-slate-500">BDT</span>}
        >
            {trend.length ? (
                <div className="flex h-56 items-end gap-3 px-6 pb-6 pt-8">
                    {trend.map((row) => (
                        <div
                            key={row.date}
                            className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center"
                        >
                            <div
                                className="group relative min-h-1 rounded-t bg-pine/80 hover:bg-pine"
                                style={{ height: `${Math.max((Number(row.amount) / maximum) * 100, 2)}%` }}
                                title={`${row.date}: BDT ${money(row.amount)}`}
                            >
                                <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 text-[9px] group-hover:block">
                                    {money(row.amount)}
                                </span>
                            </div>
                            <span className="truncate text-[9px] text-slate-400">
                                {granularity === 'month' ? row.date.slice(0, 7) : row.date.slice(5)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty
                    text="Your next sale starts the chart"
                    detail="Posted sales will appear here automatically."
                />
            )}
        </Panel>
    );
};
