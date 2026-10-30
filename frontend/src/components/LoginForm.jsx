import React, { useEffect, useRef, useState } from 'react';
import { Sprout, ArrowRight } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function LoginForm({ busy, run, onUser, lang = 'en' }) {
  const [config, setConfig] = useState(null);
  const [mode, setMode] = useState('email');
  const [challenge, setChallenge] = useState(null);
  const [destination, setDestination] = useState('');
  const [googleError, setGoogleError] = useState('');
  const googleButton = useRef(null);
  const t = (k, p) => translate(lang, k, p);
  useEffect(() => { run(async () => setConfig(await api('/auth/config'))); }, []);
  useEffect(() => {
    if (!config?.google_client_id || challenge) return;
    let cancelled = false;
    let script;
    async function init() {
      try {
        const { nonce } = await api('/auth/google/nonce', {});
        if (cancelled) return;
        window.google.accounts.id.initialize({ client_id: config.google_client_id, nonce,
          callback: ({ credential }) => run(async () => {
            const result = await api('/auth/google', { credential });
            setMode('email'); setDestination(result.email); setChallenge(result);
          }) });
        window.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'large', text: 'continue_with' });
      } catch (e) { if (!cancelled) setGoogleError(e.message); }
    }
    if (window.google?.accounts) init();
    else {
      script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.onload = init;
      script.onerror = () => setGoogleError('Google could not load. Use email instead.');
      document.head.appendChild(script);
    }
    return () => { cancelled = true; script?.remove(); };
  }, [config, challenge]);
  return <>
    <div className="brand-mark"><Sprout /></div>
    <h2>{challenge ? 'Verify your code' : 'Welcome to YantraSetu'}</h2>
    <p>{challenge ? `Enter the six-digit code for ${destination}.` : 'Sign in or create your account to find equipment and manage bookings.'}</p>
    {!challenge ? <>
      {config?.google_client_id && <><div ref={googleButton} className="google-button" /><p className="auth-hint">Google sign-in is followed by an email verification code.</p></>}
      {googleError && <p role="alert">{googleError}</p>}
      <div className="auth-methods" aria-label="Sign-in method">
        <button type="button" className={mode === 'email' ? 'primary' : 'outline'} onClick={() => setMode('email')}>Email</button>
        {config?.phone && <button type="button" className={mode === 'phone' ? 'primary' : 'outline'} onClick={() => setMode('phone')}>Phone (demo)</button>}
      </div>
      {mode === 'email' && config?.email === 'disabled' ? <div className="banner">Email and Google sign-in need administrator configuration. Phone demo is available for local testing.</div> : <form onSubmit={e => {
        e.preventDefault(); const value = new FormData(e.target).get('destination').trim();
        run(async () => { const result = await api(mode === 'email' ? '/auth/email/request' : '/auth/request', mode === 'email' ? { email: value } : { phone: value }); setDestination(value); setChallenge(result); });
      }}>
        <FormField label={mode === 'email' ? 'Email address' : t('mobileNumber')}>
          <input key={mode} name="destination" type={mode === 'email' ? 'email' : 'tel'} autoComplete={mode === 'email' ? 'email' : 'tel'} required maxLength={254} pattern={mode === 'phone' ? '\\+91[6-9][0-9]{9}' : undefined} placeholder={mode === 'email' ? 'you@gmail.com' : '+919000000001'} />
        </FormField>
        {(mode === 'phone' || config?.email === 'development') && <div className="banner">Development simulation: no message is sent and identity is not verified.</div>}
        <button className="primary full" disabled={busy || !config}>Send verification code <ArrowRight size={17} /></button>
      </form>}
    </> : <form onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.target);
      run(async () => onUser(await api(mode === 'email' ? '/auth/email/verify' : '/auth/verify', { challenge_id: challenge.challenge_id, code: f.get('code'), ...(f.get('name') ? { name: f.get('name'), roles: f.getAll('roles') } : {}), language: lang })));
    }}>
      {challenge.development_code ? <div className="dev-code">Simulation only — no message sent: <strong>{challenge.development_code}</strong></div> : <div className="banner">Email submitted for delivery. Check your inbox and spam folder. Your code expires in 5 minutes.</div>}
      <FormField label="Verification code"><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus /></FormField>
      {(mode === 'email' || challenge.is_new_user) && <>
        <FormField label="Your name (required for a new account)"><input name="name" minLength={2} maxLength={80} autoComplete="name" placeholder="Your full name" required={mode === 'phone'} /></FormField>
        <fieldset><legend>For new accounts, I want to</legend>{[['farmer','Rent equipment'],['owner','List equipment'],['operator','Work as an operator'],['fpo','Manage an FPO']].map(([role,label]) => <label className="checkbox" key={role}><input type="checkbox" name="roles" value={role} defaultChecked={role === 'farmer'} />{label}</label>)}</fieldset>
        <small>Existing accounts keep their saved name and roles.</small>
      </>}
      <button className="primary full" disabled={busy}>Verify and continue <ArrowRight size={17} /></button>
      <button className="text-button" type="button" disabled={busy} onClick={() => { setChallenge(null); setGoogleError(''); }}>Change address or request a new code</button>
    </form>}
  </>;
}
