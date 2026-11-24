import { Field } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Loading } from '../../../components/ui/Loading';
import { Confirm } from '../../../components/ui/ConfirmDialog';
import { ResourceLookup } from '../../../components/data/ResourceLookup';
import { useJournalEditor } from '../hooks/useJournalEditor';
import { JournalLinesEditor } from './JournalLinesEditor';
export const JournalEditorDialog = ({ onClose }) => {
    const editor = useJournalEditor(onClose);
    return (
        <Modal title="Post a balanced journal" onClose={onClose} wide>
            {editor.error && <ErrorBox error={editor.error} />}{' '}
            {editor.isLoading ? (
                <Loading />
            ) : (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        editor.setConfirm(true);
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            title="GL date"
                            type="date"
                            required
                            value={editor.form.gl_date}
                            onChange={(value) => editor.setField('gl_date', value)}
                        />
                        <Field
                            title="Journal type"
                            required
                            options={['OPENING_BALANCE', 'ADJUSTMENT']}
                            value={editor.form.type}
                            onChange={(value) => editor.setField('type', value)}
                        />
                        <Field
                            title="Reference"
                            value={editor.form.reference_no}
                            onChange={(value) => editor.setField('reference_no', value)}
                        />
                        <Field
                            title="Reason"
                            required
                            value={editor.form.reason}
                            onChange={(value) => editor.setField('reason', value)}
                        />
                        <ResourceLookup
                            title="Customer for AR lines"
                            required={false}
                            resource="customers"
                            value={editor.customer}
                            onChange={editor.setCustomer}
                        />
                        <ResourceLookup
                            title="Supplier for AP lines"
                            required={false}
                            resource="suppliers"
                            value={editor.supplier}
                            onChange={editor.setSupplier}
                        />
                    </div>
                    <JournalLinesEditor
                        lines={editor.lines}
                        options={editor.options}
                        onChange={editor.updateLine}
                        onAdd={editor.addLine}
                        onRemove={editor.removeLine}
                        totals={editor.totals}
                    />
                    <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={editor.busy || !!editor.error}>
                            Review & post
                        </Button>
                    </div>
                </form>
            )}
            {editor.confirm && (
                <Confirm
                    title="Post this journal?"
                    description="The server will validate balanced amounts and account requirements before committing the entry."
                    onClose={() => editor.setConfirm(false)}
                    onConfirm={editor.submit}
                    busy={editor.busy}
                />
            )}
        </Modal>
    );
};
