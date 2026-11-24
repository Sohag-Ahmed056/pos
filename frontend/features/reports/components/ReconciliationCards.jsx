import { MetricCard } from '../../../components/layout/MetricCard';
import { label } from '../../../lib/format';
export const ReconciliationCards = ({ result }) => {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(result || {}).map(([key, value]) => {
                const difference = ['difference', 'mismatches', 'unbalanced', 'unassigned'].some((word) =>
                    key.includes(word)
                );
                return (
                    <MetricCard
                        key={key}
                        title={label(key)}
                        value={
                            <span
                                className={
                                    difference ? (Number(value) === 0 ? 'text-pine' : 'text-red-700') : ''
                                }
                            >
                                {String(value)}
                            </span>
                        }
                    />
                );
            })}
        </div>
    );
};
