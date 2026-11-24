import { Link } from 'react-router-dom';
import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { money } from '../../../lib/format';
const columns = [
    { key: 'voucher_no', title: 'Voucher' },
    { key: 'gl_date', title: 'GL date' },
    { key: 'source_type', title: 'Transaction type' },
    { key: 'amount', title: 'Posted debit · BDT', render: money }
];
export const RecentActivityTable = ({ rows }) => {
    return (
        <Panel
            title="Recent activity"
            description="Latest posted accounting vouchers"
            action={
                <Link className="text-xs font-semibold text-pine" to="/reports?report=general-ledger">
                    View ledger →
                </Link>
            }
        >
            <DataTable columns={columns} rows={rows} />
        </Panel>
    );
};
