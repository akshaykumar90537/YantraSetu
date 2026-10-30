import React from 'react';
import { MapPin, ArrowUpRight } from 'lucide-react';
import { TractorArt } from './TractorArt';
import { INR, translate } from '../locales';

export function MachineCard({ machine: m, index, onBook, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);

  return (
    <article className="machine-card">
      <div className={'machine-image color-' + (index % 3)}>
        <span className="tag">{m.category}</span>
        <TractorArt />
        <span className="illustration-label">{t('illustrationNotPhoto')}</span>
      </div>
      <div className="machine-body">
        <div className="card-topline">
          <span>
            <MapPin size={13} />
            {m.village}
          </span>
          <span>{t('unverifiedListing')}</span>
        </div>
        <h3>{m.name}</h3>
        <p>{m.description || 'Contact the owner to confirm machine specifications.'}</p>
        <div className="owner-line">
          <div className="mini-avatar">{m.owner_name ? m.owner_name.charAt(0) : 'O'}</div>
          <span>{m.owner_name}</span>
        </div>
        <div className="card-bottom">
          <span>
            <strong>{INR(m.rate)}</strong>
            <small> / {m.unit === 'hour' ? t('perHour') : t('perAcre')}</small>
          </span>
          <button className="small-button" onClick={() => onBook(m)}>
            {t('viewAndBook')} <ArrowUpRight size={15} />
          </button>
        </div>
        <small className="charge-note">
          {t('mobilizationLabel')}: {INR(m.mobilization)} · {m.buffer_minutes} {t('bufferMinutes')}
        </small>
      </div>
    </article>
  );
}

