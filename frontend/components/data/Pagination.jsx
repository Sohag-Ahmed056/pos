import { ChevronLeft, ChevronRight } from 'lucide-react';
export const Pagination = ({ meta, page, onChange }) => {
    if (!meta) return null;
    return (
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4 text-xs text-slate-500">
            <span>
                {meta.total} records · Page {page} of {Math.max(meta.pages || 1, 1)}
            </span>
            <div className="flex gap-2">
                <button
                    className="icon-button"
                    disabled={page <= 1}
                    onClick={() => onChange(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    className="icon-button"
                    disabled={page >= meta.pages}
                    onClick={() => onChange(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};
