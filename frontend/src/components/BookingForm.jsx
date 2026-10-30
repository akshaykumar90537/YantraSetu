import React, { useState, useEffect } from 'react';
import { FormField } from './Common';
import { api } from '../api';
import { INR, dt, translate } from '../locales';
import { TimelineCalendar } from './TimelineCalendar';
import { MapPicker } from './MapPicker';
import { MapPin, Wrench, Fuel, CheckCircle2 } from 'lucide-react';

export function BookingForm({ machine: m, online, busy, run, onDone, lang = 'en' }) {
  if (!m) return null;

  const [quote, setQuote] = useState(null);
  const [idempotencyKey] = useState(() => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {}
    return '10000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14);
  });
  const [availability, setAvailability] = useState(null);
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [acresVal, setAcresVal] = useState(m?.unit === 'acre' ? '1.0' : '');
  const [farmLat, setFarmLat] = useState(String(m?.latitude || 30.901));
  const [farmLon, setFarmLon] = useState(String(m?.longitude || 75.857));
  const [showFarmMap, setShowFarmMap] = useState(false);

  // Attachments & Fuel options
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [fuelIncluded, setFuelIncluded] = useState(false);

  const t = (k, p) => translate(lang, k, p);
  const offeredAttachments = Array.isArray(m?.attachments) ? m.attachments : [];
  const hasFuelOption = Boolean(m?.fuel_included && Number(m?.fuel_rate_extra) > 0);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const nowMinStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  let timeError = '';
  if (startVal && endVal) {
    const s = new Date(startVal);
    const e = new Date(endVal);
    if (s.getTime() < now.getTime() - 60000) {
      timeError = 'Booking start date/time cannot be in the past.';
    } else if (e.getTime() <= s.getTime()) {
      timeError = 'Booking end time must be after start time.';
    } else if (e.getTime() - s.getTime() < 30 * 60 * 1000) {
      timeError = 'Booking duration must be at least 30 minutes.';
    }
  } else if (!startVal || !endVal) {
    timeError = 'Please select booking start and end times.';
  }

  function calculateLiveEstimate(sStr, eStr, aVal, atts, fuel) {
    if (!sStr || !eStr) return null;
    const s = new Date(sStr);
    const e = new Date(eStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e.getTime() <= s.getTime()) return null;
    const diffHours = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
    if (diffHours < 0.5) return null;

    const quantity = m.unit === 'hour' ? Math.round(diffHours * 100) / 100 : (parseFloat(aVal) || 1);
    const rate = Number(m.rate || 0);
    const base_rental = Math.round(quantity * rate * 100) / 100;

    let addons_rate = 0;
    if (Array.isArray(atts)) {
      for (const a of atts) {
        addons_rate += Number(a.rate || 0);
      }
    }
    if (fuel && m.fuel_rate_extra) {
      addons_rate += Number(m.fuel_rate_extra || 0);
    }
    const addons = Math.round(quantity * addons_rate * 100) / 100;
    const mobilization = Number(m.mobilization || 0);
    const total = Math.round((base_rental + addons + mobilization) * 100) / 100;

    return {
      base_rental,
      rental: base_rental + addons,
      addons,
      addons_rate,
      mobilization,
      total,
      quantity,
      unit: m.unit,
      rate,
      payment: 'Directly to owner outside platform',
    };
  }

  // Automatically recalculate estimate whenever dates, acreage, attachments, or fuel change
  useEffect(() => {
    const est = calculateLiveEstimate(startVal, endVal, acresVal, selectedAttachments, fuelIncluded);
    if (est) {
      setQuote(est);
    }
  }, [startVal, endVal, acresVal, selectedAttachments, fuelIncluded, m.rate, m.mobilization, m.fuel_rate_extra, m.unit]);

  useEffect(() => {
    api('/machines/' + m.id + '/availability')
      .then((res) => {
        setAvailability(res);
        if (res.next_available) {
          const s = new Date(res.next_available.start_at);
          const e = new Date(res.next_available.end_at);
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
      acres: m.unit === 'acre' ? parseFloat(f.get('acres') || acresVal || '1') : null,
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
  }

  function toggleAttachment(att) {
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
              min={nowMinStr}
              onChange={(e) => setStartVal(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('endDeviceTime')}>
            <input
              name="end"
              type="datetime-local"
              value={endVal}
              min={startVal || nowMinStr}
              onChange={(e) => setEndVal(e.target.value)}
              required
            />
          </FormField>
        </div>

        {m.unit === 'acre' && (
          <FormField label={t('estimatedAcreage')}>
            <input
              name="acres"
              type="number"
              step="0.001"
              min="0.001"
              max="10000"
              value={acresVal}
              onChange={(e) => setAcresVal(e.target.value)}
              required
            />
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
                onChange={(e) => setFuelIncluded(e.target.checked)}
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

        {timeError && (
          <div className="alert" style={{ margin: '14px 0', fontSize: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
            {timeError}
          </div>
        )}

        <div className="actions">
          {online && (
            <button
              type="button"
              className="outline"
              disabled={busy || Boolean(timeError)}
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
          <button className="primary" disabled={busy || Boolean(timeError) || (online && !quote)}>
            {online ? t('requestApprovalBtn') : t('saveOfflineDraftBtn')}
          </button>
        </div>
      </form>
    </>
  );
}
