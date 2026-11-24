import { NavLink } from 'react-router-dom';
import { LogOut, X, Zap } from 'lucide-react';
export const Sidebar = ({ user, sections, open, onClose, onChangePassword, onSignOut, signingOut }) => {
    return (
        <aside
            className={`sidebar ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
            aria-label="Workspace navigation"
        >
            <div className="flex h-20 items-center gap-2.5 px-6 text-lg font-bold">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-300 text-ink">
                    <Zap size={22} />
                </div>
                Battery<span className="-ml-1 font-normal text-emerald-300">POS</span>
                <button
                    type="button"
                    className="ml-auto lg:hidden"
                    onClick={onClose}
                    aria-label="Close navigation"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="mx-4 mb-5 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-xs text-emerald-100">WORKSPACE</p>
                <p className="mt-1 text-sm font-medium">Business operations</p>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-5">
                {sections.map((section) => (
                    <div key={section.title}>
                        <p className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-widest text-emerald-100/80">
                            {section.title}
                        </p>
                        {section.items.map(({ label, path, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                end={path === '/'}
                                className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
                            >
                                <Icon size={17} strokeWidth={1.7} />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>
            <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                        {user.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={onChangePassword}>
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="text-xs capitalize text-emerald-100/80">{user.role.toLowerCase()}</p>
                    </button>
                    <button
                        type="button"
                        aria-label="Sign out"
                        className="p-2 text-emerald-100 hover:text-white"
                        onClick={onSignOut}
                        disabled={signingOut}
                    >
                        <LogOut size={17} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
