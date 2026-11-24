import { useState } from 'react';
import { ResourceLookup } from '../../../components/data/ResourceLookup';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { productLedgerFileUrl } from '../productLedgerApi';

const types = ['OPENING', 'GRN', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUST_IN', 'ADJUST_OUT'];
export const ProductLedgerExports = ({ resource, id, filters }) => (
    <div className="flex flex-wrap gap-2" aria-label="Product ledger exports">
        {['print', 'pdf', 'xlsx'].map((format) => (
            <Button
                key={format}
                as="a"
                variant="secondary"
                href={productLedgerFileUrl(resource, id, filters, format)}
                {...(format === 'print' ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
                {format === 'print' ? 'Print report' : format === 'pdf' ? 'PDF export' : 'Excel export'}
            </Button>
        ))}
    </div>
);
export const ProductLedgerFilters = ({
    value,
    onApply,
    standalone = false,
    productSelected = false,
    busy = false
}) => {
    const [form, setForm] = useState(value);
    const set = (key) => (next) => setForm((previous) => ({ ...previous, [key]: next }));
    return (
        <form
            className="mb-5 rounded-xl border bg-white p-4"
            onSubmit={(event) => {
                event.preventDefault();
                onApply(form);
            }}
        >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {!productSelected && (
                    <ResourceLookup
                        resource="products"
                        title="Product or SKU"
                        value={form.product_id}
                        onChange={set('product_id')}
                        required={false}
                    />
                )}
                <Field
                    title="From date"
                    type="date"
                    value={form.from}
                    onChange={set('from')}
                    max={form.to || undefined}
                />
                <Field
                    title="To date"
                    type="date"
                    value={form.to}
                    onChange={set('to')}
                    min={form.from || undefined}
                />
                <Field
                    title="Invoice / PO / GRN / Return"
                    value={form.voucher}
                    onChange={set('voucher')}
                    maxLength={80}
                    placeholder="Voucher or original reference…"
                />
                {standalone && (
                    <>
                        <ResourceLookup
                            resource="warehouses"
                            title="Warehouse"
                            value={form.warehouse_id}
                            onChange={set('warehouse_id')}
                            required={false}
                        />
                        <ResourceLookup
                            resource="customers"
                            title="Customer"
                            value={form.customer_id}
                            onChange={set('customer_id')}
                            required={false}
                        />
                        <ResourceLookup
                            resource="suppliers"
                            title="Supplier"
                            value={form.supplier_id}
                            onChange={set('supplier_id')}
                            required={false}
                        />
                        <Field
                            title="Movement type"
                            value={form.type}
                            onChange={set('type')}
                            options={types}
                        />
                    </>
                )}
                <Field
                    title="Search transactions"
                    value={form.search}
                    onChange={set('search')}
                    maxLength={100}
                    placeholder="Product, SKU, voucher or party…"
                />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                    Leave dates empty for all history. Totals include every filtered page.
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                            setForm({});
                            onApply({});
                        }}
                    >
                        Reset
                    </Button>
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Loading…' : 'Apply filters'}
                    </Button>
                </div>
            </div>
        </form>
    );
};
