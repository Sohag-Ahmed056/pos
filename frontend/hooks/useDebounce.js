import { useEffect, useState } from 'react';
export const useDebounce = (value) => {
    const [debounced, set] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => set(value), 300);
        return () => clearTimeout(timer);
    }, [value]);
    return debounced;
};
