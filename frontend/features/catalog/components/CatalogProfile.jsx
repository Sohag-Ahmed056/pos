import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Button } from '../../../components/ui/Button';
import { DateRangeFilter } from '../../../components/data/DateRangeFilter';
import { DocumentDetailDialog } from '../../documents/components/DocumentDetailDialog';
import { canReadDocument } from '../../auth/permissions';
import { money, label } from '../../../lib/format';
import { useCatalogProfile } from '../hooks/useCatalogProfile';
import { ProfileHistoryTable } from './ProfileHistoryTable';
import { ProfileFinancialLedger } from './ProfileFinancialLedger';
import { ProductLedgerReport } from '../../reports/components/ProductLedgerReport';
export const CatalogProfile = ({ resource, row, onClose }) => {
    const profile = useCatalogProfile(resource, row.id);
    const [view, setView] = useState(null);
    const [tab, setTab] = useState('information');
    const product = resource === 'products';
    const type = profile.historyType;
    const columns = product
        ? type === 'movements'
            ? ['movement_type', 'warehouse', 'quantity_delta_pcs', 'unit_cost', 'occurred_at']
            : [
                  'document_no',
                  type === 'sales' ? 'invoice_date' : 'purchase_date',
                  'quantity_pcs',
                  type === 'sales' ? 'unit_price' : 'unit_cost',
                  'line_amount',
                  'status'
              ]
        : resource === 'customers'
          ? ['invoice_no', 'invoice_date', 'total_amount', 'status']
          : ['purchase_no', 'purchase_date', 'status'];
    const onView = {
        canView: (record) => record.document_id && canReadDocument(record.document_resource, profile.role),
        open: (record) => setView({ kind: record.document_resource, id: record.document_id })
    };
    return (
        <Modal title={row.name} onClose={onClose} wide>
            {!product && (
                <div
                    className="mb-6 flex flex-wrap gap-2 border-b pb-4"
                    role="tablist"
                    aria-label="Profile sections"
                >
                    {[
                        ['information', 'Information'],
                        ['financial', 'Financial Ledger'],
                        [
                            'products',
                            resource === 'customers'
                                ? 'Product-wise Sales Ledger'
                                : 'Product-wise Purchase Ledger'
                        ],
                        ['transactions', resource === 'customers' ? 'Invoice History' : 'Purchase History'],
                        ...(profile.canViewPayments ? [['payments', 'Payment History']] : [])
                    ].map(([key, title]) => (
                        <Button
                            key={key}
                            role="tab"
                            aria-selected={tab === key}
                            variant={tab === key ? 'primary' : 'secondary'}
                            onClick={() => setTab(key)}
                        >
                            {title}
                        </Button>
                    ))}
                </div>
            )}
            {!product && tab === 'financial' && <ProfileFinancialLedger party={profile.party} id={row.id} />}
            {!product && tab === 'products' && <ProductLedgerReport resource={resource} id={row.id} />}
            {(product || tab === 'information') && (
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    {Object.entries(row)
                        .filter(([key, value]) => value !== null && !['id', 'created_at'].includes(key))
                        .map(([key, value]) => (
                            <div key={key}>
                                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                    {label(key)}
                                </p>
                                <p className="mt-1 text-sm">{String(value)}</p>
                            </div>
                        ))}
                </div>
            )}
            {!product && tab === 'information' && (
                <div className="mb-6 flex items-center justify-between rounded-lg bg-canvas p-4">
                    <div>
                        <p className="text-xs text-slate-500">Current journal balance</p>
                        {profile.balance.error ? (
                            <ErrorBox error={profile.balance.error} />
                        ) : (
                            <p className="mt-1 text-xl font-semibold">
                                {profile.balance.isFetching
                                    ? 'Loading…'
                                    : `৳ ${money(profile.balance.currentData?.data?.rows?.[0]?.balance)}`}
                            </p>
                        )}
                    </div>
                    <Link
                        onClick={onClose}
                        className="btn-secondary"
                        to={`/reports?report=${profile.party}-ledger&${profile.party}_id=${row.id}`}
                    >
                        Open ledger
                    </Link>
                </div>
            )}
            {(product || ['transactions', 'payments'].includes(tab)) && (
                <DateRangeFilter value={profile.period} onApply={profile.setPeriod} optional />
            )}
            {product && (
                <Link
                    className="btn-secondary mb-4 inline-flex"
                    to={`/inventory/product-ledger?product_id=${row.id}`}
                    onClick={onClose}
                >
                    Open professional Product Ledger
                </Link>
            )}
            {product && (
                <div className="mt-5 flex flex-wrap gap-2" aria-label="Product history type">
                    {['movements', 'purchases', 'sales']
                        .filter((kind) => kind === 'movements' || canReadDocument(kind, profile.role))
                        .map((kind) => (
                            <Button
                                key={kind}
                                variant={kind === type ? 'primary' : 'secondary'}
                                onClick={() => profile.setHistoryType(kind)}
                            >
                                {label(kind)}
                            </Button>
                        ))}
                </div>
            )}
            {(product || tab === 'transactions') && (
                <ProfileHistoryTable
                    title={product ? `${label(type)} history` : 'Transaction history'}
                    query={profile.history}
                    columns={columns}
                    page={profile.page}
                    setPage={profile.setPage}
                    search={profile.search}
                    setSearch={profile.setSearch}
                    onView={onView}
                />
            )}
            {profile.canViewPayments && tab === 'payments' && (
                <ProfileHistoryTable
                    title="Payment history"
                    query={profile.payments}
                    columns={[
                        'voucher_no',
                        resource === 'customers' ? 'receipt_date' : 'payment_date',
                        'amount',
                        'status'
                    ]}
                    page={profile.paymentPage}
                    setPage={profile.setPaymentPage}
                    search={profile.paymentSearch}
                    setSearch={profile.setPaymentSearch}
                    onView={{
                        canView: () => true,
                        open: (record) => setView({ kind: profile.paymentResource, id: record.id })
                    }}
                />
            )}
            {view && <DocumentDetailDialog kind={view.kind} id={view.id} onClose={() => setView(null)} />}
        </Modal>
    );
};
