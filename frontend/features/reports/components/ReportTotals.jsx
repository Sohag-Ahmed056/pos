import { MetricCard } from '../../../components/layout/MetricCard';
import { money, label } from '../../../lib/format';
export const ReportTotals = ({ totals }) => {
    const titles = {
        opening: 'Opening balance',
        debit: 'Debits in period',
        credit: 'Credits in period',
        closing: 'Closing balance',
        net_movement: 'Net movement (debit − credit)',
        total_expenses: 'Total expenses'
    };
    return (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(totals).map(([key, value]) => (
                <MetricCard key={key} title={titles[key] || label(key)} value={`৳ ${money(value)}`} />
            ))}
        </div>
    );
};
