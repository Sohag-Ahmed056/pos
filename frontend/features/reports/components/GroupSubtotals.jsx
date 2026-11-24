import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { label } from '../../../lib/format';
export const GroupSubtotals = ({ subtotals, group, onGroupChange }) => {
    return (
        <Panel
            className="mt-6"
            title="Group subtotals"
            action={
                <select
                    className="w-44"
                    value={group}
                    onChange={(event) => onGroupChange(event.target.value)}
                    aria-label="Subtotal grouping"
                >
                    {Object.keys(subtotals).map((key) => (
                        <option key={key} value={key}>
                            {label(key)}
                        </option>
                    ))}
                </select>
            }
            footer={
                <p className="border-t p-4 text-xs text-slate-500">
                    Subtotals include the entire filtered report. Groups use the snapshots saved when each
                    transaction was posted.
                </p>
            }
        >
            <DataTable columns={['name', 'opening', 'debit', 'credit', 'closing']} rows={subtotals[group]} />
        </Panel>
    );
};
