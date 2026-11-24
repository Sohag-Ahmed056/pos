import { createContext, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';
const Toast = createContext(() => {});
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(() => setToast(null), 5500);
        return () => clearTimeout(id);
    }, [toast]);
    return (
        <Toast.Provider value={(text, error = false) => setToast({ text, error })}>
            {children}
            {toast && (
                <div role="status" className={`toast ${toast.error ? 'bg-red-900' : 'bg-ink'}`}>
                    {toast.text}
                    <button onClick={() => setToast(null)} aria-label="Dismiss notification">
                        <X size={16} />
                    </button>
                </div>
            )}
        </Toast.Provider>
    );
};
export const useToast = () => useContext(Toast);
