import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';


function saveCachedUserName(contact, name) {
  if (!contact || !name) return;
  try {
    const raw = localStorage.getItem('ys_user_names');
    const map = raw ? JSON.parse(raw) : {};
    map[contact] = name;
    localStorage.setItem('ys_user_names', JSON.stringify(map));
  } catch {}
}


export function LoginForm({ busy, run, onUser, defaultRole = 'farmer', lang = 'en', setLang }) {
  const [googleClientId, setGoogleClientId] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [destination, setDestination] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [mode, setMode] = useState('login');
  const googleButton = useRef(null);

  useEffect(() => {
    api('/auth/config').then(c => setGoogleClientId(c.google_client_id || '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (challenge || !googleClientId) return;
    let cancelled = false;

    async function renderGis() {
      if (!window.google?.accounts?.id || !googleButton.current || cancelled) return;
      try {
        const { nonce } = await api('/auth/google/nonce', {});
        if (cancelled) return;
        window.google.accounts.id.initialize({
          nonce,
          client_id: googleClientId,
          callback: ({ credential }) =>
            run(async () => {
              const result = await api('/auth/google', { credential, role: defaultRole === 'owner' ? 'owner' : 'farmer', language: lang });
              if (result.challenge_id) {
                setMode('google');
                setDestination(result.email);
                acceptChallenge(result);
              } else {
                onUser(result);
              }
            }),
        });
        window.google.accounts.id.renderButton(googleButton.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 320,
        });
        setGoogleReady(true);
      } catch (err) {
        if (!cancelled) setGoogleError(err.message || 'Google Sign-In initialization failed.');
      }
    }

    if (window.google?.accounts?.id) {
      renderGis();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!cancelled) renderGis();
      };
      script.onerror = () => {
        if (!cancelled) setGoogleError('Google sign-in could not load.');
      };
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, challenge]);

  function acceptChallenge(result) {
    if (result?.delivery !== 'EMAIL_ACCEPTED' || !result.challenge_id || result.development_code) {
      throw new Error('A verification email could not be sent. Please try again.');
    }
    setChallenge(result);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <img src="/icon.svg" width="40" height="40" alt="" style={{ flexShrink: 0 }} />
        {setLang && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={15} style={{ color: '#566e4a' }} />
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                border: '1px solid #dce4d5',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                background: '#fff',
                color: '#28583e',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="pa">ਪੰਜਾਬੀ</option>
            </select>
          </div>
        )}
      </div>

      <h2>{challenge ? 'Verify your email' : mode === 'register' ? 'Create your account' : mode === 'reset' ? 'Set or reset password' : 'Welcome back'}</h2>
      <p>
        {challenge
          ? `Enter the 6-digit verification code sent to ${destination}.`
          : mode === 'login' ? 'Sign in with Google or your email and password.' : mode === 'reset' ? 'Verify your email to set a password for your existing account.' : 'Verify your email, then choose a password for future sign-ins.'}
      </p>

      {!challenge ? (
        <>
          {/* Google Sign-In Area */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px', width: '100%' }}>
              <div ref={googleButton} className="google-button" style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />
            </div>

            {googleClientId && !googleReady && !googleError && (
              <button
                type="button"
                className="outline full"
                onClick={() => {
                  if (window.google?.accounts?.id) {
                    window.google.accounts.id.prompt();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d9dfcf',
                  fontSize: '13px',
                  fontWeight: '500',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>
            )}
          </div>

          {googleError && <p role="alert" style={{ color: '#b91c1c', fontSize: '12px' }}>{googleError}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0', color: '#889482', fontSize: '10px', fontWeight: '600', letterSpacing: '0.8px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e3e8da' }} />
            <span>OR SIGN IN WITH EMAIL</span>
            <div style={{ flex: 1, height: '1px', background: '#e3e8da' }} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = new FormData(e.target).get('destination').trim();
              const password = new FormData(e.target).get('password');
              run(async () => {
                if (mode === 'login') {
                  onUser(await api('/auth/password/login', { email: val, password }));
                  return;
                }
                const result = await api('/auth/email/request', { email: val, action: mode });
                setDestination(val);
                acceptChallenge(result);
              });
            }}
          >
            <FormField label="Email address">
              <input
                name="destination"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="name@example.com"
                defaultValue={destination || ''}
              />
            </FormField>
            {mode === 'login' && <FormField label="Password"><input name="password" type="password" autoComplete="current-password" required maxLength={128} /></FormField>}
            <button className="primary full" disabled={busy}>
              {mode === 'login' ? 'Sign in to dashboard' : 'Send verification code'} <ArrowRight size={17} />
            </button>
          </form>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {mode !== 'login' && <button className="text-button" disabled={busy} onClick={() => setMode('login')}>Already registered? Sign in</button>}
            {mode !== 'register' && <button className="text-button" disabled={busy} onClick={() => setMode('register')}>Create account</button>}
            {mode !== 'reset' && <button className="text-button" disabled={busy} onClick={() => setMode('reset')}>Set or reset password</button>}
          </div>
          {mode === 'login' && <small>Previously used an email code? Choose Set or reset password once, then sign in here.</small>}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            run(async () => {
              if (mode !== 'google' && f.get('password') !== f.get('confirmPassword')) throw new Error('Passwords do not match.');
              const u = await api('/auth/email/verify', {
                challenge_id: challenge.challenge_id,
                code: f.get('code'),
                ...(mode !== 'google' ? { password: f.get('password') } : {}),
                ...(f.get('name') ? { name: f.get('name'), roles: f.getAll('roles') } : {}),
                language: lang,
                email: destination,
              });
              if (u?.name) saveCachedUserName(destination, u.name);
              onUser(u);
            });
          }}
        >
          <p className="banner">Check your inbox and spam folder. Your code expires in five minutes.</p>
          <FormField label="Verification code">
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              autoFocus
              placeholder="Enter 6-digit code"
              onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); }}
            />
          </FormField>
          {mode === 'register' && <><FormField label="Your name">
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Balwinder Singh"
            />
          </FormField>
          <fieldset>
            <legend>For new accounts, select your role(s):</legend>
            <small>Choose Farmer to rent or Owner to list equipment. Owner accounts cannot rent.</small>
            {[
              ['farmer', 'Rent equipment (Farmer)'],
              ['owner', 'List equipment (Owner)'],
              ['operator', 'Operate machinery (Operator)'],
              ['fpo', 'Manage FPO fleet (FPO)'],
            ].map(([role, label]) => (
              <label className="checkbox" key={role}>
                <input
                  type="checkbox"
                  name="roles"
                  value={role}
                  defaultChecked={role === defaultRole}
                  onChange={e => {
                    if (e.target.checked && (role === 'owner' || role === 'farmer')) {
                      const other = role === 'owner' ? 'farmer' : 'owner';
                      e.target.form.querySelector('input[name="roles"][value="' + other + '"]').checked = false;
                    }
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset></>}
          {mode !== 'google' && <>
            <FormField label="New password (at least 12 characters)"><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></FormField>
            <FormField label="Confirm password"><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></FormField>
          </>}
          <small>Existing registered profiles retain their saved details.</small>
          <button className="primary full" disabled={busy} style={{ marginTop: '14px' }}>
            Verify & Enter Dashboard <ArrowRight size={17} />
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setChallenge(null);
              setMode('login');
              setGoogleError('');
            }}
            style={{ marginTop: '12px' }}
          >
            ← Back to sign-in options
          </button>
        </form>
      )}
    </>
  );
}
