import React, { useEffect, useRef, useState } from 'react';
import { Sprout, ArrowRight, UserCheck, UserPlus, Phone, Mail } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function LoginForm({ busy, run, onUser, lang = 'en' }) {
  const [config, setConfig] = useState({ phone: true, email: 'development' });
  const [mode, setMode] = useState('phone'); // Phone OTP is primary & default
  const [challenge, setChallenge] = useState(null);
  const [destination, setDestination] = useState('');
  const [googleError, setGoogleError] = useState('');
  const googleButton = useRef(null);
  const t = (k, p) => translate(lang, k, p);

  useEffect(() => {
    run(async () => {
      try {
        const c = await api('/auth/config');
        if (c) setConfig(c);
      } catch (e) {
        // Fallback default allows offline / dev phone login
        setConfig({ phone: true, email: 'development' });
      }
    });
  }, []);

  useEffect(() => {
    if (!config?.google_client_id || challenge || mode !== 'email') return;
    let cancelled = false;
    let script;
    async function init() {
      try {
        const { nonce } = await api('/auth/google/nonce', {});
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: config.google_client_id,
          nonce,
          callback: ({ credential }) =>
            run(async () => {
              const result = await api('/auth/google', { credential });
              setDestination(result.email);
              setChallenge(result);
            }),
        });
        if (googleButton.current) {
          window.google.accounts.id.renderButton(googleButton.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
          });
        }
      } catch (e) {
        if (!cancelled) setGoogleError(e.message);
      }
    }
    if (window.google?.accounts) init();
    else {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = init;
      script.onerror = () => setGoogleError('Google sign-in could not load.');
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      script?.remove();
    };
  }, [config, challenge, mode]);

  return (
    <>
      <div className="brand-mark">
        <Sprout />
      </div>

      {/* Auth Method Selector (Phone primary, Email demo) */}
      {!challenge && (
        <div className="auth-methods" aria-label="Sign-in method" style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className={mode === 'phone' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('phone');
              setGoogleError('');
            }}
            style={{ flex: 1, padding: '9px 12px', fontSize: '12px' }}
          >
            <Phone size={15} style={{ marginRight: '6px' }} />
            {t('mobileNumber')} (OTP)
          </button>
          <button
            type="button"
            className={mode === 'email' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('email');
              setGoogleError('');
            }}
            style={{ flex: 1, padding: '9px 12px', fontSize: '12px' }}
          >
            <Mail size={15} style={{ marginRight: '6px' }} />
            Email (Demo)
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* PHONE AUTH FLOW (Primary with Sample OTP Simulation)          */}
      {/* ============================================================== */}
      {mode === 'phone' && (
        <>
          {!challenge ? (
            <>
              <h2>{t('welcomeTitle')}</h2>
              <p>{t('welcomeSub')}</p>
              <div className="banner">{t('devModeBanner')}</div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const phoneVal = new FormData(e.target).get('phone').trim();
                  setDestination(phoneVal);
                  run(async () => {
                    const res = await api('/auth/request', { phone: phoneVal });
                    setChallenge(res);
                  });
                }}
              >
                <FormField label={t('mobileNumber')}>
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="\+91[6-9][0-9]{9}"
                    placeholder="+919000000001"
                    defaultValue={destination || '+919000000001'}
                    autoComplete="tel"
                  />
                </FormField>
                <button className="primary full" disabled={busy}>
                  {t('getOtpBtn')} <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : !challenge.is_new_user ? (
            /* RETURNING USER: Direct OTP entry, recognized user account */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                  <UserCheck size={18} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Existing User Account Found
                </span>
              </div>

              <h2>{challenge.user_name ? t('welcomeBack', { name: challenge.user_name }) : t('welcomeBackTitle')}</h2>
              <p>{t('signInSubtitle')}</p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  run(async () =>
                    onUser(
                      await api('/auth/verify', {
                        challenge_id: challenge.challenge_id,
                        code: f.get('code'),
                        language: lang,
                      })
                    )
                  );
                }}
              >
                {challenge.development_code && (
                  <div className="dev-code">
                    {t('simulatedOtp')}: <strong>{challenge.development_code}</strong>
                    <small>{t('expiresIn')}</small>
                  </div>
                )}
                <FormField label={t('verificationCode')}>
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter 6-digit code"
                  />
                </FormField>
                <button className="primary full" disabled={busy}>
                  {t('sign')} <ArrowRight size={17} />
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setChallenge(null)}
                  style={{ marginTop: '12px' }}
                >
                  ← {t('requestNewCode')}
                </button>
              </form>
            </>
          ) : (
            /* NEW USER: First-time Sign Up with Name & Roles */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ background: '#fef3c7', color: '#b45309', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                  <UserPlus size={18} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  New Registration · {destination}
                </span>
              </div>

              <h2>{t('newAccountTitle')}</h2>
              <p>{t('newAccountSubtitle')}</p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  run(async () =>
                    onUser(
                      await api('/auth/verify', {
                        challenge_id: challenge.challenge_id,
                        code: f.get('code'),
                        name: f.get('name'),
                        roles: f.getAll('roles'),
                        language: lang,
                      })
                    )
                  );
                }}
              >
                {challenge.development_code && (
                  <div className="dev-code">
                    {t('simulatedOtp')}: <strong>{challenge.development_code}</strong>
                    <small>{t('expiresIn')}</small>
                  </div>
                )}
                <FormField label={t('verificationCode')}>
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter 6-digit code"
                  />
                </FormField>
                <FormField label={t('yourName')}>
                  <input
                    name="name"
                    minLength="2"
                    maxLength="80"
                    required
                    placeholder="e.g. Balwinder Singh"
                    autoComplete="name"
                  />
                </FormField>
                <fieldset>
                  <legend>{t('newAccountRoles')}</legend>
                  {[
                    ['farmer', t('roleFarmer')],
                    ['owner', t('roleOwner')],
                    ['operator', t('roleOperator')],
                    ['fpo', t('roleFpo')],
                  ].map(([role, label]) => (
                    <label className="checkbox" key={role}>
                      <input
                        type="checkbox"
                        name="roles"
                        value={role}
                        defaultChecked={role === 'farmer'}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <small>{t('roleNote')}</small>
                <button className="primary full" disabled={busy}>
                  {t('createAccountBtn')} <ArrowRight size={17} />
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setChallenge(null)}
                  style={{ marginTop: '12px' }}
                >
                  ← {t('requestNewCode')}
                </button>
              </form>
            </>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* EMAIL AUTH FLOW (Secondary Demo)                               */}
      {/* ============================================================== */}
      {mode === 'email' && (
        <>
          <h2>{challenge ? 'Verify your email code' : 'Email Sign-in (Demo)'}</h2>
          <p>
            {challenge
              ? `Enter the six-digit verification code sent for ${destination}.`
              : 'Sign in with an email address or Google account.'}
          </p>

          {!challenge ? (
            <>
              {config?.google_client_id && (
                <>
                  <div ref={googleButton} className="google-button" />
                  <p className="auth-hint">Google sign-in is followed by email verification code.</p>
                </>
              )}
              {googleError && <p role="alert" style={{ color: '#b91c1c' }}>{googleError}</p>}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = new FormData(e.target).get('destination').trim();
                  run(async () => {
                    const result = await api('/auth/email/request', { email: val });
                    setDestination(val);
                    setChallenge(result);
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
                    placeholder="you@gmail.com"
                  />
                </FormField>
                <div className="banner">
                  Email demo mode: verification codes are delivered or simulated.
                </div>
                <button className="primary full" disabled={busy}>
                  Send verification code <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                run(async () =>
                  onUser(
                    await api('/auth/email/verify', {
                      challenge_id: challenge.challenge_id,
                      code: f.get('code'),
                      ...(f.get('name') ? { name: f.get('name'), roles: f.getAll('roles') } : {}),
                      language: lang,
                    })
                  )
                );
              }}
            >
              {challenge.development_code ? (
                <div className="dev-code">
                  Simulation code: <strong>{challenge.development_code}</strong>
                  <small>Expires in 5 minutes</small>
                </div>
              ) : (
                <div className="banner">
                  Code sent to {destination}. Check your inbox or spam folder.
                </div>
              )}
              <FormField label="Verification code">
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </FormField>
              <FormField label="Your name (for new account registration)">
                <input
                  name="name"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </FormField>
              <fieldset>
                <legend>For new accounts, I want to</legend>
                {[
                  ['farmer', 'Rent equipment'],
                  ['owner', 'List equipment'],
                  ['operator', 'Work as an operator'],
                  ['fpo', 'Manage an FPO'],
                ].map(([role, label]) => (
                  <label className="checkbox" key={role}>
                    <input
                      type="checkbox"
                      name="roles"
                      value={role}
                      defaultChecked={role === 'farmer'}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <small>Existing accounts retain their saved profile details.</small>
              <button className="primary full" disabled={busy}>
                Verify & Sign In <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setChallenge(null);
                  setGoogleError('');
                }}
                style={{ marginTop: '12px' }}
              >
                ← Back to sign-in options
              </button>
            </form>
          )}
        </>
      )}
    </>
  );
}
