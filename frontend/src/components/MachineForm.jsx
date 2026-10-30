import React from 'react';
import { Plus, Check } from 'lucide-react';
import { FormField } from './Common';
import { translate } from '../locales';

export function MachineForm({ orgs = [], busy, onSubmit, initialData = null, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const isEdit = Boolean(initialData);

  return (
    <>
      <h2>{isEdit ? 'Update machine listing' : t('putMachineToWork')}</h2>
      <p>{t('newListingNote')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          onSubmit({
            name: f.get('name'),
            category: f.get('category'),
            village: f.get('village'),
            description: f.get('description'),
            rate: f.get('rate'),
            unit: f.get('unit'),
            mobilization: f.get('mobilization'),
            latitude: Number(f.get('latitude')),
            longitude: Number(f.get('longitude')),
            buffer_minutes: Number(f.get('buffer')),
            organization_id: f.get('organization') || null,
          });
        }}
      >
        <FormField label={t('machineNameModel')}>
          <input
            name="name"
            minLength="3"
            maxLength="100"
            defaultValue={initialData?.name || ''}
            required
          />
        </FormField>
        <div className="form-grid">
          <FormField label={t('categoryLabel')}>
            <select name="category" defaultValue={initialData?.category || 'Tractor'}>
              {['Tractor', 'Rotavator', 'Harvester', 'Seed drill', 'Sprayer', 'Cultivator'].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                )
              )}
            </select>
          </FormField>
          <FormField label={t('villageLabel')}>
            <input
              name="village"
              minLength="2"
              maxLength="100"
              defaultValue={initialData?.village || ''}
              required
            />
          </FormField>
        </div>
        <FormField label={t('specsLabel')}>
          <textarea
            name="description"
            maxLength="1000"
            placeholder={t('specsPlaceholder')}
            defaultValue={initialData?.description || ''}
          />
        </FormField>
        <div className="form-grid">
          <FormField label={t('rateLabel')}>
            <input
              name="rate"
              type="number"
              min="0.01"
              max="100000"
              step="0.01"
              defaultValue={initialData?.rate || ''}
              required
            />
          </FormField>
          <FormField label={t('pricingUnit')}>
            <select name="unit" defaultValue={initialData?.unit || 'hour'}>
              <option value="hour">{t('perHour')}</option>
              <option value="acre">{t('perAcre')}</option>
            </select>
          </FormField>
          <FormField label={t('mobilizationLabel') + ' (₹)'}>
            <input
              name="mobilization"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              defaultValue={initialData?.mobilization ?? 0}
              required
            />
          </FormField>
          <FormField label={t('bufferLabel')}>
            <input
              name="buffer"
              type="number"
              min="0"
              max="180"
              defaultValue={initialData?.buffer_minutes ?? 15}
              required
            />
          </FormField>
          <FormField label={t('latitudeLabel')}>
            <input
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              defaultValue={initialData?.latitude ?? 30.901}
              required
            />
          </FormField>
          <FormField label={t('longitudeLabel')}>
            <input
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              defaultValue={initialData?.longitude ?? 75.857}
              required
            />
          </FormField>
        </div>
        <FormField label={t('orgOptional')}>
          <select name="organization" defaultValue={initialData?.organization_id || ''}>
            <option value="">{t('independentOwner')}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </FormField>
        <button className="primary full" disabled={busy}>
          {isEdit ? 'Save Changes' : t('publishListingBtn')}{' '}
          {isEdit ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </form>
    </>
  );
}

