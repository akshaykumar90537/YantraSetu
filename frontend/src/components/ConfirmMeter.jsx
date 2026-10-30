import React, { useState, useEffect } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function ConfirmMeter({ booking: b, run, busy, done, lang = 'en' }) {
  const [pending, setPending] = useState([]);
  const t = (k, p) => translate(lang, k, p);

  useEffect(() => {
    run(async () => setPending(await api('/bookings/' + b.id + '/meter/pending')));
  }, [b.id]);

  return (
    <>
      <h2>{t('confirmReadingTitle')}</h2>
      <p>{t('confirmReadingInstruction')}</p>

      {pending.map((p) => (
        <form
          className="panel"
          key={p.id}
          onSubmit={(e) => {
            e.preventDefault();
            const code = new FormData(e.target).get('code');
            run(async () => {
              await api('/bookings/' + b.id + '/meter/confirm', { challenge_id: p.id, code });
              await done();
            });
          }}
        >
          <h3>
            {t('readingHoursLabel', {
              stage: p.payload.stage,
              reading: p.payload.reading,
            })}
          </h3>
          {p.payload.acres && (
            <p>{t('completedAcreageLabel', { acres: p.payload.acres })}</p>
          )}
          <FormField label={t('devOtpFromTest')}>
            <input
              name="code"
              pattern="[0-9]{6}"
              required
              inputMode="numeric"
              maxLength="6"
            />
          </FormField>
          <button className="primary" disabled={busy}>
            {t('confirmReadingBtn')}
          </button>
        </form>
      ))}

      {!pending.length && <p>{t('noPendingReading')}</p>}
    </>
  );
}

