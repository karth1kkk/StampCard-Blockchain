import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';

// Helper to get initials from name/email
const getInitials = (name) => {
  if (!name) return 'M';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Helper to get name from email
const getNameFromEmail = (email) => {
  if (!email) return 'Merchant';
  const name = email.split('@')[0];
  return name
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function LoginPage({ onAuthenticated }) {
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState('profile'); // 'profile' or 'code'
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch merchant profiles from Supabase Auth
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        console.log('Fetching merchant profiles...');
        const response = await fetch('/api/merchant/profiles');
        const data = await response.json();

        console.log('Profiles API response:', { status: response.status, data });

        if (response.ok && data.merchants) {
          // Map API response to profile format
          const apiProfiles = data.merchants.map((merchant) => ({
            id: merchant.id,
            email: merchant.email,
            name: merchant.name,
            loginCode: merchant.loginCode,
          }));
          console.log('Mapped profiles:', apiProfiles);
          setProfiles(apiProfiles);
        } else {
          console.warn('API returned error or no merchants:', data);
          // Fallback to local storage if API fails
          const storedProfiles = localStorage.getItem('merchant_profiles');
          if (storedProfiles) {
            const parsed = JSON.parse(storedProfiles);
            console.log('Using stored profiles from localStorage:', parsed);
            setProfiles(parsed);
          } else {
            console.warn('No profiles found in API or localStorage');
            setProfiles([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
        // Fallback to local storage on error
        const storedProfiles = localStorage.getItem('merchant_profiles');
        if (storedProfiles) {
          const parsed = JSON.parse(storedProfiles);
          console.log('Using stored profiles from localStorage (error fallback):', parsed);
          setProfiles(parsed);
        } else {
          console.warn('No profiles found after error');
          setProfiles([]);
        }
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleProfileSelect = useCallback(
    (profile) => {
      // Just select the profile and move to code entry
      // No email OTP needed - user will enter their 6-digit code directly
      setSelectedProfile(profile);
      setCode('');
      setError('');
      setStep('code');
    },
    []
  );


  const handleCodeSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        toast.error('Supabase authentication is not configured.');
        return;
      }
      if (!code || code.length !== 6) {
        setError('Enter a valid 6-digit code');
        return;
      }

      setLoading(true);
      setError('');

      try {
        // Verify 6-digit code
        const verifyResponse = await fetch('/api/merchant/code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'verify',
            email: selectedProfile.email,
            code: code,
          }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
          throw new Error(verifyData.error || 'Invalid code');
        }

        // Code verified - create session directly using Admin API
        const sessionResponse = await fetch('/api/merchant/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: selectedProfile.email,
            userId: verifyData.userId || selectedProfile.id,
          }),
        });

        const sessionResult = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(sessionResult.error || 'Failed to create session');
        }

        // Set session directly using tokens from Admin API
        if (sessionResult.accessToken && sessionResult.refreshToken) {
          // Set the session using the tokens
          const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: sessionResult.accessToken,
            refresh_token: sessionResult.refreshToken,
          });

          if (setSessionError || !sessionData?.session) {
            throw new Error('Failed to set session. Please try again.');
          }

          toast.success('Merchant session active.');
          setCode('');
          setStep('profile');
          setSelectedProfile(null);

          if (typeof onAuthenticated === 'function') {
            onAuthenticated(sessionData.session);
          }
        } else if (sessionResult.tokenHash) {
          // Fallback: Use token hash with verifyOtp to create session
          try {
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
              email: selectedProfile.email,
              token: sessionResult.tokenHash,
              type: 'magiclink',
            });

            if (verifyError || !verifyData?.session) {
              console.error('OTP verification error:', verifyError);
              // Last resort: try using the action link directly
              if (sessionResult.actionLink) {
                // Extract tokens from action link on frontend
                try {
                  const url = new URL(sessionResult.actionLink);
                  const hash = url.hash.substring(1);
                  const params = new URLSearchParams(hash);
                  const accessToken = params.get('access_token');
                  const refreshToken = params.get('refresh_token');
                  
                  if (accessToken && refreshToken) {
                    const { data: sessionData2, error: setSessionError2 } = await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    });

                    if (!setSessionError2 && sessionData2?.session) {
                      toast.success('Merchant session active.');
                      setCode('');
                      setStep('profile');
                      setSelectedProfile(null);

                      if (typeof onAuthenticated === 'function') {
                        onAuthenticated(sessionData2.session);
                      }
                      return;
                    }
                  }
                } catch (linkParseError) {
                  console.error('Error parsing action link on frontend:', linkParseError);
                }
              }
              throw new Error('Failed to verify session. Please try again.');
            }

            toast.success('Merchant session active.');
            setCode('');
            setStep('profile');
            setSelectedProfile(null);

            if (typeof onAuthenticated === 'function') {
              onAuthenticated(verifyData.session);
            }
          } catch (otpError) {
            console.error('OTP verification failed:', otpError);
            throw new Error('Session verification failed. Please try again.');
          }
        } else if (sessionResult.tokenHash) {
          // Try using the token hash with verifyOtp
          try {
            const { data: verifyData2, error: verifyError2 } = await supabase.auth.verifyOtp({
              email: selectedProfile.email,
              token: sessionResult.tokenHash,
              type: 'magiclink',
            });

            if (!verifyError2 && verifyData2?.session) {
              toast.success('Merchant session active.');
              setCode('');
              setStep('profile');
              setSelectedProfile(null);

              if (typeof onAuthenticated === 'function') {
                onAuthenticated(verifyData2.session);
              }
              return;
            }
          } catch (otpError2) {
            console.error('OTP verification with tokenHash failed:', otpError2);
          }
        }

        if (sessionResult.actionLink) {
          // Last resort: Navigate to the action link to complete sign-in
          // This will redirect and set the session automatically
          console.log('Redirecting to action link to complete sign-in');
          window.location.href = sessionResult.actionLink;
          return;
        }

        throw new Error('Failed to create session. Please try again.');
      } catch (authError) {
        console.error('Merchant sign-in failed:', authError);
        const message = authError?.message || 'Unable to sign in.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [code, selectedProfile, onAuthenticated, supabase]
  );

  const handleBack = useCallback(() => {
    setStep('profile');
    setCode('');
    setError('');
    setSelectedProfile(null);
  }, []);

  const handleCodeChange = useCallback((value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
  }, []);

  const handleRemoveProfile = useCallback(
    (email, event) => {
      event.stopPropagation();
      const updated = profiles.filter((p) => p.email !== email);
      setProfiles(updated);
      localStorage.setItem('merchant_profiles', JSON.stringify(updated));
      toast.success('Profile removed');
    },
    [profiles]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          {step === 'profile' ? (
            <>
              <div className="mb-8 text-center">
                <p className="text-xs uppercase tracking-[0.5em] text-emerald-200/80">BrewToken POS</p>
                <h1 className="mt-4 text-4xl font-semibold text-white">Select Your Profile</h1>
                <p className="mt-3 text-sm text-slate-300">
                  Choose your merchant account or add a new one
                </p>
              </div>

              {/* Loading State */}
              {loadingProfiles ? (
                <div className="mb-8 flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-300/30 border-t-emerald-400"></div>
                    <p className="text-sm text-slate-400">Loading profiles...</p>
                  </div>
                </div>
              ) : profiles.length > 0 ? (
                /* Profile Grid - Centered */
                <div className="mb-8 flex justify-center">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {profiles.map((profile) => (
                      <button
                        key={profile.email || profile.id}
                        onClick={() => handleProfileSelect(profile)}
                        disabled={loading}
                        className="group relative flex w-full max-w-[140px] flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition-all hover:border-emerald-300/50 hover:bg-white/[0.08] hover:shadow-lg hover:shadow-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="relative">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-lime-300 to-sky-300 text-xl font-bold text-slate-900 shadow-lg shadow-emerald-400/30 transition-transform group-hover:scale-110">
                            {getInitials(profile.name)}
                          </div>
                        </div>
                        <div className="w-full text-center">
                          <p className="truncate text-sm font-semibold text-white" title={profile.name}>
                            {profile.name}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-400" title={profile.email}>
                            {profile.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Empty State */
                <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center">
                  <p className="text-sm text-slate-400">
                    No merchant profiles found. Please register a merchant account first.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Make sure SUPABASE_SERVICE_ROLE_KEY is configured in your environment variables.
                  </p>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-slate-400">
                Don't have an account?{' '}
                <Link
                  href="/merchant/register"
                  className="font-semibold text-emerald-200 underline-offset-4 transition hover:text-emerald-100 hover:underline"
                >
                  Register now
                </Link>
              </p>
            </>
          ) : (
            <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.05] p-10 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="mb-8 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-lime-300 to-sky-300 text-2xl font-bold text-slate-900 shadow-lg shadow-emerald-400/30">
                  {selectedProfile ? getInitials(selectedProfile.name) : 'M'}
                </div>
                <h2 className="text-3xl font-semibold text-white">Enter Your Code</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedProfile && (
                    <>
                      Signed in as <span className="font-semibold text-emerald-200">{selectedProfile.name}</span>
                      <br />
                      <span className="text-xs text-slate-400">{selectedProfile.email}</span>
                    </>
                  )}
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleCodeSubmit}>
                <label className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  6-Digit Code
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center text-3xl font-mono tracking-[0.5em] text-white outline-none transition focus:border-emerald-300/70 focus:ring-1 focus:ring-emerald-300/50"
                    required
                    maxLength={6}
                    disabled={loading}
                    autoFocus
                  />
                </label>
                {error ? <p className="text-xs text-red-300">{error}</p> : null}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-400 via-lime-300 to-sky-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="w-full rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back to Profiles
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-400">
                Enter your 6-digit login code to sign in.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
