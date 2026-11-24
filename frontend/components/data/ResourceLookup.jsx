import { useState } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useGetEntityQuery, useListEntitiesQuery } from '../../services/entityApi';
import { ErrorBox } from '../ui/ErrorBox';
export const ResourceLookup = ({
    resource,
    value,
    onChange,
    title,
    required = true,
    filters = {},
    onQuickAdd
}) => {
    const [search, setSearch] = useState('');
    const debounced = useDebounce(search);
    const { data, isFetching, error } = useListEntitiesQuery({
        resource,
        filters: { limit: 30, search: debounced, ...filters }
    });
    const options = [...(data?.data || [])];
    const hasSelected = options.some((record) => String(record.id) === String(value));
    const { currentData: selected } = useGetEntityQuery(
        { resource, id: value },
        { skip: !value || hasSelected }
    );
    if (!hasSelected && selected?.data) options.unshift(selected.data);
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                    {title}
                    {required ? ' *' : ''}
                </span>
                {onQuickAdd && (
                    <button type="button" className="text-xs font-semibold text-pine" onClick={onQuickAdd}>
                        + Quick add
                    </button>
                )}
            </div>
            <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
                aria-label={`Search ${title}`}
                autoComplete="off"
            />
            <select
                aria-label={title}
                required={required}
                value={value || ''}
                onChange={(event) => {
                    const id = event.target.value;
                    onChange(
                        id,
                        options.find((record) => String(record.id) === id)
                    );
                }}
            >
                <option value="">{isFetching ? 'Searching…' : `Select ${title.toLowerCase()}`}</option>
                {options.map((record) => (
                    <option key={record.id} value={record.id}>
                        {record.sku ? `${record.sku} · ` : ''}
                        {record.name ||
                            record.invoice_no ||
                            record.purchase_no ||
                            record.grn_no ||
                            record.company_name}
                        {record.status ? ` · ${record.status}` : ''}
                    </option>
                ))}
            </select>
            {error && <ErrorBox error={error} />}
        </div>
    );
};
