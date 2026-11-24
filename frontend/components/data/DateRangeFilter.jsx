import { useEffect, useState } from 'react';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
export const DateRangeFilter = ({ value, onApply, busy = false, optional = false, timezone }) => {
    const [form, setForm] = useState(value);
    useEffect(() => setForm(value), [value.from, value.to]);
    const invalid = !!form.from && !!form.to && form.from > form.to;
    return (
        <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                if (!invalid) onApply(form);
            }}
        >
            <Field
                title={`From date${timezone ? ` (${timezone})` : ''}`}
                type="date"
                required={!optional}
                value={form.from}
                max={form.to || undefined}
                onChange={(from) => setForm({ ...form, from })}
            />
            <Field
                title={`To date${timezone ? ` (${timezone})` : ''}`}
                type="date"
                required={!optional}
                value={form.to}
                min={form.from || undefined}
                onChange={(to) => setForm({ ...form, to })}
            />
            <Button type="submit" variant="secondary" className="h-10" disabled={busy || invalid}>
                {busy ? 'Updating…' : 'Apply dates'}
            </Button>
            {invalid && (
                <p role="alert" className="text-xs text-red-700">
                    Choose an end date on or after the start date.
                </p>
            )}
        </form>
    );
};
