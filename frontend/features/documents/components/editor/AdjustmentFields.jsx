import { ResourceLookup } from '../../../../components/data/ResourceLookup';
import { Field } from '../../../../components/ui/Field';
export const AdjustmentFields = ({ form, onChange }) => {
    return (
        <>
            <ResourceLookup
                resource="products"
                title="Product"
                value={form.product_id}
                onChange={(value) => onChange('product_id', value)}
            />
            <Field
                title="Adjustment type"
                required
                options={['OPENING', 'INCREASE', 'DECREASE']}
                value={form.adjustment_type}
                onChange={(value) => onChange('adjustment_type', value)}
            />
            <Field
                title="Quantity · PCS"
                type="number"
                required
                min="1"
                step="1"
                value={form.quantity_pcs}
                onChange={(value) => onChange('quantity_pcs', value)}
            />
            <Field
                title="Unit cost · BDT"
                type="number"
                min="0"
                step="0.0001"
                required
                value={form.unit_cost}
                onChange={(value) => onChange('unit_cost', value)}
            />
            <Field
                title="Reason"
                required
                value={form.reason}
                onChange={(value) => onChange('reason', value)}
            />
        </>
    );
};
