import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { selectUser } from '../../features/auth/authSlice';
import { useAuthActions } from '../../features/auth/hooks/useAuthActions';
import { ChangePasswordDialog } from '../../features/auth/components/ChangePasswordDialog';
import { useToast } from '../../components/ui/ToastProvider';
import { errorText } from '../../lib/errors';
import { visibleNavigation } from '../navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
export const WorkspaceLayout = ({ children }) => {
    const user = useSelector(selectUser);
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const actions = useAuthActions();
    const toast = useToast();
    const sections = visibleNavigation(user.role);
    const current = sections
        .flatMap((section) => section.items)
        .find((item) => item.path === location.pathname);
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);
    const signOut = async () => {
        try {
            await actions.signOut();
        } catch (error) {
            toast(errorText(error), true);
        }
    };
    return (
        <div className="workspace-shell min-h-screen bg-canvas text-ink">
            <a href="#workspace-content" className="skip-link">
                Skip to main content
            </a>
            {open && (
                <button
                    type="button"
                    className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation"
                />
            )}
            <Sidebar
                user={user}
                sections={sections}
                open={open}
                onClose={() => setOpen(false)}
                onChangePassword={() => setPasswordOpen(true)}
                onSignOut={signOut}
                signingOut={actions.isSigningOut}
            />
            <div className="lg:ml-60">
                <Topbar title={current?.label} onOpenMenu={() => setOpen(true)} />
                <main id="workspace-content" className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
                    {children}
                </main>
                <footer className="px-9 pb-5 text-xs text-slate-500">
                    BatteryPOS · Amounts in BDT · Quantities in PCS
                </footer>
            </div>
            {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
        </div>
    );
};
