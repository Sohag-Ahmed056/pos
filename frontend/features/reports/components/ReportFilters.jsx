import { Filter } from 'lucide-react';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { ResourceLookup } from '../../../components/data/ResourceLookup';
import { isPartyLedger } from '../model/reportFilters';
export const ReportFilters = ({ report, options, form, onChange, onReportChange, onSubmit, busy }) => {
    const supplier = report === 'supplier-ledger' || report.startsWith('supplier');
    const field = supplier ? 'supplier_id' : 'customer_id';
    return (
        <form className="panel mb-6 p-5" onSubmit={onSubmit}>
            <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field
                    title="Report"
                    required
                    options={options.map(([value, title]) => ({ value, label: title }))}
                    value={report}
                    onChange={onReportChange}
                />
                <Field
                    title="From date"
                    type="date"
                    value={form.from}
                    onChange={(value) => onChange('from', value)}
                />
                <Field
                    title="To date"
                    type="date"
                    value={form.to}
                    onChange={(value) => onChange('to', value)}
                />
                <Button type="submit" className="h-10 justify-center" disabled={busy}>
                    <Filter size={15} />
                    {busy ? 'Loading…' : 'Apply filters'}
                </Button>
                {(isPartyLedger(report) || report.includes('outstanding')) && (
                    <ResourceLookup
                        resource={supplier ? 'suppliers' : 'customers'}
                        title={supplier ? 'Supplier' : 'Customer'}
                        required={false}
                        value={form[field]}
                        onChange={(value) => onChange(field, value)}
                    />
                )}{' '}
                {report === 'customer-ledger' && (
                    <>
                        <Field
                            title="Party group"
                            value={form.party}
                            onChange={(value) => onChange('party', value)}
                        />
                        <Field title="Area" value={form.area} onChange={(value) => onChange('area', value)} />
                        <Field
                            title="Sales channel"
                            value={form.channel}
                            onChange={(value) => onChange('channel', value)}
                        />
                    </>
                )}{' '}
                {report === 'expenses' && (
                    <>
                        <Field
                            title="Expense name"
                            value={form.expense_name}
                            onChange={(value) => onChange('expense_name', value)}
                        />
                        <ResourceLookup
                            resource="payment-accounts"
                            title="Payment account"
                            required={false}
                            value={form.payment_account_id}
                            onChange={(value) => onChange('payment_account_id', value)}
                        />
                    </>
                )}
                {report === 'general-ledger' && (
                    <ResourceLookup
                        resource="accounts"
                        title="GL account"
                        required={false}
                        value={form.account_id}
                        onChange={(value) => onChange('account_id', value)}
                    />
                )}
                {report === 'cash-bank' && (
                    <ResourceLookup
                        resource="payment-accounts"
                        title="Payment account"
                        required={false}
                        value={form.payment_account_id}
                        onChange={(value) => onChange('payment_account_id', value)}
                    />
                )}
                {['stock', 'valuation', 'low-stock', 'stock-movements'].includes(report) && (
                    <>
                        <ResourceLookup
                            resource="products"
                            title="Product"
                            required={false}
                            value={form.product_id}
                            onChange={(value) => onChange('product_id', value)}
                        />
                        <ResourceLookup
                            resource="warehouses"
                            title="Warehouse"
                            required={false}
                            value={form.warehouse_id}
                            onChange={(value) => onChange('warehouse_id', value)}
                        />
                    </>
                )}
            </div>
        </form>
    );
};
