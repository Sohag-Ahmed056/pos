import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetAuditHistoryQuery } from '../auditApi';
const fields = ['search', 'from', 'to', 'user_id', 'action', 'entity'];
export const useAuditHistory = () => {
    const [params, setParams] = useSearchParams();
    const values = Object.fromEntries(fields.map((field) => [field, params.get(field) || '']));
    const [form, setForm] = useState(values);
    const location = params.toString();
    useEffect(
        () => setForm(Object.fromEntries(fields.map((field) => [field, params.get(field) || '']))),
        [location]
    );
    const page = Math.max(Number(params.get('page')) || 1, 1);
    const query = useGetAuditHistoryQuery({ ...values, page, limit: 20 });
    return {
        ...query,
        data: query.currentData,
        form,
        page,
        set: (field, value) => setForm((previous) => ({ ...previous, [field]: value })),
        apply: () => setParams(Object.fromEntries(Object.entries(form).filter(([, value]) => value))),
        reset: () => setParams({}),
        setPage: (value) => setParams({ ...Object.fromEntries(params), page: String(value) })
    };
};
