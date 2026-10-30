import React, { useState } from 'react';
import { Sprout, ArrowRight, UserCheck, UserPlus } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function LoginForm({ busy, run, onUser, lang = 'en' }) {
  const [challenge, setChallenge] = useState(null);
  const [phone, setPhone] = useState('');
  const t = (k, p) => translate(lang, k, p);

  return (
    <>
      <div className="brand-mark">
        <Sprout />
      </div>

      {!challenge ? (
        <>
          <h2>{t('welcomeTitle')}</h2>
          <p>{t('welcomeSub')}</p>
          <div className="banner">{t('devModeBanner')}</div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const inputPhone = new FormData(e.target).get('phone');
              setPhone(inputPhone);
              run(async () => setChallenge(await api('/auth/request', { phone: inputPhone })));
            }}
          >
            <FormField label={t('mobileNumber')}>
              <input
                name="phone"
                type="tel"
                required
                pattern="\+91[6-9][0-9]{9}"
                placeholder="+919000000001"
                defaultValue={phone || '+919000000001'}
              />
            </FormField>
            <button className="primary full" disabled={busy}>
              {t('getOtpBtn')} <ArrowRight size={17} />
            </button>
          </form>
        </>
      ) : !challenge.is_new_user ? (
        /* EXISTING USER: Direct OTP sign-in, no redundant registration form */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: '6px', padding: '4px', display: 'flex' }}>
              <UserCheck size={18} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Registered Account Detected
            </span>
          </div>

          <h2>{t('welcomeBack', { name: challenge.user_name || 'Farmer' })}</h2>
          <p>{t('signInSubtitle')}</p>
          <div className="banner">{t('devModeBanner')}</div>

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
            <div className="dev-code">
              {t('simulatedOtp')}: <strong>{challenge.development_code}</strong>
              <small>{t('expiresIn')}</small>
            </div>
            <FormField label={t('verificationCode')}>
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength="6"
                required
                autoComplete="one-time-code"
                autoFocus
              />
            </FormField>
            <button className="primary full" disabled={busy}>
              {t('sign')} <ArrowRight size={17} />
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setChallenge(null)}
              style={{ marginTop: '12px' }}
            >
              ← {t('requestNewCode')}
            </button>
          </form>
        </>
      ) : (
        /* NEW USER: First-time sign up with Name and Role selection */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ background: '#fef3c7', color: '#b45309', borderRadius: '6px', padding: '4px', display: 'flex' }}>
              <UserPlus size={18} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              New Registration · {phone}
            </span>
          </div>

          <h2>{t('newAccountTitle')}</h2>
          <p>{t('newAccountSubtitle')}</p>
          <div className="banner">{t('devModeBanner')}</div>

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
            <div className="dev-code">
              {t('simulatedOtp')}: <strong>{challenge.development_code}</strong>
              <small>{t('expiresIn')}</small>
            </div>
            <FormField label={t('verificationCode')}>
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength="6"
                required
                autoComplete="one-time-code"
                autoFocus
              />
            </FormField>
            <FormField label={t('yourName')}>
              <input name="name" minLength="2" maxLength="80" required placeholder="e.g. Balwinder Singh" />
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
              onClick={() => setChallenge(null)}
              style={{ marginTop: '12px' }}
            >
              ← {t('requestNewCode')}
            </button>
          </form>
        </>
      )}
    </>
  );
}
