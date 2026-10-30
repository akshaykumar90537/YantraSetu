import React, { useEffect, useRef, useState } from 'react';
import { Sprout, ArrowRight, UserCheck, UserPlus, Phone, Mail, AlertCircle, Info, Globe } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

function getCachedUserName(contact) {
  if (!contact) return '';
  try {
    const raw = localStorage.getItem('ys_user_names');
    if (raw) {
      const map = JSON.parse(raw);
      if (map[contact]) return map[contact];
    }
  } catch {}
  try {
    const rawDb = localStorage.getItem('ys_demo_users_db');
    if (rawDb) {
      const db = JSON.parse(rawDb);
      if (db[contact]?.name) return db[contact].name;
    }
  } catch {}
  if (contact === '+919000000002') return 'Harpreet Singh (Owner)';
  return '';
}

function saveCachedUserName(contact, name) {
  if (!contact || !name) return;
  try {
    const raw = localStorage.getItem('ys_user_names');
    const map = raw ? JSON.parse(raw) : {};
    map[contact] = name;
    localStorage.setItem('ys_user_names', JSON.stringify(map));
  } catch {}
}

export function LoginForm({ busy, run, onUser, lang = 'en', setLang }) {
  const [config, setConfig] = useState({ phone: true, email: 'development' });
  const [mode, setMode] = useState('phone'); // User can toggle between Phone and Email
  const [challenge, setChallenge] = useState(null);
  const [destination, setDestination] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const [rawPhone, setRawPhone] = useState('9000000001');
  const [phoneError, setPhoneError] = useState('');
  const googleButton = useRef(null);
  const t = (k, p) => translate(lang, k, p);

  useEffect(() => {
    run(async () => {
      try {
        const c = await api('/auth/config');
        if (c) setConfig(c);
      } catch (e) {
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
            width: 320,
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

  // Restrict mobile number input to numbers only (0-9), max 10 digits
  const handlePhoneKeyDown = (e) => {
    const allowed = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) {
      return;
    }
    // Block special characters, alphabets, punctuation
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      setPhoneError('Letters and special characters are not allowed. Only digits 0-9.');
    }
  };

  const handlePhoneChange = (e) => {
    // Strip everything that is not a numeric digit
    let digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 10) {
      digits = digits.slice(0, 10);
    }
    setRawPhone(digits);

    if (digits.length > 0 && !['6', '7', '8', '9'].includes(digits[0])) {
      setPhoneError('Indian mobile number must start with 6, 7, 8, or 9.');
    } else if (digits.length > 0 && digits.length < 10) {
      setPhoneError('Enter all 10 digits.');
    } else {
      setPhoneError('');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="brand-mark">
          <Sprout />
        </div>
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

      {/* Auth Method Selector */}
      {!challenge && (
        <div className="auth-methods" aria-label="Sign-in method" style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className={mode === 'phone' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('phone');
              setGoogleError('');
              setShowGoogleGuide(false);
              setPhoneError('');
            }}
            style={{ flex: 1, padding: '9px 12px', fontSize: '12px' }}
          >
            <Phone size={15} style={{ marginRight: '6px' }} />
            {lang === 'hi' ? 'मोबाइल (OTP)' : lang === 'pa' ? 'ਮੋਬਾਈਲ (OTP)' : 'Mobile (OTP)'}
          </button>
          <button
            type="button"
            className={mode === 'email' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('email');
              setGoogleError('');
              setShowGoogleGuide(false);
              setPhoneError('');
            }}
            style={{ flex: 1, padding: '9px 12px', fontSize: '12px' }}
          >
            <Mail size={15} style={{ marginRight: '6px' }} />
            {lang === 'hi' ? 'ईमेल' : lang === 'pa' ? 'ਈਮੇਲ' : 'Email'}
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* PHONE AUTH FLOW                                                */}
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
                  if (!rawPhone || rawPhone.length !== 10) {
                    setPhoneError('Please enter a complete 10-digit mobile number.');
                    return;
                  }
                  if (!['6', '7', '8', '9'].includes(rawPhone[0])) {
                    setPhoneError('Indian mobile number must start with 6, 7, 8, or 9.');
                    return;
                  }
                  const fullPhone = '+91' + rawPhone;
                  setDestination(fullPhone);
                  run(async () => {
                    const res = await api('/auth/request', { phone: fullPhone });
                    const knownName = res?.user_name || getCachedUserName(fullPhone) || '';
                    setChallenge({ ...res, user_name: knownName });
                  });
                }}
              >
                <FormField label={t('mobileNumber')}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div
                      style={{
                        background: '#edf2e7',
                        border: '1px solid #d9dfcf',
                        borderRadius: '6px',
                        padding: '11px 12px',
                        fontWeight: '600',
                        color: '#28583e',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <input
                      name="phoneDigits"
                      type="tel"
                      inputMode="numeric"
                      required
                      maxLength={10}
                      value={rawPhone}
                      onChange={handlePhoneChange}
                      onKeyDown={handlePhoneKeyDown}
                      placeholder="9000000001"
                      autoComplete="tel-national"
                      style={{ flex: 1 }}
                    />
                  </div>
                </FormField>

                {phoneError && (
                  <p role="alert" style={{ color: '#b91c1c', fontSize: '11px', margin: '-10px 0 12px' }}>
                    {phoneError}
                  </p>
                )}

                <button className="primary full" disabled={busy || rawPhone.length !== 10 || !['6','7','8','9'].includes(rawPhone[0])}>
                  {t('getOtpBtn')} <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : !challenge.is_new_user ? (
            /* RETURNING USER */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                  <UserCheck size={16} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                  {(() => {
                    const userName = challenge.user_name || getCachedUserName(destination);
                    return userName ? t('welcomeBack', { name: userName }) : `${t('welcomeBackTitle')}!`;
                  })()}
                </span>
              </div>
              <h2>{t('enterOtpTitle')}</h2>
              <p style={{ marginBottom: '14px' }}>
                {t('codeSentTo')} <strong>{destination}</strong>
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  run(async () => {
                    const u = await api('/auth/verify', {
                      challenge_id: challenge.challenge_id,
                      code: f.get('code'),
                      phone: destination,
                    });
                    if (u?.name) saveCachedUserName(destination, u.name);
                    onUser(u);
                  });
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
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter 6-digit code"
                    onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); }}
                  />
                </FormField>
                <button className="primary full" disabled={busy}>
                  {t('verifyAndEnterBtn')} <ArrowRight size={17} />
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
            /* NEW USER */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                  <UserPlus size={16} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>
                  {t('newAccountSetup')}
                </span>
              </div>
              <h2>{t('completeProfileTitle')}</h2>
              <p style={{ marginBottom: '14px' }}>
                {t('codeSentTo')} <strong>{destination}</strong>
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  run(async () => {
                    const u = await api('/auth/verify', {
                      challenge_id: challenge.challenge_id,
                      code: f.get('code'),
                      name: f.get('name'),
                      roles: f.getAll('roles'),
                      language: lang,
                      phone: destination,
                    });
                    if (u?.name) saveCachedUserName(destination, u.name);
                    onUser(u);
                  });
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
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter 6-digit code"
                    onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); }}
                  />
                </FormField>
                <FormField label={t('yourName')}>
                  <input
                    name="name"
                    minLength={2}
                    maxLength={80}
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
                <button className="primary full" disabled={busy} style={{ marginTop: '14px' }}>
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
      {/* EMAIL & GOOGLE AUTH FLOW                                       */}
      {/* ============================================================== */}
      {mode === 'email' && (
        <>
          <h2>{challenge ? 'Verify your code' : 'Sign in with Email'}</h2>
          <p>
            {challenge
              ? `Enter the 6-digit verification code sent to ${destination}.`
              : 'Sign in with your Google account or receive an OTP in your email.'}
          </p>

          {!challenge ? (
            <>
              {/* Google Sign-In Area */}
              <div style={{ marginBottom: '14px' }}>
                {config?.google_client_id ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div ref={googleButton} className="google-button" />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="outline full"
                    onClick={() => setShowGoogleGuide(!showGoogleGuide)}
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

                {showGoogleGuide && (
                  <div className="banner" style={{ marginTop: '10px', fontSize: '11px', lineHeight: '1.6' }}>
                    <Info size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Google Sign-In configuration required:</strong>
                      <p style={{ margin: '4px 0 0' }}>
                        Set <code>GOOGLE_CLIENT_ID</code> in your <code>.env</code> file to enable Google authentication.
                      </p>
                    </div>
                  </div>
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
                  run(async () => {
                    const result = await api('/auth/email/request', { email: val });
                    const knownName = result?.user_name || getCachedUserName(val) || '';
                    setDestination(val);
                    setChallenge({ ...result, user_name: knownName });
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
                {config.email === 'smtp' ? (
                  <div className="banner" style={{ fontSize: '11px' }}>
                    A real verification OTP will be delivered to your inbox.
                  </div>
                ) : (
                  <div className="banner" style={{ fontSize: '11px' }}>
                    Local dev mode: codes are displayed on-screen until real SMTP is configured.
                  </div>
                )}
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
                run(async () => {
                  const u = await api('/auth/email/verify', {
                    challenge_id: challenge.challenge_id,
                    code: f.get('code'),
                    ...(f.get('name') ? { name: f.get('name'), roles: f.getAll('roles') } : {}),
                    language: lang,
                    email: destination,
                  });
                  if (u?.name) saveCachedUserName(destination, u.name);
                  onUser(u);
                });
              }}
            >
              {challenge.development_code ? (
                <div className="dev-code">
                  Verification code: <strong>{challenge.development_code}</strong>
                  <small>Local test mode · Expires in 5 minutes</small>
                </div>
              ) : (
                <div className="banner">
                  Verification code sent to <strong>{destination}</strong>. Check your inbox and spam folder.
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
                  placeholder="Enter 6-digit code"
                  onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); }}
                />
              </FormField>
              <FormField label="Your name (for new account registration)">
                <input
                  name="name"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="e.g. Balwinder Singh"
                />
              </FormField>
              <fieldset>
                <legend>For new accounts, select your role(s):</legend>
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
                      defaultChecked={role === 'farmer'}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
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
