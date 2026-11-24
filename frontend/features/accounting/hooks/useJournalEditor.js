import { useState } from 'react';
import { useListCatalogQuery } from '../../catalog/catalogApi';
import { usePostJournalMutation } from '../accountingApi';
import { useIdempotentMutation } from '../../../hooks/useIdempotentMutation';
import { useToast } from '../../../components/ui/ToastProvider';
import { today } from '../../../lib/format';
import { emptyJournalLine, journalPayload, journalTotals } from '../model/journalDraft';
export const useJournalEditor = (onClose) => {
    const accounts = useListCatalogQuery({ resource: 'accounts', filters: { limit: 100 } });
    const [form, setForm] = useState({
        gl_date: today(),
        type: 'OPENING_BALANCE',
        reason: '',
        reference_no: ''
    });
    const [lines, setLines] = useState(() => [emptyJournalLine(), emptyJournalLine()]);
    const [customer, setCustomer] = useState(''),
        [supplier, setSupplier] = useState(''),
        [confirm, setConfirm] = useState(false),
        [error, setError] = useState(null);
    const [post, { isLoading }] = useIdempotentMutation(usePostJournalMutation());
    const toast = useToast();
    const options = (accounts.data?.data || [])
        .filter((account) => account.code !== 'INVENTORY')
        .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` }));
    const updateLine = (index, key, value) =>
        setLines((previous) => previous.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
    const submit = async () => {
        setError(null);
        try {
            await post({
                values: journalPayload({
                    form,
                    lines,
                    accounts: accounts.data?.data || [],
                    customer,
                    supplier
                })
            });
            toast('Balanced journal posted');
            onClose();
        } catch (failure) {
            setError(failure);
            setConfirm(false);
        }
    };
    return {
        form,
        setField: (key, value) => setForm((previous) => ({ ...previous, [key]: value })),
        lines,
        updateLine,
        addLine: () => setLines((previous) => [...previous, emptyJournalLine()]),
        removeLine: (index) => setLines((previous) => previous.filter((_, i) => i !== index)),
        customer,
        setCustomer,
        supplier,
        setSupplier,
        confirm,
        setConfirm,
        error: error || accounts.error,
        isLoading: accounts.isLoading,
        busy: isLoading,
        options,
        totals: journalTotals(lines),
        submit
    };
};
