import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { toast } from 'react-toastify';
import MerchantDashboard from '../../components/MerchantDashboard';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

export default function MerchantHomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to fetch Supabase session:', error);
        }
        setSession(data?.session ?? null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleGoogleSignIn = useCallback(async () => {
    if (!supabase) {
      toast.error('Supabase authentication is not configured.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/merchant` : undefined,
        },
      });
      if (error) {
        throw error;
      }
      toast.info('Redirecting to Google for sign-in…');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      const message = error?.message || 'Unable to start Google sign-in right now.';
      setAuthError(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  }, [supabase]);

  const handleSignOut = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      toast.info('Signed out of merchant session.');
    } catch (error) {
      console.error('Supabase sign-out failed:', error);
      toast.error(error?.message || 'Unable to sign out right now.');
    }
  }, [supabase]);

  return (
    <>
      <Head>
        <title>Merchant Dashboard · BrewToken Loyalty</title>
      </Head>
      <div className="min-h-screen bg-slate-950/96">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Merchant Portal</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Coffee Loyalty Operations Console</h1>
              <p className="mt-3 text-sm text-slate-300">
                View customer progress, redeem free drinks, and generate QR codes for BrewToken payments.
              </p>
            </div>
            {session ? (
              <div className="flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
                <span className="uppercase tracking-[0.3em]">Merchant</span>
                <span>{session.user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-emerald-200/40 px-3 py-1 font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-red-300 hover:text-red-200"
                  type="button"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </header>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-300 shadow-xl shadow-indigo-900/30 backdrop-blur-2xl">
              Checking merchant session…
            </div>
          ) : session ? (
            <MerchantDashboard session={session} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-slate-200 shadow-xl shadow-indigo-900/40 backdrop-blur-2xl">
              <h2 className="text-2xl font-semibold text-white">Sign in to continue</h2>
              <p className="mt-4 text-sm text-slate-300">
                Use Google authentication to access the BrewToken merchant console.
              </p>
              {authError ? <p className="mt-4 text-xs text-red-300">{authError}</p> : null}
              <button
                onClick={handleGoogleSignIn}
                disabled={authBusy}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-slate-900/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {authBusy ? 'Redirecting…' : 'Sign in with Google'}
              </button>
              <p className="mt-4 text-xs text-slate-400">
                Need onboarding? Ask the BrewToken deployer to invite your Google account.
              </p>
              <p className="mt-2 text-xs text-emerald-200">
                <Link href="/merchant/register" className="underline hover:text-emerald-100">
                  Register a merchant outlet →
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
