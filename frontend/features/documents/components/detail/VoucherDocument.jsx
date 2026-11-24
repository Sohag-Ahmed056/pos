import { DataTable } from '../../../../components/data/DataTable';
import { money, label } from '../../../../lib/format';
import { documentTypes } from '../../config/documentTypes';
export const VoucherDocument = ({ kind, document: d, company, party, warehouse }) => {
    const config = documentTypes[kind];
    return (
        <div className="print-document">
            <div className="mb-6 flex items-start justify-between border-b pb-5">
                <div>
                    <h2 className="text-xl font-semibold">{company?.company_name || 'BatteryPOS'}</h2>
                    <p className="mt-1 text-xs text-slate-500">{company?.address}</p>
                    <h3 className="mt-4 text-lg">{config.singular}</h3>
                    <p className="mt-2 text-sm font-medium">{party?.name}</p>
                    <p className="text-xs text-slate-500">
                        {party?.phone} {party?.address}
                    </p>
                </div>
                <div className="text-right text-xs leading-6">
                    <p>{d[config.number]}</p>
                    <p>{d[config.date]}</p>
                    <p>{d.status}</p>
                </div>
            </div>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                {kind === 'purchases' ? (
                    <>
                        <div>
                            <p className="text-xs text-slate-500">Supplier invoice reference</p>
                            <p>{d.supplier_invoice_no || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Warehouse</p>
                            <p>{warehouse?.name || '—'}</p>
                        </div>
                        {d.notes && (
                            <div>
                                <p className="text-xs text-slate-500">Notes</p>
                                <p>{d.notes}</p>
                            </div>
                        )}
                    </>
                ) : (
                    Object.entries(d)
                        .filter(
                            ([k, v]) =>
                                v !== null &&
                                typeof v !== 'object' &&
                                !['id', 'posted_at', config.number, config.date, 'status'].includes(k)
                        )
                        .map(([k, v]) => (
                            <div key={k}>
                                <p className="text-[10px] uppercase text-slate-400">{label(k)}</p>
                                <p className="mt-1 text-sm">{String(v)}</p>
                            </div>
                        ))
                )}
            </div>
            {d.items?.length > 0 && (
                <DataTable
                    rows={d.items}
                    columns={
                        kind === 'purchases'
                            ? [
                                  { key: 'sku_snapshot', title: 'SKU' },
                                  { key: 'product_name_snapshot', title: 'Product' },
                                  { key: 'quantity_pcs', title: 'Ordered PCS' },
                                  { key: 'unit_cost', title: 'Unit cost' },
                                  { key: 'discount_amount', title: 'Discount', render: money },
                                  { key: 'line_amount', title: 'Amount', render: money },
                                  { key: 'received_pcs', title: 'Received PCS' },
                                  { key: 'remaining_pcs', title: 'Pending PCS' }
                              ]
                            : Object.keys(d.items[0]).filter(
                                  (k) =>
                                      ![
                                          'id',
                                          'purchase_id',
                                          'sales_invoice_id',
                                          'goods_receipt_id',
                                          'receipt_id',
                                          'payment_id',
                                          'sales_return_id',
                                          'purchase_return_id',
                                          'return_basis_amount',
                                          'return_unit_rate'
                                      ].includes(k)
                              )
                    }
                />
            )}{' '}
            {kind === 'purchases' && (
                <div className="ml-auto mt-6 max-w-sm space-y-3 rounded-lg border p-4">
                    <div className="summary-line">
                        <span>Subtotal</span>
                        <span>৳ {money(d.subtotal_amount)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Line discounts</span>
                        <span>৳ {money(d.discount_amount)}</span>
                    </div>
                    <div className="summary-line border-t pt-3 font-semibold">
                        <span>Purchase total</span>
                        <span>৳ {money(d.total_amount)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Ordered PCS</span>
                        <span>{d.ordered_pcs}</span>
                    </div>
                    <div className="summary-line">
                        <span>Received PCS</span>
                        <span>{d.received_pcs}</span>
                    </div>
                    <div className="summary-line">
                        <span>Pending PCS</span>
                        <span>{d.remaining_pcs}</span>
                    </div>
                </div>
            )}
            {kind === 'sales' && (
                <div className="ml-auto mt-6 max-w-xs space-y-3 rounded-lg border p-4">
                    <div className="summary-line">
                        <span>Previous due at posting</span>
                        <span>{money(d.previous_due_snapshot)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Current sale</span>
                        <span>{money(d.total_amount)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Today’s payment at posting</span>
                        <span>{money(d.today_payment_snapshot)}</span>
                    </div>
                    <div className="summary-line border-t pt-3 font-semibold">
                        <span>Closing due at posting</span>
                        <span>৳ {money(d.closing_due_snapshot)}</span>
                    </div>
                    <div className="summary-line border-t pt-3">
                        <span>Current invoice outstanding</span>
                        <span>৳ {money(d.invoice_outstanding)}</span>
                    </div>
                </div>
            )}
            <p className="mt-6 text-xs text-slate-400">Amounts in BDT · Individual products in whole PCS</p>
        </div>
    );
};
