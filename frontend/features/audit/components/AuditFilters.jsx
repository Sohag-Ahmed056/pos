import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
export const AuditFilters = ({ form, set, onApply, onReset, busy }) => {
    return (
        <form
            className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
                event.preventDefault();
                onApply();
            }}
        >
            <Field
                title="Search user, action, or record"
                value={form.search}
                maxLength={180}
                onChange={(value) => set('search', value)}
            />
            <Field
                title="From date (UTC)"
                type="date"
                value={form.from}
                max={form.to || undefined}
                onChange={(value) => set('from', value)}
            />
            <Field
                title="To date (UTC)"
                type="date"
                value={form.to}
                min={form.from || undefined}
                onChange={(value) => set('to', value)}
            />
            <Field
                title="User ID"
                value={form.user_id}
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                onChange={(value) => set('user_id', value)}
            />
            <Field
                title="Exact action"
                value={form.action}
                maxLength={100}
                placeholder="e.g. sales.post"
                onChange={(value) => set('action', value)}
            />
            <Field
                title="Exact record type"
                value={form.entity}
                maxLength={100}
                placeholder="e.g. users"
                onChange={(value) => set('entity', value)}
            />
            <div className="flex items-end gap-2">
                <Button type="submit" disabled={busy}>
                    Apply filters
                </Button>
                <Button variant="secondary" onClick={onReset}>
                    Clear
                </Button>
            </div>
        </form>
    );
};
