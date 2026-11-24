import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus } from 'lucide-react';
import { selectRole } from '../../auth/authSlice';
import { useDeleteCatalogRecordMutation } from '../catalogApi';
import { useCatalogList } from '../hooks/useCatalogList';
import { catalogResources } from '../config/catalogResources';
import { CatalogToolbar } from '../components/CatalogToolbar';
import { CatalogRecordForm } from '../components/CatalogRecordForm';
import { CatalogProfile } from '../components/CatalogProfile';
import { CatalogRowActions } from '../components/CatalogRowActions';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Panel } from '../../../components/layout/Panel';
import { Button } from '../../../components/ui/Button';
import { Confirm } from '../../../components/ui/ConfirmDialog';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useToast } from '../../../components/ui/ToastProvider';
import { DataTable } from '../../../components/data/DataTable';
import { Pagination } from '../../../components/data/Pagination';
import { label } from '../../../lib/format';
import { errorText } from '../../../lib/errors';
const CatalogPage = ({ resource }) => {
    const config = catalogResources[resource];
    const role = useSelector(selectRole);
    const list = useCatalogList(resource);
    const [editing, setEditing] = useState(null),
        [profile, setProfile] = useState(null),
        [deleting, setDeleting] = useState(null);
    const [remove, { isLoading: busy }] = useDeleteCatalogRecordMutation();
    const toast = useToast();
    const writable = config.writers.includes(role);
    const deleteRecord = async () => {
        try {
            await remove({ resource, id: deleting.id }).unwrap();
            toast('Record deleted');
            setDeleting(null);
        } catch (error) {
            toast(errorText(error), true);
        }
    };
    return (
        <>
            <PageHeader eyebrow="BUSINESS DIRECTORY" title={config.title} description={config.description}>
                {writable && (
                    <Button onClick={() => setEditing({})}>
                        <Plus size={16} />
                        Add {resource === 'company' ? 'company details' : label(resource.replace(/s$/, ''))}
                    </Button>
                )}
            </PageHeader>
            <Panel footer={<Pagination meta={list.data?.meta} page={list.page} onChange={list.setPage} />}>
                <CatalogToolbar
                    resource={resource}
                    title={config.title}
                    filters={list.filters}
                    onChange={list.setFilter}
                    total={list.data?.meta?.total}
                />
                {list.isLoading ? (
                    <Loading />
                ) : list.error ? (
                    <ErrorBox error={list.error} />
                ) : (
                    <DataTable
                        columns={config.columns}
                        rows={list.data?.data}
                        actions={(row) => (
                            <CatalogRowActions
                                row={row}
                                profile={['products', 'customers', 'suppliers'].includes(resource)}
                                writable={writable && resource !== 'accounts'}
                                deletable={
                                    ['ADMIN', 'MANAGER'].includes(role) &&
                                    ['products', 'customers', 'suppliers', 'warehouses'].includes(resource)
                                }
                                onProfile={setProfile}
                                onEdit={setEditing}
                                onDelete={setDeleting}
                            />
                        )}
                    />
                )}
            </Panel>
            {editing && (
                <CatalogRecordForm
                    key={editing.id || 'new'}
                    resource={resource}
                    initial={editing.id ? editing : null}
                    onClose={() => setEditing(null)}
                />
            )}{' '}
            {profile && <CatalogProfile resource={resource} row={profile} onClose={() => setProfile(null)} />}{' '}
            {deleting && (
                <Confirm
                    title="Delete this record?"
                    description="Referenced records are protected by the database and cannot be deleted."
                    onClose={() => setDeleting(null)}
                    busy={busy}
                    onConfirm={deleteRecord}
                />
            )}
        </>
    );
};

export default CatalogPage;
