import React, { useState } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { translate } from '../locales';

export function MeterForm({ booking: b, run, busy, lang = 'en' }) {
  const [result, setResult] = useState(null);
  const stage = b.status === 'APPROVED' ? 'start' : 'end';
  const t = (k, p) => translate(lang, k, p);

  return (
    <>
      <h2>{stage === 'start' ? t('startMeterTitle') : t('endMeterTitle')}</h2>
      <p>{t('meterFarmerInstruction')}</p>
      {b.meter_start !== null && (
        <p>{t('confirmedStartLabel', { val: b.meter_start })}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          run(async () =>
            setResult(
              await api('/bookings/' + b.id + '/meter/request', {
                stage,
                reading: f.get('reading'),
                acres: f.get('acres') || null,
              })
            )
          );
        }}
      >
        <FormField label={t('meterReadingHours')}>
          <input
            name="reading"
            type="number"
            min="0"
            max="100000000"
            step="0.001"
            required
          />
        </FormField>
        {stage === 'end' && b.unit === 'acre' && (
          <FormField label={t('completedAcreage')}>
            <input
              name="acres"
              type="number"
              min="0.001"
              max="10000"
              step="0.001"
              required
            />
          </FormField>
        )}
        <button className="primary" disabled={busy}>
          {t('requestFarmerConfirmationBtn')}
        </button>
      </form>

      {result && !result.development_code && (
        <div className="banner" role="status">Verification email submitted for delivery to the farmer. Ask them to check their inbox and confirm this reading within 5 minutes.</div>
      )}
      {result?.development_code && (
        <div className="dev-code">
          {t('devOnlyCode')}: <strong>{result.development_code}</strong>
          <small>{t('devCodeInstruction')}</small>
        </div>
      )}
    </>
  );
}

