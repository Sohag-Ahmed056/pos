import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export const Modal = ({ title, children, onClose, wide = false }) => {
    const ref = useRef();
    const titleId = useId();
    useEffect(() => {
        const old = document.activeElement;
        const dialog = ref.current;
        if (!dialog.open) dialog.showModal();
        return () => {
            dialog.close();
            old?.focus();
        };
    }, []);
    return (
        <dialog
            aria-labelledby={titleId}
            ref={ref}
            className={`modal ${wide ? 'max-w-4xl' : 'max-w-xl'}`}
            onCancel={onClose}
        >
            <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 id={titleId} className="text-lg font-semibold">
                    {title}
                </h2>
                <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
                    <X size={20} />
                </button>
            </div>
            <div className="p-6">{children}</div>
        </dialog>
    );
};
