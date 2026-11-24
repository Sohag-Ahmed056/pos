import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/ToastProvider';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { store } from './store';
export const AppProviders = ({ children }) => {
    return (
        <ErrorBoundary>
            <Provider store={store}>
                <BrowserRouter>
                    <ToastProvider>{children}</ToastProvider>
                </BrowserRouter>
            </Provider>
        </ErrorBoundary>
    );
};
