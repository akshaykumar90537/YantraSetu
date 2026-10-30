import React, { useState, useEffect } from 'react';
import { FormField, TimeFields } from './Common';
import { api } from '../api';
import { INR, dt, translate } from '../locales';

export function BookingForm({ machine: m, online, busy, run, onDone, lang = 'en' }) {
  const [quote, setQuote] = useState(null);
  const [idempotencyKey] = useState(crypto.randomUUID());
  const [availability, setAvailability] = useState(null);
  const t = (k, p) => translate(lang, k, p);

  useEffect(() => {
    api('/machines/' + m.id + '/availability')
      .then(setAvailability)
      .catch(() => {});
  }, [m.id]);

  function payload(form) {
    const f = new FormData(form);
    return {
      machine_id: m.id,
      start_at: new Date(f.get('start')).toISOString(),
      end_at: new Date(f.get('end')).toISOString(),
      acres: m.unit === 'acre' ? f.get('acres') : null,
      latitude: Number(f.get('lat')),
      longitude: Number(f.get('lon')),
      idempotency_key: idempotencyKey,
    };
  }

  return (
    <>
      <span className="eyebrow">{t('bookNearby')}</span>
      <h2>{m.name}</h2>
      <p>
        {INR(m.rate)} / {m.unit === 'hour' ? t('perHour') : t('perAcre')} + {INR(m.mobilization)}{' '}
        {t('mobilizationLabel').toLowerCase()}. {t('noPlatformFee')}
      </p>

      <details>
        <summary>{t('currentReservedIntervals')}</summary>
        {availability ? (
          [...availability.reserved, ...availability.maintenance].length ? (
            [...availability.reserved, ...availability.maintenance].map((a, i) => (
              <p key={i}>
                {dt(a.start_at)} → {dt(a.end_at)} {a.status ? `(${a.status})` : '(MAINTENANCE)'}
              </p>
            ))
          ) : (
            <p>{t('noIntervals')}</p>
          )
        ) : (
          <p>{t('liveConnectionRequired')}</p>
        )}
      </details>

      <form
        onChange={() => setQuote(null)}
        onSubmit={(e) => {
          e.preventDefault();
          const d = payload(e.target);
          run(async () => onDone(d, !online));
        }}
      >
        <TimeFields startLabel={t('startDeviceTime')} endLabel={t('endDeviceTime')} />

        {m.unit === 'acre' && (
          <FormField label={t('estimatedAcreage')}>
            <input name="acres" type="number" step="0.001" min="0.001" max="10000" required />
          </FormField>
        )}

        <div className="form-grid">
          <FormField label={t('farmLat')}>
            <input
              name="lat"
              type="number"
              step="any"
              min="-90"
              max="90"
              defaultValue={m.latitude}
              required
            />
          </FormField>
          <FormField label={t('farmLon')}>
            <input
              name="lon"
              type="number"
              step="any"
              min="-180"
              max="180"
              defaultValue={m.longitude}
              required
            />
          </FormField>
        </div>

        <p className="caption">{t('bookingDisclaimer')}</p>

        {quote && (
          <div className="quote">
            <span>
              {t('rentalEst')} <b>{INR(quote.rental)}</b>
            </span>
            <span>
              {t('mobilizationEst')} <b>{INR(quote.mobilization)}</b>
            </span>
            <span>
              {t('estimatedTotal')} <strong>{INR(quote.total)}</strong>
            </span>
            <small>{t('finalBillNote')}</small>
          </div>
        )}

        <div className="actions">
          {online && (
            <button
              type="button"
              className="outline"
              disabled={busy}
              onClick={(e) => {
                const form = e.currentTarget.form;
                if (form.reportValidity()) {
                  run(async () => setQuote(await api('/quote', payload(form))));
                }
              }}
            >
              {t('calculateEstimateBtn')}
            </button>
          )}
          <button className="primary" disabled={busy || (online && !quote)}>
            {online ? t('requestApprovalBtn') : t('saveOfflineDraftBtn')}
          </button>
        </div>
      </form>
    </>
  );
}

