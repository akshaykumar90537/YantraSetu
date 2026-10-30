import React from 'react';
import { CalendarDays, IndianRupee, Wrench, Fuel, Star, User, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { INR, dt, translate } from '../locales';

export function BookingCard({ booking: b, user: u, busy, run, load, setModal, notify, lang = 'en' }) {
  if (!b) return null;
  const t = (k, p) => translate(lang, k, p);
  const owner = Boolean(u && b && u.id === b.owner_id);
  const farmer = Boolean(u && b && u.id === b.farmer_id);

  const action = (a) =>
    run(async () => {
      await api('/bookings/' + b.id + '/action', { action: a });
      await load();
    });

  const statusRaw = String(b?.status || 'PENDING');
  const statusLabel = t(statusRaw) || statusRaw.replaceAll('_', ' ');
  const paymentRaw = String(b?.payment_status || 'UNPAID');
  const paymentLabel = t(paymentRaw) || paymentRaw.replaceAll('_', ' ');
  const selectedAttachments = Array.isArray(b?.selected_attachments) ? b.selected_attachments : [];
  const bookingCode = String(b?.id || '').slice(0, 8).toUpperCase() || 'BOOKING';

  return (
    <article className="booking-card">
      <div className="booking-heading">
        <div>
          <small>
            {bookingCode} · {b?.village || 'Punjab'}
          </small>
          <h3>{b?.machine_name || 'Farm Equipment'}</h3>
        </div>
        <span className={'status ' + statusRaw.toLowerCase()}>{statusLabel}</span>
      </div>

      <div className="booking-meta">
        <span>
          <CalendarDays size={16} />
          {dt(b.start_at)} → {dt(b.end_at)}
        </span>
        <span>
          <IndianRupee size={16} />
          {b.final_total ? INR(b.final_total) + ' final' : INR(b.estimate) + ' estimated'}
        </span>
      </div>

      {/* Add-on Attachments and Fuel Chips */}
      {(selectedAttachments.length > 0 || b.fuel_included) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
          {selectedAttachments.map((att, idx) => (
            <span
              key={idx}
              style={{
                background: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Wrench size={11} /> +{att.name}
            </span>
          ))}
          {b.fuel_included && (
            <span
              style={{
                background: '#fefce8',
                color: '#854d0e',
                border: '1px solid #fef08a',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Fuel size={11} /> +Diesel Included
            </span>
          )}
        </div>
      )}

      {/* Farmer Profile & Overall Rating Box for Equipment Owner */}
      {owner ? (
        <div style={{
          background: b.status === 'PENDING' ? '#f0fdf4' : '#f8fafc',
          border: b.status === 'PENDING' ? '1.5px solid #86efac' : '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 12px',
          margin: '10px 0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="#15803d" />
              <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                {t('farmerLabel')}: {b.farmer_name || 'Farmer'}
              </span>
              {b.farmer_phone && (
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  ({b.farmer_phone})
                </span>
              )}
            </div>

            {/* Farmer Overall Rating Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: '700',
              color: '#92400e',
            }}>
              <Star size={13} fill="#f59e0b" color="#d97706" />
              <span>{Number(b.farmer_rating_avg || 5.0).toFixed(1)}</span>
              <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '500' }}>
                ({b.farmer_rating_count || 0} reviews)
              </span>
            </div>
          </div>

          {b.status === 'PENDING' && (
            <div style={{ fontSize: '12px', color: '#166534', marginTop: '6px', fontWeight: '600' }}>
              ⭐ Check farmer rating above and approve to rent out equipment for this time slot.
            </div>
          )}
          {['APPROVED', 'IN_PROGRESS'].includes(b.status) && (
            <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '4px', fontWeight: '500' }}>
              🔒 Equipment slot automatically delisted & reserved for this booking period.
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 12px',
          margin: '10px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} color="#2563eb" />
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
              Owner: {b.owner_name || 'Equipment Owner'}
            </span>
            {b.owner_phone && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                ({b.owner_phone})
              </span>
            )}
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#92400e',
          }}>
            <Star size={13} fill="#f59e0b" color="#d97706" />
            <span>{Number(b.owner_rating_avg || 5.0).toFixed(1)}</span>
            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '500' }}>
              ({b.owner_rating_count || 0} reviews)
            </span>
          </div>
        </div>
      )}

      <p className="caption">
        {paymentLabel} — manually reported, not independently verified.
      </p>

      <div className="actions">
        {owner && b.status === 'PENDING' && (
          <>
            <button className="primary" disabled={busy} onClick={() => action('approve')}>
              ✓ {t('acceptBtn')} & Rent Out
            </button>
            <button className="outline" disabled={busy} onClick={() => action('reject')}>
              ✗ {t('rejectBtn')}
            </button>
          </>
        )}

        {(owner || farmer) && ['PENDING', 'APPROVED'].includes(b.status) && (
          <button className="text-button" disabled={busy} onClick={() => action('cancel')}>
            {t('cancelBtn')}
          </button>
        )}

        {owner && b.status === 'APPROVED' && (
          <button className="outline" onClick={() => setModal({ type: 'operator', b })}>
            {t('assignOperatorBtn')}
          </button>
        )}

        {(owner || u.id === b.operator_id) && ['APPROVED', 'IN_PROGRESS'].includes(b.status) && (
          <button className="primary" onClick={() => setModal({ type: 'meter', b })}>
            {b.status === 'APPROVED' ? t('submitStartReadingBtn') : t('submitEndReadingBtn')}
          </button>
        )}

        {farmer && ['APPROVED', 'IN_PROGRESS'].includes(b.status) && (
          <button className="primary" onClick={() => setModal({ type: 'confirm-meter', b })}>
            {t('reviewConfirmReadingBtn')}
          </button>
        )}

        {b.status === 'COMPLETED' && (
          <>
            <button
              className="primary"
              onClick={() =>
                run(async () =>
                  setModal({ type: 'invoice', data: await api('/bookings/' + b.id + '/invoice') })
                )
              }
            >
              📄 {t('viewInvoiceBtn')}
            </button>

            {(owner || farmer) && (
              <>
                <select
                  aria-label="Manually reported payment status"
                  value={b?.payment_status || 'UNPAID'}
                  disabled={busy}
                  onChange={(e) => {
                    const status = e.target.value;
                    run(async () => {
                      await api('/bookings/' + b.id + '/payment-report', { status });
                      await load();
                      notify(
                        'Manual report saved. Payment has not been independently verified.'
                      );
                    });
                  }}
                >
                  <option value="UNPAID">{t('UNPAID')}</option>
                  <option value="PAID_OUTSIDE_PLATFORM">{t('PAID_OUTSIDE_PLATFORM')}</option>
                  <option value="PAYMENT_DISPUTED">{t('PAYMENT_DISPUTED')}</option>
                </select>

                <button
                  className="outline"
                  onClick={() => setModal({ type: 'rating', b })}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <span>{owner ? 'Rate Farmer' : 'Rate Owner & Equipment'}</span>
                </button>
              </>
            )}
          </>
        )}

        <button
          className="text-button"
          onClick={() =>
            run(async () =>
              setModal({
                type: 'json',
                title: 'Booking audit trail',
                data: await api('/bookings/' + b.id + '/audit'),
              })
            )
          }
        >
          {t('historyBtn')}
        </button>
      </div>
    </article>
  );
}
