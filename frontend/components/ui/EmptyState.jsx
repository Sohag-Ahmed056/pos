import { Search } from 'lucide-react';
export const Empty = ({ text = 'No records yet', detail = 'Your records will appear here as you work.' }) => {
    return (
        <div className="p-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-pine">
                <Search size={22} />
            </div>
            <p className="font-semibold text-ink">{text}</p>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
    );
};
