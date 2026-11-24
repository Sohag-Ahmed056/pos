import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useToast } from '../../../components/ui/ToastProvider';
import { useAuthActions } from '../hooks/useAuthActions';
export const ChangePasswordDialog = ({ onClose }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState(null);
    const actions = useAuthActions();
    const toast = useToast();
    const submit = async (event) => {
        event.preventDefault();
        setError(null);
        try {
            await actions.changePassword({ oldPassword, newPassword });
            toast('Password changed. Please sign in again.');
            onClose();
        } catch (failure) {
            setError(failure);
        }
    };
    return (
        <Modal title="Change password" onClose={onClose}>
            <form className="space-y-5" onSubmit={submit}>
                {error && <ErrorBox error={error} />}
                <Field
                    title="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={oldPassword}
                    onChange={setOldPassword}
                    required
                />
                <Field
                    title="New password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={newPassword}
                    onChange={setNewPassword}
                    required
                />
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={actions.isChangingPassword}>
                        Change password
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
