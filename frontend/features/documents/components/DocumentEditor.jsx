import { Check } from 'lucide-react';
import { useDocumentEditor } from '../hooks/useDocumentEditor';
import { hasProductLines, isPaymentDocument } from '../model/documentDraft';
import { CatalogRecordForm } from '../../catalog/components/CatalogRecordForm';
import { Modal } from '../../../components/ui/Modal';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Confirm } from '../../../components/ui/ConfirmDialog';
import { Button } from '../../../components/ui/Button';
import { DocumentHeaderFields } from './editor/DocumentHeaderFields';
import { ProductItemsEditor } from './editor/ProductItemsEditor';
import { InvoiceTotals } from './editor/InvoiceTotals';
import { SourceItemsTable } from './editor/SourceItemsTable';
import { PaymentAllocationsTable } from './editor/PaymentAllocationsTable';
export const DocumentEditor = ({ kind, initial, onClose }) => {
    const editor = useDocumentEditor({ kind, initial, onClose });
    const lines = hasProductLines(kind);
    return (
        <Modal
            title={`${initial?.id ? 'Edit' : 'New'} ${editor.config.singular.toLowerCase()}`}
            onClose={onClose}
            wide
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    if (event.nativeEvent.submitter?.value === 'post') editor.setConfirm(true);
                    else editor.save(false);
                }}
            >
                {editor.error && <ErrorBox error={editor.error} />}
                <DocumentHeaderFields
                    kind={kind}
                    form={editor.form}
                    onChange={editor.set}
                    onQuickAdd={editor.setQuick}
                    onSourceChange={editor.selectSource}
                />
                {lines && (
                    <>
                        <ProductItemsEditor
                            kind={kind}
                            items={editor.items}
                            productId={editor.productId}
                            onSelectProduct={editor.setProductId}
                            onAddProduct={editor.addProduct}
                            onQuickAdd={editor.setQuick}
                            onChange={editor.updateItem}
                            onRemove={editor.removeItem}
                        />
                        {editor.dueError && <ErrorBox error={editor.dueError} />}
                        <InvoiceTotals
                            dueLoading={editor.dueLoading}
                            sale={kind === 'sales'}
                            totals={editor.totals}
                            discount={editor.form.discount_amount}
                            onDiscount={(value) => editor.set('discount_amount', value)}
                            payment={editor.payment}
                            onPayment={editor.setPayment}
                        />
                    </>
                )}
                {editor.source.error && <ErrorBox error={editor.source.error} />}{' '}
                {editor.config.source && editor.source.data?.data && (
                    <SourceItemsTable kind={kind} items={editor.items} onChange={editor.updateItem} />
                )}{' '}
                {isPaymentDocument(kind) && editor.settlements.data?.data && (
                    <section className="mt-6">
                        <h3 className="font-semibold">Allocate payment</h3>
                        <p className="mb-3 mt-1 text-xs text-slate-500">
                            Optional. Customer amounts left unallocated remain available as an advance.
                        </p>
                        <PaymentAllocationsTable
                            rows={editor.settlements.data.data}
                            amounts={editor.allocations}
                            onChange={editor.setAllocation}
                        />
                    </section>
                )}{' '}
                {editor.settlements.error && <ErrorBox error={editor.settlements.error} />}
                <div className="mt-7 flex flex-wrap justify-end gap-3 border-t pt-5">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="secondary" value="draft" disabled={editor.busy}>
                        {editor.busy ? 'Saving…' : 'Save draft'}
                    </Button>
                    {editor.canPost && (
                        <Button
                            type="submit"
                            value="post"
                            disabled={
                                editor.busy ||
                                (lines && !editor.items.length) ||
                                (kind === 'sales' && !!editor.dueError)
                            }
                        >
                            <Check size={16} />
                            {kind === 'purchases' ? 'Save & confirm' : 'Save & post'}
                        </Button>
                    )}
                </div>
            </form>
            {editor.confirm && (
                <Confirm
                    title={kind === 'purchases' ? 'Confirm purchase?' : 'Post this transaction?'}
                    description={
                        kind === 'purchases'
                            ? 'This confirms the order. Stock will increase when goods are received.'
                            : 'Posting commits the financial and inventory changes. Corrections require an authorized return or reversal.'
                    }
                    busy={editor.busy}
                    onClose={() => editor.setConfirm(false)}
                    onConfirm={() => editor.save(true)}
                />
            )}{' '}
            {editor.quick && (
                <CatalogRecordForm
                    resource={editor.quick}
                    onClose={() => editor.setQuick(null)}
                    onSaved={editor.quickSaved}
                />
            )}
        </Modal>
    );
};
