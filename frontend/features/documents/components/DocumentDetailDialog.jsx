import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { useGetDocumentQuery } from '../documentsApi';
import { useGetCatalogRecordQuery, useListCatalogQuery } from '../../catalog/catalogApi';
import { documentTypes } from '../config/documentTypes';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { VoucherDocument } from './detail/VoucherDocument';
import { AllocationDialog } from './detail/AllocationDialog';
export const DocumentDetailDialog = ({ kind, id, onClose, onEdit }) => {
    const config = documentTypes[kind];
    const { data, isLoading, error } = useGetDocumentQuery({ resource: kind, id });
    const document = data?.data;
    const { data: company } = useListCatalogQuery({ resource: 'company', filters: { limit: 1 } });
    const { data: party } = useGetCatalogRecordQuery(
        { resource: config.partyResource, id: document?.[config.party] },
        { skip: !config.party || !document?.[config.party] }
    );
    const [allocating, setAllocating] = useState(false);
    const { data: warehouse } = useGetCatalogRecordQuery(
        { resource: 'warehouses', id: document?.warehouse_id },
        { skip: !document?.warehouse_id }
    );
    return (
        <Modal title={document?.[config.number] || config.singular} onClose={onClose} wide>
            {isLoading ? (
                <Loading />
            ) : error ? (
                <ErrorBox error={error} />
            ) : (
                document && (
                    <>
                        <VoucherDocument
                            kind={kind}
                            document={document}
                            company={company?.data?.[0]}
                            party={party?.data}
                            warehouse={warehouse?.data}
                        />
                        {createPortal(
                            <div className="print-root">
                                <VoucherDocument
                                    kind={kind}
                                    document={document}
                                    company={company?.data?.[0]}
                                    party={party?.data}
                                    warehouse={warehouse?.data}
                                />
                            </div>,
                            window.document.body
                        )}
                        <div className="no-print mt-6 flex justify-end gap-2">
                            {document.status === 'DRAFT' && onEdit && (
                                <Button variant="secondary" onClick={() => onEdit(document)}>
                                    Edit draft
                                </Button>
                            )}
                            {document.status === 'POSTED' &&
                                onEdit &&
                                ['receipts', 'payments'].includes(kind) && (
                                    <Button variant="secondary" onClick={() => setAllocating(true)}>
                                        Allocate payment
                                    </Button>
                                )}
                            <Button onClick={() => window.print()}>
                                <Printer size={16} />
                                Print voucher
                            </Button>
                        </div>
                        {allocating && (
                            <AllocationDialog
                                kind={kind}
                                document={document}
                                onClose={() => setAllocating(false)}
                            />
                        )}
                    </>
                )
            )}
        </Modal>
    );
};
