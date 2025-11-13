import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

export default function LoginPage({ onAuthenticated }) {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        toast.error('Supabase authentication is not configured.');
        return;
      }
      if (!email || !password) {
        setError('Enter your merchant email and password.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
        toast.success('Merchant session active.');
        setEmail('');
        setPassword('');
        if (typeof onAuthenticated === 'function') {
          onAuthenticated(data.session);
        }
      } catch (authError) {
        console.error('Merchant sign-in failed:', authError);
        const message = authError?.message || 'Unable to sign in.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [email, password, onAuthenticated, supabase]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white lg:flex-row">
      <div className="flex flex-1 flex-col justify-between bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-indigo-600/10 px-10 py-12">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.5em] text-emerald-200/80">BrewToken POS</p>
          <h1 className="text-4xl font-semibold leading-snug text-white">
            Pour faster. Reward smarter.
          </h1>
          <p className="max-w-md text-sm text-emerald-100/80">
            Accept BrewToken payments, issue loyalty stamps, and reward your customers all in one modern, touch-friendly POS experience.
          </p>
        </div>
        <div className="hidden gap-6 rounded-3xl border border-white/10 bg-white/10 p-6 text-sm text-white/80 lg:flex">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Need access?</p>
            <p className="mt-2 text-sm text-white/90">
              Ask the BrewToken ops team to provision your merchant account or invite your Google Workspace email.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-10 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.45em] text-white/50">Merchant login</p>
            <h2 className="text-3xl font-semibold text-white">Sign in to start pouring</h2>
            <p className="text-sm text-slate-300">
              Sessions expire after 2 minutes of inactivity for security.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="merchant@brewtoken.cafe"
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                required
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                required
              />
            </label>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Don’t have an account yet?{' '}
            <Link
              href="/merchant/register"
              className="font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
            >
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


