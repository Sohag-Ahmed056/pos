import { useState } from 'react';
import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useToast } from '../../../components/ui/ToastProvider';
import { useIdempotentMutation } from '../../../hooks/useIdempotentMutation';
import { today } from '../../../lib/format';
import { useReverseJournalMutation } from '../accountingApi';
export const JournalReversalDialog = ({ id, onClose }) => {
    const [date, setDate] = useState(today()),
        [reason, setReason] = useState(''),
        [error, setError] = useState(null);
    const [reverse, { isLoading }] = useIdempotentMutation(useReverseJournalMutation());
    const toast = useToast();
    const submit = async (event) => {
        event.preventDefault();
        setError(null);
        try {
            await reverse({ id, values: { gl_date: date, reason } });
            toast('Reversal posted');
            onClose();
        } catch (failure) {
            setError(failure);
        }
    };
    return (
        <Modal title={`Reverse journal ${id}`} onClose={onClose}>
            <form className="space-y-4" onSubmit={submit}>
                {error && <ErrorBox error={error} />}
                <Field title="Reversal date" type="date" value={date} onChange={setDate} required />
                <Field title="Reason" value={reason} onChange={setReason} required />
                <Button type="submit" disabled={isLoading}>
                    Post reversal
                </Button>
            </form>
        </Modal>
    );
};
