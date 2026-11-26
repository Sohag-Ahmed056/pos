import { Field } from '../../../../components/ui/Field';
import { ResourceLookup } from '../../../../components/data/ResourceLookup';
import { money } from '../../../../lib/format';
const SummaryRow = ({ title, value, emphasis = false, loading = false }) => {
    return (
        <div className={`summary-line ${emphasis ? 'border-t pt-3 font-semibold' : ''}`}>
            <span>{title}</span>
            <span>{loading ? 'Loading…' : `৳ ${money(value)}`}</span>
        </div>
    );
};
export const InvoiceTotals = ({ sale, totals, discount, onDiscount, payment, onPayment, dueLoading }) => {
    return (
        <div className="ml-auto mt-5 max-w-sm space-y-3 rounded-lg bg-canvas p-5">
            <SummaryRow title="Subtotal after line discounts" value={totals.subtotal} />
            {sale && (
                <Field
                    title="Invoice discount · BDT"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={onDiscount}
                />
            )}
            <SummaryRow title={sale ? 'Current sale' : 'Purchase total'} value={totals.total} emphasis />
            {sale && (
                <>
                    <SummaryRow title="Previous due" value={totals.previous} loading={dueLoading} />
                    <SummaryRow title="Total payable" value={totals.payable} loading={dueLoading} />
                    <Field
                        title="Today’s payment · BDT"
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount}
                        onChange={(value) => onPayment({ ...payment, amount: value })}
                    />
                    {Number(payment.amount) > 0 && (
                        <div className="space-y-1.5">
                            <ResourceLookup
                                resource="payment-accounts"
                                title="Payment account"
                                required={false}
                                filters={{ active: true }}
                                value={payment.payment_account_id}
                                onChange={(value) => onPayment({ ...payment, payment_account_id: value })}
                            />
                            {!payment.payment_account_id && (
                                <p className="text-xs text-amber-800">
                                    Select a payment account to post this payment with the sale.
                                </p>
                            )}
                        </div>
                    )}
                    <SummaryRow title="Closing due" value={totals.closing} emphasis loading={dueLoading} />
                    <p className="text-[10px] text-slate-400">
                        Payment is collected when the sale is posted. Negative balances represent customer
                        advances.
                    </p>
                </>
            )}
        </div>
    );
};
