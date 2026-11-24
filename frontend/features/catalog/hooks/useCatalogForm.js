import { useState } from 'react';
import { useSaveCatalogRecordMutation } from '../catalogApi';
import { useIdempotentMutation } from '../../../hooks/useIdempotentMutation';
import { useToast } from '../../../components/ui/ToastProvider';
import { createCatalogDraft, catalogPayload } from '../model/catalogForm';
export const useCatalogForm = ({ resource, initial, onSaved, onClose }) => {
    const [form, setForm] = useState(() => createCatalogDraft(resource, initial));
    const [save, { isLoading }] = useIdempotentMutation(useSaveCatalogRecordMutation());
    const [error, setError] = useState(null);
    const toast = useToast();
    const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
    const submit = async (event) => {
        event.preventDefault();
        setError(null);
        try {
            const result = await save({ resource, id: initial?.id, values: catalogPayload(resource, form) });
            toast('Record saved');
            onSaved?.(result.data);
            onClose();
        } catch (failure) {
            setError(failure);
        }
    };
    return { form, set, submit, isLoading, error };
};
