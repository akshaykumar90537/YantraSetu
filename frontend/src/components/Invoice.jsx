import React from 'react';
import { Sprout, Printer, ShieldCheck, CheckCircle2, Clock, MapPin, Phone, User, Calendar, Wrench, Fuel } from 'lucide-react';
import { INR, dt, translate } from '../locales';

export function Invoice({ data, lang = 'en' }) {
  const t = (k, p) => translate(lang, k, p);
  const b = data.booking || {};
  const breakdown = data.breakdown || {};
  const owner = data.owner || {};
  const farmer = data.farmer || {};
  const attachments = Array.isArray(breakdown.selected_attachments) ? breakdown.selected_attachments : (b.selected_attachments || []);

  return (
    <div className="printable-invoice-container" style={{ maxWidth: '680px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Embedded Print Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-invoice-container, .printable-invoice-container * {
            visibility: visible;
          }
          .printable-invoice-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 20px !important;
            background: #fff !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Action Bar (hidden in print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <ShieldCheck size={16} /> Verified Rental Settlement Record
        </span>
        <button
          type="button"
          className="primary"
          onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
        >
          <Printer size={15} />
          <span>{t('printPdfBtn')}</span>
        </button>
      </div>

      {/* Invoice Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '24px 28px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #15803d', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d' }}>
              <div style={{ background: '#15803d', color: '#fff', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                <Sprout size={24} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', color: '#14532d' }}>YantraSetu</h1>
                <small style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Agricultural Machinery Sharing Platform
                </small>
              </div>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
              ਪੰਜਾਬ ਪਾਇਲਟ · ਪੇਂਡੂ ਖੇਤੀਬਾੜੀ ਸਹਿਕਾਰ · पंजाब पायलट
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{
              background: '#dcfce7',
              color: '#166534',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
            }}>
              ✓ {b.status}
            </span>
            <h3 style={{ margin: '6px 0 2px', fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>
              {data.invoice_number || `YS-INV-${(b.id || '').slice(0, 8).toUpperCase()}`}
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Parties Grid (Owner & Farmer) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          
          {/* Owner Box */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Machine Owner (ਮਾਲਕ / मालिक)
            </span>
            <h4 style={{ margin: '4px 0 2px', fontSize: '15px', color: '#1e293b' }}>
              {owner.name || b.owner_name || 'Machine Owner'}
            </h4>
            <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} /> {owner.phone || b.owner_phone || 'Registered Owner'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <MapPin size={12} /> Village Depot: {b.village}
            </div>
          </div>

          {/* Farmer Box */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Renter / Farmer (ਕਿਸਾਨ / किसान)
            </span>
            <h4 style={{ margin: '4px 0 2px', fontSize: '15px', color: '#1e293b' }}>
              {farmer.name || b.farmer_name || 'Farmer'}
            </h4>
            <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} /> {farmer.phone || b.farmer_phone || 'Registered Farmer'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <MapPin size={12} /> Field: {Number(b.latitude).toFixed(4)}, {Number(b.longitude).toFixed(4)}
            </div>
          </div>
        </div>

        {/* Work Timeline & Meter Hours Verification Box */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={14} /> Verified Hour-Meter & Work Schedule
            </span>
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
              {dt(b.start_at)} → {dt(b.end_at)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <small style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Initial Meter</small>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>{b.meter_start ? `${b.meter_start} hrs` : 'N/A'}</strong>
            </div>
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <small style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Final Meter</small>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>{b.meter_end ? `${b.meter_end} hrs` : 'N/A'}</strong>
            </div>
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
              <small style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Net Work Billed</small>
              <strong style={{ fontSize: '14px', color: '#15803d' }}>
                {b.actual_quantity || b.quantity} {b.unit === 'hour' ? t('perHour') : t('perAcre')}
              </strong>
            </div>
          </div>
        </div>

        {/* Itemized Billing Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '700' }}>Item Description</th>
              <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '700', textAlign: 'center' }}>Unit Rate</th>
              <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '700', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '8px 10px', color: '#475569', fontWeight: '700', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px' }}>
                <strong>{b.machine_name}</strong>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Base machine rental ({b.machine_category || 'Tractor'})</div>
              </td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{INR(b.rate)}/{b.unit}</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{b.actual_quantity || b.quantity}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                {INR(breakdown.base_rental || breakdown.rental)}
              </td>
            </tr>

            {/* Attachments if any */}
            {attachments.map((att, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                    <Wrench size={13} color="#15803d" /> Implement: {att.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Selected implement add-on</div>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>+{INR(att.rate)}/{b.unit}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{b.actual_quantity || b.quantity}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                  +{INR(Number(att.rate) * Number(b.actual_quantity || b.quantity))}
                </td>
              </tr>
            ))}

            {/* Fuel option if selected */}
            {(breakdown.fuel_included || b.fuel_included) && Number(b.fuel_extra || breakdown.fuel_extra) > 0 && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                    <Fuel size={13} color="#d97706" /> Fuel (Diesel) Provided by Owner
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Full tank diesel service</div>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>+{INR(b.fuel_extra || breakdown.fuel_extra)}/hr</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{b.actual_quantity || b.quantity}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                  +{INR(Number(b.fuel_extra || breakdown.fuel_extra) * Number(b.actual_quantity || b.quantity))}
                </td>
              </tr>
            )}

            {/* Mobilization */}
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px' }}>
                <strong>Mobilization / Machine Dispatch</strong>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Depot travel to farmer field</div>
              </td>
              <td style={{ padding: '10px', textAlign: 'center' }}>Fixed</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>1</td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>
                {INR(breakdown.mobilization || b.mobilization)}
              </td>
            </tr>

            {/* Total Row */}
            <tr style={{ background: '#f8fafc', fontSize: '16px', fontWeight: '800' }}>
              <td colSpan="3" style={{ padding: '12px 10px', textAlign: 'right', color: '#1e293b' }}>
                Total Payable (ਕੁੱਲ ਰਕਮ):
              </td>
              <td style={{ padding: '12px 10px', textAlign: 'right', color: '#15803d' }}>
                {INR(breakdown.total || b.final_total || b.estimate)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Settlement Status & Compliance Box */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#92400e' }}>
              Outside-Platform Settlement Status:
            </span>
            <span style={{
              background: b.payment_status === 'PAID_OUTSIDE_PLATFORM' ? '#dcfce7' : '#fee2e2',
              color: b.payment_status === 'PAID_OUTSIDE_PLATFORM' ? '#166534' : '#991b1b',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
            }}>
              {t(b.payment_status) || b.payment_status}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#78350f', lineHeight: '1.4' }}>
            {data.notice || t('complianceDisclaimer')}
          </p>
        </div>

        {/* Signatures Line */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
          <div>
            <div style={{ borderBottom: '1px solid #cbd5e1', height: '30px', marginBottom: '4px' }}></div>
            <span>Farmer / Renter Signature</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ borderBottom: '1px solid #cbd5e1', height: '30px', marginBottom: '4px' }}></div>
            <span>Machine Owner Signature</span>
          </div>
        </div>

      </div>
    </div>
  );
}
