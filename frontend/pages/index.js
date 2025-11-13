import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { toast } from 'react-toastify';
import WalletConnect from '../components/WalletConnect';
import CustomerDashboard from '../components/CustomerDashboard';
import MerchantDashboard from '../components/MerchantDashboard';
import TransactionHistory from '../components/TransactionHistory';
import { useWallet } from '../context/WalletContext';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';

export default function Home() {
  const { isOwner } = useWallet();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [activeTab, setActiveTab] = useState('menu');
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const tabs = useMemo(() => {
    const base = [
      { id: 'menu', label: 'Coffee Menu' },
      { id: 'history', label: 'History' },
    ];
    if (isOwner) {
      base.push({ id: 'merchant', label: 'Merchant' });
    }
    return base;
  }, [isOwner]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
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
        setAuthSession(data?.session ?? null);
      })
      .finally(() => {
        if (isMounted) {
          setAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setAuthSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'merchant' && !isOwner) {
      setActiveTab('menu');
    }
  }, [activeTab, isOwner]);

  const handleSignIn = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        toast.error('Supabase authentication is not configured.');
        return;
      }
      if (!email || !password) {
        setAuthError('Enter your merchant email and password.');
        return;
      }
      setAuthBusy(true);
      setAuthError('');
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          console.error('Supabase sign-in failed:', error);
          setAuthError(error.message);
          toast.error(error.message);
          return;
        }
        toast.success('Merchant session started.');
        setEmail('');
        setPassword('');
      } catch (error) {
        console.error('Unexpected Supabase auth error:', error);
        setAuthError(error?.message || 'Unable to sign in right now.');
        toast.error(error?.message || 'Unable to sign in right now.');
      } finally {
        setAuthBusy(false);
      }
    },
    [email, password, supabase]
  );

  const handleSignOut = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign-out failed:', error);
        toast.error(error.message || 'Unable to sign out');
        return;
      }
      toast.info('Signed out of merchant session.');
    } catch (error) {
      console.error('Unexpected Supabase sign-out error:', error);
      toast.error(error?.message || 'Unable to sign out');
    }
  }, [supabase]);

  const renderContent = () => {
    if (activeTab === 'menu') {
      return <CustomerDashboard />;
    }
    if (activeTab === 'history') {
      return <TransactionHistory />;
    }
    if (activeTab === 'merchant') {
      if (!isOwner) {
        return (
          <div className="py-16 text-center text-slate-300">
            Connect the CoffeeLoyalty owner wallet to manage merchant operations.
          </div>
        );
      }
      if (authLoading) {
        return <div className="py-16 text-center text-slate-300">Checking Supabase session…</div>;
      }
      if (!authSession) {
        return (
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-blue-900/40 backdrop-blur-2xl">
            <h2 className="text-2xl font-semibold text-white">Merchant Login</h2>
            <p className="mt-2 text-sm text-slate-300">
              Sign in with your Supabase merchant credentials to unlock the CoffeeLoyalty console.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-1 focus:ring-emerald-300/40"
                  placeholder="owner@brew.cafe"
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-1 focus:ring-emerald-300/40"
                  placeholder="••••••••"
                  required
                />
              </label>
              {authError ? (
                <p className="text-xs text-red-300">{authError}</p>
              ) : null}
              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <p className="mt-4 text-xs text-slate-400">
              Need access? Ask the BrewToken deployer to create a Supabase user for you.
            </p>
          </div>
        );
      }
      return <MerchantDashboard />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Head>
        <title>BrewToken Coffee Loyalty</title>
        <meta name="description" content="Coffee loyalty powered by BrewToken and CoffeeLoyalty smart contracts" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-white/40">BrewToken Coffee Loyalty</p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Order. Scan. Earn rewards.</h1>
            <p className="mt-1 text-sm text-slate-300">
              The coffee menu lives here—connect MetaMask to buy with BrewToken and watch stamps accrue instantly.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <WalletConnect />
            {authSession ? (
              <div className="flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
                <span className="uppercase tracking-[0.3em]">Merchant</span>
                <span>{authSession.user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-emerald-200/40 px-3 py-1 font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-red-300 hover:text-red-200"
                  type="button"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-xl shadow-indigo-900/20 backdrop-blur-2xl sm:justify-between sm:p-5">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.4em] text-white/50">Dashboard</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => {
              const disabled = tab.id === 'merchant' && !isOwner;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                      : 'border border-white/20 text-slate-300 hover:border-white/40 hover:text-white'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl sm:p-10">
          {renderContent()}
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/80 py-6 text-center text-xs text-slate-400 backdrop-blur">
        BrewToken Coffee Loyalty · Powered by CoffeeLoyalty + Supabase
      </footer>
    </div>
  );
}