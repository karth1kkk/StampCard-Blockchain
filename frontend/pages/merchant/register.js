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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!name.trim() || !email.trim() || !password.trim() || !secret.trim()) {
        toast.error('Fill out name, email, password, and secret code.');
        return;
      }
      if (secret.trim() !== SECRET_CODE) {
        toast.error('Secret code is invalid.');
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
    [email, name, password, router, secret]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Head>
        <title>Register Merchant · BrewToken Loyalty</title>
      </Head>

      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16 sm:px-6 lg:px-8">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-purple-200">Merchant Registration</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Create Merchant Account</h1>
          <p className="mt-3 text-sm text-slate-300">
            Enter your basic details and the shared secret to gain merchant access.
          </p>
        </header>

        <form
          className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-2xl shadow-indigo-900/30 backdrop-blur-2xl"
          onSubmit={handleSubmit}
        >
          <SimpleField
            label="Merchant Name"
            placeholder="Coffee Crew"
            value={name}
            onChange={setName}
            autoComplete="name"
          />

          <SimpleField
            label="Email"
            type="email"
            placeholder="merchant@brewtoken.cafe"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />

          <SimpleField
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />

          <SimpleField
            label="Secret Code"
            type="password"
            placeholder="Enter code"
            value={secret}
            onChange={setSecret}
            autoComplete="off"
            hint={`Hint: default secret is ${SECRET_CODE}. Update MERCHANT_REGISTRATION_SECRET to rotate this code.`}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Registering…' : 'Register Merchant'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Already invited? Return to the{' '}
          <Link href="/" className="text-emerald-200 underline hover:text-emerald-100">
            merchant sign-in
          </Link>{' '}
          to log in.
        </p>
      </main>
    </div>
  );
}

function SimpleField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  hint,
}) {
  return (
    <label className="block text-left text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/60 focus:ring-1 focus:ring-emerald-300/40"
      />
      {hint ? <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">{hint}</p> : null}
    </label>
  );
}

