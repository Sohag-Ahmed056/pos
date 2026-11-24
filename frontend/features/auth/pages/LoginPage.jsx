import { Zap } from 'lucide-react';
import { Field } from '../../../components/ui/Field';
import { ErrorBox } from '../../../components/ui/ErrorBox';
import { useLoginForm } from '../hooks/useLoginForm';
const LoginPage = () => {
    const { email, setEmail, password, setPassword, error, isLoading, submit } = useLoginForm();
    return (
        <div className="flex min-h-screen bg-ink">
            <div className="hidden w-1/2 flex-col justify-between p-14 text-white lg:flex">
                <div className="flex items-center gap-3 text-xl font-bold">
                    <Zap className="text-emerald-300" />
                    Battery<span className="font-normal text-emerald-300">POS</span>
                </div>
                <div>
                    <span className="mb-6 inline-block rounded-full border border-white/20 px-3 py-1 text-xs text-emerald-200">
                        YOUR BUSINESS, CONNECTED
                    </span>
                    <h1 className="max-w-lg text-5xl font-semibold leading-tight">
                        A clear view of
                        <br />
                        every transaction.
                    </h1>
                    <p className="mt-6 max-w-sm leading-7 text-slate-300">
                        Keep sales, inventory, purchases, and accounts working together in one practical
                        workspace.
                    </p>
                </div>
                <p className="text-sm text-slate-400">Built for the way your business works.</p>
            </div>
            <main className="flex flex-1 items-center justify-center bg-canvas p-6">
                <form
                    onSubmit={submit}
                    className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-9"
                >
                    <div className="mb-10 flex items-center gap-2 font-bold text-pine lg:hidden">
                        <Zap />
                        BatteryPOS
                    </div>
                    <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
                    <p className="mb-8 mt-2 text-sm text-slate-500">Sign in to your business workspace.</p>
                    {error && <ErrorBox error={error} />}
                    <div className="space-y-5">
                        <Field
                            title="Email address"
                            type="email"
                            value={email}
                            onChange={setEmail}
                            autoComplete="username"
                            required
                        />
                        <Field
                            title="Password"
                            type="password"
                            value={password}
                            onChange={setPassword}
                            autoComplete="current-password"
                            required
                        />
                        <button className="btn w-full justify-center py-3" disabled={isLoading}>
                            {isLoading ? 'Signing in…' : 'Sign in to workspace'}
                        </button>
                    </div>
                    <p className="mt-6 text-xs leading-5 text-slate-400">
                        Use the credentials provided by your administrator.
                    </p>
                </form>
            </main>
        </div>
    );
};

export default LoginPage;
