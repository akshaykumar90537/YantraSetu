import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommunityResponse as check} from './communityResponse.js';
test('rejects the array response that crashed equipment demand',()=>{assert.throws(()=>check('/demand',[]),/unexpected response/);assert.throws(()=>check('/demand',{mine:[]}),/unexpected response/)});
test('accepts genuine empty and populated demand responses',()=>{for(const d of [{mine:[],summary:[]},{mine:[{id:'test'}],summary:[{requests:1}]}])assert.equal(check('/demand',d),d)});
test('rejects malformed preferences, capabilities and list responses',()=>{for(const [p,d] of [['/notification-preferences',[]],['/capabilities',{}],['/support',null],['/content-reports',{}]])assert.throws(()=>check(p,d))});
test('preserves valid preferences, capability and empty case lists',()=>{assert.deepEqual(check('/notification-preferences',{reminders:false}),{reminders:false});assert.deepEqual(check('/capabilities',{admin:false}),{admin:false});assert.deepEqual(check('/support',[]),[])});
