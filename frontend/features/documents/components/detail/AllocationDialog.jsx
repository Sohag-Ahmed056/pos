import { useState } from 'react';
import { useGetSettlementsQuery } from '../../../reports/reportsApi';
import { useAllocatePaymentMutation } from '../../documentsApi';
import { useIdempotentMutation } from '../../../../hooks/useIdempotentMutation';
import { serializeAllocations } from '../../model/documentDraft';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Loading } from '../../../../components/ui/Loading';
import { ErrorBox } from '../../../../components/ui/ErrorBox';
import { useToast } from '../../../../components/ui/ToastProvider';
import { money } from '../../../../lib/format';
import { PaymentAllocationsTable } from '../editor/PaymentAllocationsTable';
export const AllocationDialog = ({ kind, document, onClose }) => {
    const party = kind === 'receipts' ? 'customer' : 'supplier';
    const {
        data,
        isLoading,
        error: loadError
    } = useGetSettlementsQuery({ party, id: document[`${party}_id`] });
    const [amounts, setAmounts] = useState({}),
        [error, setError] = useState(null);
    const [allocate, { isLoading: saving }] = useIdempotentMutation(useAllocatePaymentMutation());
    const toast = useToast();
    const allocated = document.items.reduce((sum, item) => sum + Number(item.amount), 0);
    const submit = async (event) => {
        event.preventDefault();
        setError(null);
        try {
            await allocate({ kind, id: document.id, allocations: serializeAllocations(amounts) });
            toast('Allocations saved');
            onClose();
        } catch (failure) {
            setError(failure);
        }
    };
    return (
        <Modal title="Allocate available payment" onClose={onClose}>
            <p className="mb-5 text-sm text-slate-500">
                Unallocated amount: ৳ {money(Number(document.amount) - allocated)}
            </p>
            {(error || loadError) && <ErrorBox error={error || loadError} />}{' '}
            {isLoading ? (
                <Loading />
            ) : (
                <form onSubmit={submit}>
                    <PaymentAllocationsTable
                        rows={data?.data}
                        amounts={amounts}
                        onChange={(id, value) => setAmounts((previous) => ({ ...previous, [id]: value }))}
                    />
                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                            Save allocations
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
};
