import React from 'react';
import { INR, dt, translate } from '../locales';

export function Invoice({ data, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);

  return (
    <div className="invoice">
      <span className="eyebrow">{t('rentalBillTitle')}</span>
      <h2>{data.booking.machine_name}</h2>
      <small>{data.invoice_number}</small>
      <p>
        {dt(data.booking.start_at)} · {data.booking.farmer_name}
      </p>

      <div className="quote">
        <span>
          {t('confirmedQuantityLabel')}{' '}
          <b>
            {data.booking.actual_quantity}{' '}
            {data.booking.unit === 'hour' ? t('perHour') : t('perAcre')}
          </b>
        </span>
        <span>
          {t('rateLabel')} <b>{INR(data.booking.rate)}</b>
        </span>
        <span>
          {t('rentalSubtotal')} <b>{INR(data.breakdown.rental)}</b>
        </span>
        <span>
          {t('mobilizationLabel')} <b>{INR(data.breakdown.mobilization)}</b>
        </span>
        <span>
          {t('finalTotalLabel')} <strong>{INR(data.breakdown.total)}</strong>
        </span>
      </div>

      <p>{t(data.booking.payment_status) || data.booking.payment_status.replaceAll('_', ' ')}</p>
      <p className="caption">{data.notice}</p>
      <button className="primary" onClick={() => window.print()}>
        {t('printPdfBtn')}
      </button>
    </div>
  );
}

