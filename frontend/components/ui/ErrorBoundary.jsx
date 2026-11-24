import { Component } from 'react';
export class ErrorBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError = () => {
        return { failed: true };
    };
    render = () => {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="mx-auto my-16 max-w-lg rounded-xl border bg-white p-8">
                <h1 className="text-xl">The workspace could not be displayed</h1>
                <p className="my-4 text-sm text-slate-600">Reload the page to reconnect and continue.</p>
                <button type="button" className="btn" onClick={() => window.location.reload()}>
                    Reload workspace
                </button>
            </div>
        );
    };
}
