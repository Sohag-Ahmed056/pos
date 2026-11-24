import { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { selectRole } from '../features/auth/authSlice';
import { catalogResources } from '../features/catalog/config/catalogResources';
import { documentTypes } from '../features/documents/config/documentTypes';
import { Loading } from '../components/ui/Loading';
import { ErrorBox } from '../components/ui/ErrorBox';
import { homeForRole, routeRoles } from './navigation';
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const CatalogPage = lazy(() => import('../features/catalog/pages/CatalogPage'));
const DocumentsPage = lazy(() => import('../features/documents/pages/DocumentsPage'));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage'));
const ProductLedgerPage = lazy(() => import('../features/reports/pages/ProductLedgerPage'));
const AccountingPage = lazy(() => import('../features/accounting/pages/AccountingPage'));
const AuditPage = lazy(() => import('../features/audit/pages/AuditPage'));
const RequireRole = ({ roles, children }) => {
    const role = useSelector(selectRole);
    return roles.includes(role) ? children : <Navigate to={homeForRole(role)} replace />;
};
const CatalogRoute = () => {
    const { resource } = useParams();
    if (!Object.hasOwn(catalogResources, resource))
        return <ErrorBox error={{ message: 'Unknown directory module' }} />;
    const roles = resource === 'accounts' ? ['ADMIN', 'ACCOUNTANT'] : routeRoles(`/masters/${resource}`);
    return (
        <RequireRole roles={roles}>
            <CatalogPage key={resource} resource={resource} />
        </RequireRole>
    );
};
const DocumentsRoute = () => {
    const { kind } = useParams();
    if (!Object.hasOwn(documentTypes, kind))
        return <ErrorBox error={{ message: 'Unknown document module' }} />;
    return (
        <RequireRole roles={routeRoles(`/documents/${kind}`)}>
            <DocumentsPage key={kind} kind={kind} />
        </RequireRole>
    );
};
export const AppRouter = () => {
    const role = useSelector(selectRole);
    return (
        <Suspense fallback={<Loading />}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <RequireRole roles={routeRoles('/')}>
                            <DashboardPage />
                        </RequireRole>
                    }
                />
                <Route path="/masters/:resource" element={<CatalogRoute />} />
                <Route path="/documents/:kind" element={<DocumentsRoute />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route
                    path="/inventory/product-ledger"
                    element={
                        <RequireRole roles={routeRoles('/inventory/product-ledger')}>
                            <ProductLedgerPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/audit"
                    element={
                        <RequireRole roles={routeRoles('/audit')}>
                            <AuditPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/accounting"
                    element={
                        <RequireRole roles={routeRoles('/accounting')}>
                            <AccountingPage />
                        </RequireRole>
                    }
                />
                <Route path="*" element={<Navigate to={homeForRole(role)} replace />} />
            </Routes>
        </Suspense>
    );
};
