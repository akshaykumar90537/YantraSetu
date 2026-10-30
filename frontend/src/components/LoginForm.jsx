import React, { useState } from 'react';
import { Sprout, ArrowRight, UserCheck } from 'lucide-react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function LoginForm({ busy, run, onUser, lang = 'en' }) {
  const [challenge, setChallenge] = useState(null);
  const t = (k, p) => translate(lang, k, p);

  return (
    <>
      <div className="brand-mark">
        <Sprout />
      </div>
      <h2>
        {challenge?.user_exists ? t('welcomeBackTitle') : t('welcomeTitle')}
      </h2>
      <p>
        {challenge?.user_exists
          ? t('loginExistingSub')
          : t('welcomeSub')}
      </p>
      <div className="banner">{t('devModeBanner')}</div>

      {!challenge ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const phone = new FormData(e.target).get('phone');
            run(async () => setChallenge(await api('/auth/request', { phone })));
          }}
        >
          <FormField label={t('mobileNumber')}>
            <input
              name="phone"
              type="tel"
              required
              pattern="\+91[6-9][0-9]{9}"
              placeholder="+919000000001"
              autoFocus
            />
          </FormField>
          <button className="primary full" disabled={busy}>
            {t('getOtpBtn')} <ArrowRight size={17} />
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            run(async () => {
              const payload = {
                challenge_id: challenge.challenge_id,
                code: f.get('code'),
                language: lang,
              };
              if (!challenge.user_exists) {
                const roles = f.getAll('roles');
                payload.name = f.get('name');
                payload.roles = roles.length > 0 ? roles : ['farmer'];
              }
              const userObj = await api('/auth/verify', payload);
              onUser(userObj);
            });
          }}
        >
          {challenge.user_exists ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#2f5233',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                {challenge.name ? challenge.name.charAt(0).toUpperCase() : <UserCheck size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#166534', fontSize: '15px' }}>
                  {challenge.name ? t('welcomeBackUser', { name: challenge.name }) : t('welcomeBackTitle')}
                </div>
                <div style={{ fontSize: '13px', color: '#15803d' }}>
                  {t('loginExistingSub')}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '14px',
                fontSize: '13px',
                color: '#475569',
              }}
            >
              {t('registerNewSub')}
            </div>
          )}

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

          {!challenge.user_exists && (
            <>
              <FormField label={t('yourName')}>
                <input name="name" minLength="2" maxLength="80" required />
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
            </>
          )}

          <button className="primary full" disabled={busy}>
            {challenge.user_exists ? t('signInBtn') : t('registerBtn')} <ArrowRight size={17} />
          </button>
          <button className="text-button" type="button" onClick={() => setChallenge(null)}>
            {t('useDifferentNumber')}
          </button>
        </form>
      )}
    </>
  );
}
