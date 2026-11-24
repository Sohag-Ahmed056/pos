import { ChevronRight, Menu } from 'lucide-react';
export const Topbar = ({ title, onOpenMenu }) => {
    const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(new Date());
    return (
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/95 px-5 backdrop-blur md:px-9">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="icon-button lg:hidden"
                    onClick={onOpenMenu}
                    aria-label="Open navigation"
                >
                    <Menu size={21} />
                </button>
                <span className="hidden text-xs text-slate-500 sm:inline">Workspace</span>
                <ChevronRight className="hidden text-slate-300 sm:block" size={13} />
                <span className="text-base font-semibold">{title || 'Workspace'}</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-pine sm:block">
                    ● Connected workspace
                </span>
                <span className="text-xs text-slate-500">{date}</span>
            </div>
        </header>
    );
};
