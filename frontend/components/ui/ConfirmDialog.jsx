import { Modal } from './Modal';
export const Confirm = ({ title, description, onConfirm, onClose, busy }) => {
    return (
        <Modal title={title} onClose={onClose}>
            <p className="text-sm leading-relaxed text-slate-600">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
                <button className="btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button className="btn" onClick={onConfirm} disabled={busy}>
                    {busy ? 'Working…' : 'Confirm'}
                </button>
            </div>
        </Modal>
    );
};
