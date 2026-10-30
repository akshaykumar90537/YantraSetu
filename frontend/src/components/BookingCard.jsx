import React from 'react';
import { CalendarDays, IndianRupee } from 'lucide-react';
import { api } from '../api';
import { INR, dt, translate } from '../locales';

export function BookingCard({ booking: b, user: u, busy, run, load, setModal, notify, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const owner = u.id === b.owner_id;
  const farmer = u.id === b.farmer_id;

  const action = (a) =>
    run(async () => {
      await api('/bookings/' + b.id + '/action', { action: a });
      await load();
    });

  const statusLabel = t(b.status) || b.status.replaceAll('_', ' ');
  const paymentLabel = t(b.payment_status) || b.payment_status.replaceAll('_', ' ');

  return (
    <article className="booking-card">
      <div className="booking-heading">
        <div>
          <small>
            {b.id.slice(0, 8).toUpperCase()} · {b.village}
          </small>
          <h3>{b.machine_name}</h3>
        </div>
        <span className={'status ' + b.status.toLowerCase()}>{statusLabel}</span>
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

      <p className="caption">
        {t('farmerLabel')}: {b.farmer_name} · {paymentLabel} — manually reported, not independently verified.
      </p>

      <div className="actions">
        {owner && b.status === 'PENDING' && (
          <>
            <button className="primary" disabled={busy} onClick={() => action('approve')}>
              {t('acceptBtn')}
            </button>
            <button className="outline" disabled={busy} onClick={() => action('reject')}>
              {t('rejectBtn')}
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
              className="outline"
              onClick={() =>
                run(async () =>
                  setModal({ type: 'invoice', data: await api('/bookings/' + b.id + '/invoice') })
                )
              }
            >
              {t('viewInvoiceBtn')}
            </button>

            {(owner || farmer) && (
              <>
                <select
                  aria-label="Manually reported payment status"
                  value={b.payment_status}
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

                <button className="outline" onClick={() => setModal({ type: 'rating', b })}>
                  {t('rateExperienceBtn')}
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

