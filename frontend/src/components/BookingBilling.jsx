import React from 'react';
import {INR} from '../locales';
import {hasFinalBill} from '../data/bookingWorkspace';

export function BookingBilling({booking:b}) {
 const final=hasFinalBill(b), unit=b.unit==='acre'?'acre':'hour';
 const amount=value=>value==null?'Not available':INR(value);
 const attachments=Array.isArray(b.selected_attachments)?b.selected_attachments:[];
 const extras=Array.isArray(b.additional_charges)?b.additional_charges:[];
 return <section className="booking-billing" aria-label="Rental billing breakdown">
  <h4>Rental costs & meter readings</h4>
  <div className="booking-cost-totals"><div><span>Estimated total</span><strong>{amount(b.estimate)}</strong><small>Based on {b.quantity ?? '—'} {unit}{Number(b.quantity)===1?'':'s'}</small></div><div><span>Final total</span><strong>{final?amount(b.final_total):'Not finalized'}</strong><small>{final?`Confirmed usage: ${b.actual_quantity ?? '—'} ${unit}(s)`:'Calculated after confirmed return'}</small></div></div>
  <dl className="booking-charge-lines">
   <div><dt>Equipment rate</dt><dd>{amount(b.rate)} / {unit}</dd></div>
   {attachments.map((a,i)=><div key={i}><dt>{a.name || 'Attachment'}</dt><dd>{amount(a.rate)} / {unit}</dd></div>)}
   <div><dt>Fuel</dt><dd>{b.fuel_included?`${amount(b.fuel_extra ?? 0)} / ${unit}`:'Not included — arrange with owner'}</dd></div>
   <div><dt>Operator</dt><dd>{b.operator_included?`${amount(b.operator_extra ?? 0)} / ${unit}`:'Not included — arrange separately'}</dd></div>
   <div><dt>Transport / mobilization</dt><dd>{amount(b.mobilization)} once</dd></div>
   {extras.map((x,i)=><div key={i}><dt>{x.description}</dt><dd>{amount(x.amount)} once</dd></div>)}
   <div><dt>Start meter</dt><dd>{b.meter_start==null?'Awaiting pickup':`${b.meter_start} hours`}</dd></div>
   <div><dt>End meter</dt><dd>{b.meter_end==null?'Awaiting return':`${b.meter_end} hours`}</dd></div>
  </dl>
  <p className="caption">Rental and included add-on rates apply per {unit}; transport and additional charges apply once. Totals come from the booking record. Payment is arranged outside YantraSetu.</p>
 </section>;
}
