import { LoaderCircle } from 'lucide-react';
export const Loading = () => {
    return (
        <div className="flex items-center justify-center gap-3 p-12 text-slate-500" role="status">
            <LoaderCircle className="animate-spin" size={20} /> Loading…
        </div>
    );
};
