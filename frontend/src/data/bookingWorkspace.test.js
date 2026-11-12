import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingFilters,matchesBookingFilter,hasFinalBill} from './bookingWorkspace.js';

test('every stored rental status stays reachable through exactly one status filter',()=>{
 const rows=['PENDING','APPROVED','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED'].map(status=>({status}));
 assert.equal(rows.filter(b=>matchesBookingFilter(b,'ALL')).length,6);
 for(const row of rows){assert.equal(bookingFilters.filter(f=>f.id!=='ALL'&&matchesBookingFilter(row,f.id)).length,1);}
 assert.equal(matchesBookingFilter({status:'APPROVED'},'PENDING'),false);
});
test('final totals require completed confirmation, and zero is a valid recorded bill',()=>{
 assert.equal(hasFinalBill({status:'COMPLETED',final_total:'0.00'}),true);
 assert.equal(hasFinalBill({status:'COMPLETED',final_total:0}),true);
 assert.equal(hasFinalBill({status:'IN_PROGRESS',final_total:500}),false);
 assert.equal(hasFinalBill({status:'CANCELLED',final_total:500}),false);
 assert.equal(hasFinalBill({status:'COMPLETED',final_total:null}),false);
 assert.equal(hasFinalBill({status:'COMPLETED'}),false);
});
