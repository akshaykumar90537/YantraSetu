import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';

test('rental cards expose only stage-appropriate actions and stored billing',async()=>{
 // BookingForms import Leaflet, but no map is mounted by these card renders.
 const mapStub={name:'unmounted-map-test-stub',enforce:'pre',resolveId(id){if(id==='leaflet')return '\0test-leaflet';},load(id){if(id==='\0test-leaflet')return 'export default {}';}};
 const server=await createServer({plugins:[mapStub],ssr:{noExternal:['leaflet']},optimizeDeps:{noDiscovery:true,include:[]},root:fileURLToPath(new URL('../../',import.meta.url)),server:{middlewareMode:true},appType:'custom'});
 try {
  const {BookingCard}=await server.ssrLoadModule('/src/components/BookingCard.jsx');
  const base={id:'test-booking',owner_id:'owner',farmer_id:'farmer',machine_name:'Test tractor',village:'Test village',owner_name:'Test owner',owner_phone:'9999999999',rate:'500',quantity:'2',unit:'hour',mobilization:'200',estimate:'1200',meter_start:null,meter_end:null,final_total:null,start_at:'2026-12-01T08:00:00Z',end_at:'2026-12-01T10:00:00Z'};
  const render=(status,role='farmer',extra={})=>renderToStaticMarkup(React.createElement(BookingCard,{booking:{...base,status,...extra},user:{id:role,roles:[role]},run:()=>{},load:()=>{},setModal:()=>{},notify:()=>{}}));
  const pending=render('PENDING');
  assert.match(pending,/Test tractor/);assert.match(pending,/Test owner/);assert.match(pending,/Estimated total/);assert.match(pending,/Not finalized/);assert.match(pending,/Cancel/);assert.doesNotMatch(pending,/href="tel:/);assert.doesNotMatch(pending,/Verify pickup OTP/);
  const confirmed=render('APPROVED');assert.match(confirmed,/Verify pickup OTP/);assert.match(confirmed,/href="tel:9999999999"/);assert.match(confirmed,/aria-current="step"/);
  const ongoing=render('IN_PROGRESS','farmer',{meter_start:'100'});assert.match(ongoing,/Verify return OTP/);assert.match(ongoing,/100 hours/);assert.doesNotMatch(ongoing,/>Cancel</);
  const completed=render('COMPLETED','farmer',{meter_start:'100',meter_end:'102',actual_quantity:'2',final_total:'1200'});assert.match(completed,/Rate Owner &amp; Equipment/);assert.match(completed,/102 hours/);assert.doesNotMatch(completed,/Not finalized/);assert.doesNotMatch(completed,/Verify return OTP/);
  for(const status of ['CANCELLED','REJECTED']) {const html=render(status);assert.doesNotMatch(html,/Verify (pickup|return) OTP/);assert.doesNotMatch(html,/Rate Owner &amp; Equipment/);}
  assert.match(render('APPROVED','owner'),/Start pickup/);assert.match(render('IN_PROGRESS','owner'),/Start return/);
  assert.match(pending,/Report a problem/);
 } finally {await server.close();}
});
