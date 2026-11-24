import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGetReportQuery } from '../../reports/reportsApi';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Panel } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Loading } from '../../../components/ui/Loading';
import { DataTable } from '../../../components/data/DataTable';
import { JournalEditorDialog } from '../components/JournalEditorDialog';
import { JournalReversalDialog } from '../components/JournalReversalDialog';
import { JournalReversalPanel } from '../components/JournalReversalPanel';
const AccountingPage = () => {
    const [creating, setCreating] = useState(false),
        [reversing, setReversing] = useState(null);
    const { data, isLoading, error } = useGetReportQuery({ name: 'general-ledger', filters: { limit: 30 } });
    return (
        <>
            <PageHeader
                eyebrow="DOUBLE-ENTRY ACCOUNTING"
                title="Accounting"
                description="Opening balances, authorized adjustments, and explicit reversals."
            >
                <Button onClick={() => setCreating(true)}>
                    <Plus size={16} />
                    Post a journal
                </Button>
            </PageHeader>
            <JournalReversalPanel onReverse={setReversing} />
            <Panel title="Recent general ledger lines">
                {isLoading ? (
                    <Loading />
                ) : error ? (
                    <ErrorBox error={error} />
                ) : (
                    <DataTable columns={data?.data?.columns || []} rows={data?.data?.rows} />
                )}
            </Panel>
            {creating && <JournalEditorDialog onClose={() => setCreating(false)} />}{' '}
            {reversing && <JournalReversalDialog id={reversing} onClose={() => setReversing(null)} />}
        </>
    );
};

export default AccountingPage;
