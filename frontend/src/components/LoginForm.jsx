import React, { useState } from 'react';
import { Sprout, ArrowRight } from 'lucide-react';
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
      <h2>{t('welcomeTitle')}</h2>
      <p>{t('welcomeSub')}</p>
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
            />
          </FormField>
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
          <button className="primary full" disabled={busy}>
            {t('continueBtn')} <ArrowRight size={17} />
          </button>
          <button className="text-button" type="button" onClick={() => setChallenge(null)}>
            {t('requestNewCode')}
          </button>
        </form>
      )}
    </>
  );
}

