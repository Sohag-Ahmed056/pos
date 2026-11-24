import { useSession } from '../features/auth/hooks/useSession';
import LoginPage from '../features/auth/pages/LoginPage';
import { Loading } from '../components/ui/Loading';
import { ErrorBox } from '../components/ui/ErrorBox';
import { WorkspaceLayout } from './layout/WorkspaceLayout';
import { AppRouter } from './AppRouter';
const App = () => {
    const { user, isLoading, error } = useSession();
    if (isLoading && !user) return <Loading />;
    if (!user)
        return (
            <>
                {error && error.status !== 401 && <ErrorBox error={error} />}
                <LoginPage />
            </>
        );
    return (
        <WorkspaceLayout>
            <AppRouter />
        </WorkspaceLayout>
    );
};

export default App;
