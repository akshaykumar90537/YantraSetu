import React, { useState, useEffect } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { INR, dt, translate } from '../locales';
import { TimelineCalendar } from './TimelineCalendar';
import { MapPicker } from './MapPicker';
import { MapPin } from 'lucide-react';

export function BookingForm({ machine: m, online, busy, run, onDone, lang = 'en' }) {
  const [quote, setQuote] = useState(null);
  const [idempotencyKey] = useState(crypto.randomUUID());
  const [availability, setAvailability] = useState(null);
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [farmLat, setFarmLat] = useState(String(m.latitude || 30.901));
  const [farmLon, setFarmLon] = useState(String(m.longitude || 75.857));
  const [showFarmMap, setShowFarmMap] = useState(false);

  const t = (k, p) => translate(lang, k, p);

  useEffect(() => {
    api('/machines/' + m.id + '/availability')
      .then((res) => {
        setAvailability(res);
        if (res.next_available) {
          const s = new Date(res.next_available.start_at);
          const e = new Date(res.next_available.end_at);
          const pad = (n) => String(n).padStart(2, '0');
          const fmt = (d) =>
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setStartVal(fmt(s));
          setEndVal(fmt(e));
        }
      })
      .catch(() => {});
  }, [m.id]);

  function payload(form) {
    const f = new FormData(form);
    return {
      machine_id: m.id,
      start_at: new Date(f.get('start')).toISOString(),
      end_at: new Date(f.get('end')).toISOString(),
      acres: m.unit === 'acre' ? f.get('acres') : null,
      latitude: Number(farmLat),
      longitude: Number(farmLon),
      idempotency_key: idempotencyKey,
    };
  }

  function handleSelectSlot(startIsoLocal, endIsoLocal) {
    setStartVal(startIsoLocal);
    setEndVal(endIsoLocal);
    setQuote(null);
  }

  return (
    <>
      <span className="eyebrow">{t('bookNearby')}</span>
      <h2>{m.name}</h2>
      <p>
        {INR(m.rate)} / {m.unit === 'hour' ? t('perHour') : t('perAcre')} + {INR(m.mobilization)}{' '}
        {t('mobilizationLabel').toLowerCase()}. {t('noPlatformFee')}
      </p>

      {/* Visual Timeline Calendar & Next Available Slot */}
      <TimelineCalendar
        availability={availability}
        selectedStart={startVal}
        selectedEnd={endVal}
        onSelectSlot={handleSelectSlot}
        lang={lang}
      />

      <form
        onChange={() => setQuote(null)}
        onSubmit={(e) => {
          e.preventDefault();
          const d = payload(e.target);
          run(async () => onDone(d, !online));
        }}
      >
        <div className="form-grid">
          <FormField label={t('startDeviceTime')}>
            <input
              name="start"
              type="datetime-local"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('endDeviceTime')}>
            <input
              name="end"
              type="datetime-local"
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
              required
            />
          </FormField>
        </div>

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
              value={farmLat}
              onChange={(e) => setFarmLat(e.target.value)}
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
              value={farmLon}
              onChange={(e) => setFarmLon(e.target.value)}
              required
            />
          </FormField>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => setShowFarmMap(!showFarmMap)}
          style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <MapPin size={15} />
          {showFarmMap ? 'Hide Farm Map Pin' : '📍 Pin Farm Location on OpenStreetMap'}
        </button>

        {showFarmMap && (
          <div style={{ marginBottom: '16px' }}>
            <MapPicker
              center={[Number(farmLat) || 30.901, Number(farmLon) || 75.857]}
              height="200px"
              radius={0}
              interactive={true}
              showLocate={true}
              onSelectLocation={(newLat, newLon) => {
                setFarmLat(newLat);
                setFarmLon(newLon);
              }}
              lang={lang}
            />
          </div>
        )}

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
