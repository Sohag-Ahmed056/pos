import { ResourceLookup } from '../../../../components/data/ResourceLookup';
import { Field } from '../../../../components/ui/Field';
import { hasProductLines, isPaymentDocument } from '../../model/documentDraft';
import { documentTypes } from '../../config/documentTypes';
import { PaymentFields } from './PaymentFields';
import { AdjustmentFields } from './AdjustmentFields';
export const DocumentHeaderFields = ({ kind, form, onChange, onQuickAdd, onSourceChange }) => {
    const config = documentTypes[kind];
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
                title="Transaction date"
                type="date"
                required
                value={form[config.date]}
                onChange={(value) => onChange(config.date, value)}
            />
            {config.party && (
                <ResourceLookup
                    resource={config.partyResource}
                    title={config.partyResource === 'customers' ? 'Customer' : 'Supplier'}
                    value={form[config.party]}
                    onChange={(value) => onChange(config.party, value)}
                    onQuickAdd={() => onQuickAdd(config.partyResource)}
                />
            )}{' '}
            {(hasProductLines(kind) || kind === 'adjustments') && (
                <ResourceLookup
                    resource="warehouses"
                    title="Warehouse"
                    value={form.warehouse_id}
                    onChange={(value) => onChange('warehouse_id', value)}
                />
            )}{' '}
            {config.source && (
                <ResourceLookup
                    resource={config.sourceResource}
                    title={
                        kind === 'grns'
                            ? 'Confirmed purchase'
                            : kind === 'sales-returns'
                              ? 'Original invoice'
                              : 'Posted goods receipt'
                    }
                    filters={{ status: kind === 'grns' ? 'CONFIRMED' : 'POSTED' }}
                    value={form[config.source]}
                    onChange={onSourceChange}
                />
            )}{' '}
            {kind === 'purchases' && (
                <>
                    <Field
                        title="Supplier invoice number"
                        value={form.supplier_invoice_no}
                        onChange={(value) => onChange('supplier_invoice_no', value)}
                    />
                    <Field title="Notes" value={form.notes} onChange={(value) => onChange('notes', value)} />
                </>
            )}{' '}
            {(isPaymentDocument(kind) || kind === 'expenses') && (
                <PaymentFields kind={kind} form={form} set={onChange} />
            )}{' '}
            {kind === 'expenses' && (
                <>
                    <Field
                        title="Expense name"
                        required
                        value={form.expense_name}
                        onChange={(value) => onChange('expense_name', value)}
                    />
                    <Field title="Notes" value={form.notes} onChange={(value) => onChange('notes', value)} />
                </>
            )}{' '}
            {kind === 'adjustments' && <AdjustmentFields form={form} onChange={onChange} />}
        </div>
    );
};
