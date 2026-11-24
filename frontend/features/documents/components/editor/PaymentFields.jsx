import { ResourceLookup as Lookup } from '../../../../components/data/ResourceLookup';
import { Field } from '../../../../components/ui/Field';
export const PaymentFields = ({ form, set, kind }) => {
    return (
        <>
            <Lookup
                title="Payment account"
                resource="payment-accounts"
                value={form.payment_account_id}
                onChange={(v) => set('payment_account_id', v)}
                filters={{ active: true }}
            />
            <Field
                title="Amount · BDT"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(v) => set('amount', v)}
            />
            {kind !== 'expenses' && (
                <>
                    <Field
                        title="Reference"
                        value={form.reference_no}
                        onChange={(v) => set('reference_no', v)}
                    />
                    <Field title="Bank name" value={form.bank_name} onChange={(v) => set('bank_name', v)} />
                    <Field
                        title="Cheque number"
                        value={form.cheque_number}
                        onChange={(v) => set('cheque_number', v)}
                    />
                </>
            )}
        </>
    );
};
