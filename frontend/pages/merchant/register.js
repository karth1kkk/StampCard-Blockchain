import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

const SECRET_CODE = process.env.NEXT_PUBLIC_MERCHANT_SECRET || '31337';

export default function MerchantRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!name.trim() || !email.trim() || !password.trim() || !secret.trim() || !loginCode.trim()) {
        toast.error('Fill out all fields including the 6-digit login code.');
        return;
      }
      if (secret.trim() !== SECRET_CODE) {
        toast.error('Secret code is invalid.');
        return;
      }
      if (loginCode.trim().length !== 6 || !/^\d+$/.test(loginCode.trim())) {
        toast.error('Login code must be exactly 6 digits.');
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch('/api/merchant/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SECRET_CODE,
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            secret: secret.trim(),
            loginCode: loginCode.trim(),
          }),
        });

        if (!response.ok) {
          const { error } = await response.json();
          throw new Error(error || 'Registration failed.');
        }

        toast.success('Merchant account created. You can sign in now.');
        setTimeout(() => {
          router.push('/');
        }, 1200);
      } catch (error) {
        console.error('Merchant registration failed:', error);
        toast.error(error?.message || 'Merchant registration failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, name, password, router, secret, loginCode]
  );

  const handleLoginCodeChange = useCallback((value) => {
    // Only allow digits and limit to 6 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setLoginCode(digitsOnly);
  }, []);

  return (
    <>
      <Head>
        <title>Register Merchant · BrewToken Loyalty</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
      </Head>
      <div className="flex min-h-screen flex-col bg-slate-950 text-white lg:flex-row">
        <div className="flex flex-1 flex-col justify-between bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-indigo-600/10 px-10 py-12">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.5em] text-emerald-200/80">BrewToken POS</p>
            <h1 className="text-4xl font-semibold leading-snug text-white">
              Join the BrewToken network
            </h1>
            <p className="max-w-md text-sm text-emerald-100/80">
              Register your merchant account to start accepting BrewToken payments and managing customer loyalty rewards.
            </p>
          </div>
          <div className="hidden gap-6 rounded-3xl border border-white/10 bg-white/10 p-6 text-sm text-white/80 lg:flex">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Need help?</p>
              <p className="mt-2 text-sm text-white/90">
                Contact the BrewToken ops team for assistance with merchant account setup.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-3">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-10 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.45em] text-white/50">Merchant registration</p>
              <h2 className="text-3xl font-semibold text-white">Create your account</h2>
              <p className="text-sm text-slate-300">
                Enter your details and the shared secret to gain merchant access.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                Merchant Name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Coffee Crew"
                  autoComplete="name"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                  required
                />
              </label>
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
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                6-Digit Login Code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={loginCode}
                  onChange={(event) => handleLoginCodeChange(event.target.value)}
                  placeholder="000000"
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center text-xl font-mono tracking-[0.5em] text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                  required
                  maxLength={6}
                />
                <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Create your 6-digit login code. You'll use this to sign in to the POS system.
                </p>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                Secret Code
                <input
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="Enter code"
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Registering…' : 'Register Merchant'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <Link
                href="/"
                className="font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
