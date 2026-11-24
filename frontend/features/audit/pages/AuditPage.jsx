import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Panel } from '../../../components/layout/Panel';
import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Modal } from '../../../components/ui/Modal';
import { useAuditHistory } from '../hooks/useAuditHistory';
import { AuditFilters } from '../components/AuditFilters';
const AuditPage = () => {
    const audit = useAuditHistory();
    const [selected, setSelected] = useState(null);
    return (
        <>
            <PageHeader
                eyebrow="ACTIVITY & ACCOUNTABILITY"
                title="Audit history"
                description="Review who changed records, posted transactions, or managed access."
            >
                <Button variant="secondary" disabled={audit.isFetching} onClick={audit.refetch}>
                    <RefreshCw size={15} />
                    Refresh
                </Button>
            </PageHeader>
            <AuditFilters
                form={audit.form}
                set={audit.set}
                onApply={audit.apply}
                onReset={audit.reset}
                busy={audit.isFetching}
            />
            <Panel footer={<Pagination meta={audit.data?.meta} page={audit.page} onChange={audit.setPage} />}>
                {audit.error ? (
                    <ErrorBox error={audit.error} />
                ) : audit.isFetching && !audit.data ? (
                    <Loading />
                ) : (
                    <DataTable
                        rows={audit.data?.data}
                        columns={[
                            { key: 'created_at', title: 'Recorded at (UTC)' },
                            { key: 'user_name', title: 'User' },
                            'user_id',
                            'action_code',
                            'entity_type',
                            'entity_id'
                        ]}
                        actions={(row) => (
                            <Button variant="secondary" onClick={() => setSelected(row)}>
                                View details
                            </Button>
                        )}
                    />
                )}
            </Panel>
            {selected && (
                <Modal title={`Audit record ${selected.id}`} onClose={() => setSelected(null)}>
                    <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-slate-500">Action</dt>
                            <dd>{selected.action_code}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Record</dt>
                            <dd>
                                {selected.entity_type} · {selected.entity_id || '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">User</dt>
                            <dd>
                                {selected.user_name || 'Deleted user'} · {selected.user_id}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Recorded at (UTC)</dt>
                            <dd>{selected.created_at}</dd>
                        </div>
                    </dl>
                    <h3 className="mb-2 font-semibold">Recorded details</h3>
                    <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-4 text-xs">
                        {Object.keys(selected.details || {}).length
                            ? JSON.stringify(selected.details, null, 2)
                            : 'No additional details recorded.'}
                    </pre>
                </Modal>
            )}
        </>
    );
};

export default AuditPage;
