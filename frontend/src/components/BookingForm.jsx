import React, { useState, useEffect } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { INR, dt, translate } from '../locales';
import { TimelineCalendar } from './TimelineCalendar';
import { MapPicker } from './MapPicker';
import { MapPin, Wrench, Fuel, CheckCircle2 } from 'lucide-react';

export function BookingForm({ machine: m, online, busy, run, onDone, lang = 'en' }) {
  const [quote, setQuote] = useState(null);
  const [idempotencyKey] = useState(crypto.randomUUID());
  const [availability, setAvailability] = useState(null);
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [farmLat, setFarmLat] = useState(String(m.latitude || 30.901));
  const [farmLon, setFarmLon] = useState(String(m.longitude || 75.857));
  const [showFarmMap, setShowFarmMap] = useState(false);

  // Attachments & Fuel options
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [fuelIncluded, setFuelIncluded] = useState(false);

  const t = (k, p) => translate(lang, k, p);
  const offeredAttachments = Array.isArray(m.attachments) ? m.attachments : [];
  const hasFuelOption = Boolean(m.fuel_included && Number(m.fuel_rate_extra) > 0);

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
      selected_attachments: selectedAttachments,
      fuel_included: fuelIncluded,
    };
  }

  function handleSelectSlot(startIsoLocal, endIsoLocal) {
    setStartVal(startIsoLocal);
    setEndVal(endIsoLocal);
    setQuote(null);
  }

  function toggleAttachment(att) {
    setQuote(null);
    if (selectedAttachments.some((a) => a.name === att.name)) {
      setSelectedAttachments(selectedAttachments.filter((a) => a.name !== att.name));
    } else {
      setSelectedAttachments([...selectedAttachments, { name: att.name, rate: Number(att.rate) }]);
    }
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

        {/* Implement Attachments Selection */}
        {offeredAttachments.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '14px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Wrench size={15} color="#15803d" />
              <span>{t('selectAttachments')}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {offeredAttachments.map((att) => {
                const isSelected = selectedAttachments.some((a) => a.name === att.name);
                return (
                  <button
                    key={att.name}
                    type="button"
                    onClick={() => toggleAttachment(att)}
                    style={{
                      background: isSelected ? '#dcfce7' : '#fff',
                      color: isSelected ? '#166534' : '#334155',
                      border: isSelected ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {isSelected && <CheckCircle2 size={13} />}
                    <span>{att.name}</span>
                    <span style={{ color: '#059669', fontSize: '11px', fontWeight: '700' }}>
                      (+{INR(att.rate)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fuel (Diesel) Option Toggle */}
        {hasFuelOption && (
          <div style={{
            background: '#fefce8',
            border: '1px solid #fef08a',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '14px',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#854d0e' }}>
              <input
                type="checkbox"
                checked={fuelIncluded}
                onChange={(e) => {
                  setFuelIncluded(e.target.checked);
                  setQuote(null);
                }}
                style={{ width: '16px', height: '16px', accentColor: '#ca8a04' }}
              />
              <Fuel size={16} />
              <span>
                {t('includeDieselToggle')} (+{INR(m.fuel_rate_extra)}/hr provided by owner)
              </span>
            </label>
          </div>
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
          <div className="quote" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
              <span>{t('itemizedBaseRental')}:</span>
              <b>{INR(quote.base_rental || quote.rental)}</b>
            </div>
            {quote.addons && Number(quote.addons) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#059669' }}>
                <span>{t('itemizedAttachments')} & Fuel:</span>
                <b>+{INR(quote.addons)}</b>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
              <span>{t('mobilizationLabel')}:</span>
              <b>{INR(quote.mobilization)}</b>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px dashed #86efac',
              paddingTop: '6px',
              marginTop: '6px',
              fontSize: '15px',
              fontWeight: '700',
              color: '#15803d',
            }}>
              <span>{t('estimatedTotal')}:</span>
              <strong>{INR(quote.total)}</strong>
            </div>
            <small style={{ display: 'block', marginTop: '6px', color: '#64748b', fontSize: '11px' }}>
              {t('finalBillNote')}
            </small>
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
