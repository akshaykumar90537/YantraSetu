import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesLocality,parseCurrentPlace,currentCoordinates} from './machineryLocation.js';
test('only matches the selected settlement, including formatted labels',()=>{assert.equal(matchesLocality({village:'Kharar, Punjab'},{name:'kharar'}),true);assert.equal(matchesLocality({village:'Nearby village'},{name:'Kharar'}),false);assert.equal(matchesLocality({village:'Kharar'},null),false);assert.equal(matchesLocality({village:'New Kharar'},{name:'Kharar'}),false)});
test('GPS address needs a real settlement, never a district fallback',()=>{assert.equal(parseCurrentPlace({address:{village:'Parta',state:'Haryana',country_code:'in'}},29,75).name,'Parta');assert.throws(()=>parseCurrentPlace({address:{county:'District',country_code:'in'}},29,75));assert.throws(()=>parseCurrentPlace({address:{town:'Other',country_code:'us'}},29,75))});
test('GPS requires a fresh fix and handles denial and poor accuracy',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition:(ok,fail,options)=>{assert.equal(options.maximumAge,0);fail({code:1})}}}});
 await assert.rejects(currentCoordinates(),/permission was denied/);
 navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:30,longitude:75,accuracy:5000}});
 await assert.rejects(currentCoordinates(),/too approximate/);
 navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:30,longitude:75,accuracy:20}});
 assert.equal((await currentCoordinates()).latitude,30);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
