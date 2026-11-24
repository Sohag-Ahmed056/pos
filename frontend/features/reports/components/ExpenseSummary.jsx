import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { money } from '../../../lib/format';
export const ExpenseSummary = ({ summary }) => {
    return (
        <Panel
            className="mb-6"
            title="Expense summary by name"
            description="Totals include all matching expense postings and reversals on their accounting dates, across every page."
        >
            <DataTable
                rows={summary.rows}
                columns={[
                    { key: 'expense_name', title: 'Expense' },
                    { key: 'entries', title: 'Entries' },
                    { key: 'total_amount', title: 'Total · BDT', render: money }
                ]}
            />
        </Panel>
    );
};
