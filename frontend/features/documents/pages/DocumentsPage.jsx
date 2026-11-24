import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus } from 'lucide-react';
import { selectRole } from '../../auth/authSlice';
import { useLazyGetDocumentQuery, usePostDocumentMutation } from '../documentsApi';
import { useDocumentList } from '../hooks/useDocumentList';
import { documentTypes } from '../config/documentTypes';
import { useIdempotentMutation } from '../../../hooks/useIdempotentMutation';
import { DocumentEditor } from '../components/DocumentEditor';
import { DocumentDetailDialog } from '../components/DocumentDetailDialog';
import { DocumentToolbar } from '../components/DocumentToolbar';
import { DocumentRowActions } from '../components/DocumentRowActions';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Panel } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { Confirm } from '../../../components/ui/ConfirmDialog';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useToast } from '../../../components/ui/ToastProvider';
import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { errorText } from '../../../lib/errors';
import { PendingPurchases } from '../components/PendingPurchases';
const DocumentsPage = ({ kind }) => {
    const config = documentTypes[kind];
    const role = useSelector(selectRole);
    const list = useDocumentList(kind);
    const [editing, setEditing] = useState(null),
        [view, setView] = useState(null),
        [posting, setPosting] = useState(null);
    const [load] = useLazyGetDocumentQuery();
    const [pending, setPending] = useState(false);
    const [post, { isLoading: busy }] = useIdempotentMutation(usePostDocumentMutation());
    const toast = useToast();
    const writable = config.writers.includes(role),
        postable = writable && (kind !== 'adjustments' || ['ADMIN', 'MANAGER'].includes(role));
    const columns = [
        config.number,
        config.date,
        ...(config.party ? [config.party] : config.source ? [config.source] : []),
        ...(['sales', 'receipts', 'payments', 'expenses', 'sales-returns', 'purchase-returns'].includes(kind)
            ? [kind === 'sales' || kind.includes('returns') ? 'total_amount' : 'amount']
            : []),
        'status'
    ];
    const edit = async (row) => {
        try {
            const response = await load({ resource: kind, id: row.id }, true).unwrap();
            setEditing(response.data);
        } catch (error) {
            toast(errorText(error), true);
        }
    };
    const confirmPost = async () => {
        try {
            await post({ kind, id: posting.id });
            toast('Transaction posted');
            setPosting(null);
        } catch (error) {
            toast(errorText(error), true);
        }
    };
    return (
        <>
            <PageHeader
                eyebrow="DAILY OPERATIONS"
                title={config.title}
                description="Create drafts, review details, and post approved transactions."
            >
                {writable && (
                    <Button onClick={() => setEditing({})}>
                        <Plus size={16} />
                        New {config.singular.toLowerCase()}
                    </Button>
                )}
            </PageHeader>
            {kind === 'grns' && (
                <div className="mb-5 flex gap-2">
                    <Button variant={pending ? 'secondary' : 'primary'} onClick={() => setPending(false)}>
                        Goods receipt history
                    </Button>
                    <Button variant={pending ? 'primary' : 'secondary'} onClick={() => setPending(true)}>
                        Pending purchases
                    </Button>
                </div>
            )}
            {pending ? (
                <PendingPurchases
                    onReceive={writable ? (id) => setEditing({ purchase_id: id }) : undefined}
                />
            ) : (
                <Panel
                    footer={<Pagination meta={list.data?.meta} page={list.page} onChange={list.setPage} />}
                >
                    <DocumentToolbar
                        kind={kind}
                        search={list.search}
                        onSearch={list.setSearch}
                        status={list.status}
                        onStatus={list.setStatus}
                    />
                    {list.isLoading ? (
                        <Loading />
                    ) : list.error ? (
                        <ErrorBox error={list.error} />
                    ) : (
                        <DataTable
                            columns={columns}
                            rows={list.data?.data}
                            actions={(row) => (
                                <DocumentRowActions
                                    row={row}
                                    writable={writable}
                                    postable={postable}
                                    onView={setView}
                                    onEdit={edit}
                                    onPost={setPosting}
                                />
                            )}
                        />
                    )}
                </Panel>
            )}
            {editing && (
                <DocumentEditor
                    key={editing.id || 'new'}
                    kind={kind}
                    initial={editing.id || editing.purchase_id ? editing : null}
                    onClose={() => setEditing(null)}
                />
            )}{' '}
            {view && (
                <DocumentDetailDialog
                    kind={kind}
                    id={view}
                    onClose={() => setView(null)}
                    onEdit={
                        writable
                            ? (document) => {
                                  setView(null);
                                  setEditing(document);
                              }
                            : null
                    }
                />
            )}{' '}
            {posting && (
                <Confirm
                    title={kind === 'purchases' ? 'Confirm purchase?' : 'Post transaction?'}
                    description={
                        kind === 'purchases'
                            ? 'Confirm this order for receiving. This does not increase stock.'
                            : 'This commits financial and stock changes. Posted documents require a return or reversal for corrections.'
                    }
                    onClose={() => setPosting(null)}
                    busy={busy}
                    onConfirm={confirmPost}
                />
            )}
        </>
    );
};

export default DocumentsPage;
