import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { toast } from 'react-toastify';
import LoginPage from '../components/pos/LoginPage';
import POSDashboard from '../components/pos/POSDashboard';
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser';

export default function POSHome() {
  const [supabase, setSupabase] = useState(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setSupabase(getSupabaseBrowserClient());
    setSupabaseReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) {
      if (supabaseReady) {
        setLoading(false);
      }
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
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
  }, [supabase, supabaseReady]);

  const handleAuthenticated = useCallback((nextSession) => {
    setSession(nextSession);
  }, []);

  const handleSignOut = useCallback(async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      toast.info('Merchant signed out');
      setSession(null);
    } catch (error) {
      console.error('Supabase sign-out failed:', error);
      toast.error(error?.message || 'Unable to sign out right now.');
    }
  }, [supabase]);

  const handleSessionExpired = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Auto sign-out failed:', error);
    } finally {
      setSession(null);
    }
  }, [supabase]);

  if (!supabaseReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Preparing BrewToken POS…</h1>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-semibold">Supabase not configured</h1>
          <p className="text-sm text-slate-300">
            Add the Supabase environment variables to `.env.local` to enable merchant authentication.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white">
        Preparing BrewToken POS…
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>BrewToken POS</title>
      </Head>
      {session ? (
        <POSDashboard session={session} onSignOut={handleSignOut} onSessionExpired={handleSessionExpired} />
      ) : (
        <LoginPage onAuthenticated={handleAuthenticated} />
      )}
    </>
  );
}