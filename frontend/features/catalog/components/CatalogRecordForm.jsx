import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { Button } from '../../../components/ui/Button';
import { label } from '../../../lib/format';
import { catalogResources } from '../config/catalogResources';
import { useCatalogForm } from '../hooks/useCatalogForm';
import { CatalogField } from './CatalogField';
export const CatalogRecordForm = ({ resource, initial, onClose, onSaved }) => {
    const [quickAccount, setQuickAccount] = useState(false);
    const editor = useCatalogForm({ resource, initial, onClose, onSaved });
    return (
        <Modal title={`${initial ? 'Edit' : 'Add'} ${label(resource.replace(/s$/, ''))}`} onClose={onClose}>
            <form onSubmit={editor.submit}>
                {editor.error && <ErrorBox error={editor.error} />}
                <div className="grid gap-4 sm:grid-cols-2">
                    {catalogResources[resource].fields.map((definition) => (
                        <CatalogField
                            key={definition[0]}
                            definition={definition}
                            value={editor.form[definition[0]]}
                            onChange={(value) => editor.set(definition[0], value)}
                            creating={!initial}
                            onQuickAccount={() => setQuickAccount(true)}
                        />
                    ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={editor.isLoading}>
                        {editor.isLoading ? 'Saving…' : 'Save record'}
                    </Button>
                </div>
            </form>
            {quickAccount && (
                <CatalogRecordForm
                    resource="accounts"
                    onClose={() => setQuickAccount(false)}
                    onSaved={(row) => editor.set('gl_account_id', String(row.id))}
                />
            )}
        </Modal>
    );
};
