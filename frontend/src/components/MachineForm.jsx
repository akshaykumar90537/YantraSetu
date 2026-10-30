import React, { useState } from 'react';
import { Plus, Check, Wrench, Fuel, X } from 'lucide-react';
import { FormField } from './Common';
import { INR, translate } from '../locales';

const PRESET_ATTACHMENTS = [
  { name: 'Rotavator', defaultRate: 250 },
  { name: 'Disc Harrow', defaultRate: 200 },
  { name: 'Cultivator', defaultRate: 150 },
  { name: 'Trolley', defaultRate: 150 },
  { name: 'Laser Leveller', defaultRate: 350 },
  { name: 'Seed Drill', defaultRate: 200 },
  { name: 'Straw Reaper', defaultRate: 400 },
  { name: 'Baler', defaultRate: 500 },
];

export function MachineForm({ orgs = [], busy, onSubmit, initialData = null, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const isEdit = Boolean(initialData);

  const [attachments, setAttachments] = useState(
    Array.isArray(initialData?.attachments) ? initialData.attachments : []
  );
  const [fuelIncluded, setFuelIncluded] = useState(Boolean(initialData?.fuel_included));
  const [fuelRateExtra, setFuelRateExtra] = useState(initialData?.fuel_rate_extra ?? 180);
  const [customAttName, setCustomAttName] = useState('');
  const [customAttRate, setCustomAttRate] = useState('');

  function addPresetAttachment(preset) {
    if (attachments.some((a) => a.name.toLowerCase() === preset.name.toLowerCase())) return;
    setAttachments([...attachments, { name: preset.name, rate: preset.defaultRate }]);
  }

  function addCustomAttachment() {
    if (!customAttName.trim()) return;
    setAttachments([
      ...attachments,
      { name: customAttName.trim(), rate: Number(customAttRate) || 200 },
    ]);
    setCustomAttName('');
    setCustomAttRate('');
  }

  function removeAttachment(index) {
    setAttachments(attachments.filter((_, i) => i !== index));
  }

  function updateAttachmentRate(index, newRate) {
    const updated = [...attachments];
    updated[index].rate = Number(newRate) || 0;
    setAttachments(updated);
  }

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
            attachments,
            fuel_included: fuelIncluded,
            fuel_rate_extra: fuelIncluded ? Number(fuelRateExtra) : 0,
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
            placeholder="e.g. Mahindra 575 DI (45 HP)"
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
              placeholder="e.g. Khanna, Ludhiana"
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

        {/* Implement Attachments Configuration */}
        <div style={{
          background: '#f8fafc',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Wrench size={16} color="#1b5e20" />
            <span>{t('attachmentsLabel')} (Optional Implement Add-ons)</span>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
            Add attachments that farmers can rent alongside this machine with extra hourly/acre rates.
          </p>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', fontWeight: '600' }}>Add Presets:</span>
            {PRESET_ATTACHMENTS.map((preset) => {
              const alreadyAdded = attachments.some(
                (a) => a.name.toLowerCase() === preset.name.toLowerCase()
              );
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => addPresetAttachment(preset)}
                  style={{
                    background: alreadyAdded ? '#f1f5f9' : '#fff',
                    color: alreadyAdded ? '#94a3b8' : '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  +{preset.name} (+₹{preset.defaultRate})
                </button>
              );
            })}
          </div>

          {/* Configured Attachments List */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <span style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>{att.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Rate (+₹/unit):</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={att.rate}
                      onChange={(e) => updateAttachmentRate(idx, e.target.value)}
                      style={{ width: '80px', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom Attachment Input */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Custom attachment name"
              value={customAttName}
              onChange={(e) => setCustomAttName(e.target.value)}
              style={{ flex: 2, padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="number"
              placeholder="Extra Rate (₹)"
              value={customAttRate}
              onChange={(e) => setCustomAttRate(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <button
              type="button"
              onClick={addCustomAttachment}
              style={{
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Fuel (Diesel) Policy */}
        <div style={{
          background: '#fefce8',
          padding: '14px 16px',
          borderRadius: '10px',
          border: '1px solid #fef08a',
          marginBottom: '16px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#854d0e' }}>
            <input
              type="checkbox"
              checked={fuelIncluded}
              onChange={(e) => setFuelIncluded(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#ca8a04' }}
            />
            <Fuel size={16} />
            <span>{t('dieselAvailableExtra')} (Owner provides diesel upon farmer request)</span>
          </label>
          {fuelIncluded && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#713f12', fontWeight: '600' }}>Extra diesel rate:</span>
              <input
                type="number"
                min="0"
                step="10"
                value={fuelRateExtra}
                onChange={(e) => setFuelRateExtra(e.target.value)}
                style={{ width: '100px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #fde047' }}
              />
              <span style={{ fontSize: '12px', color: '#713f12' }}>₹ / hour</span>
            </div>
          )}
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
