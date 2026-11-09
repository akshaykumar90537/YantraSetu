import os,base64
from io import BytesIO
from PIL import Image
import pytest
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Disposable PostGIS database required')

def rental(pilot):
 people,m,p,db=pilot
 farmer=people['farmer'][0];owner=people['owner'][0]
 r=farmer.post('/api/bookings',json=p);assert r.status_code==200,r.text
 bid=r.json()['id'];assert owner.post(f'/api/bookings/{bid}/action',json={'action':'approve'}).status_code==200
 with db() as c:c.execute("UPDATE bookings SET start_at=now()-interval '1 minute',end_at=now()+interval '2 hours',reserved_until=now()+interval '3 hours' WHERE id=%s",(bid,))
 return farmer,owner,'/api/bookings/'+bid

def photo():
 out=BytesIO();Image.new('RGB',(20,20),'green').save(out,'PNG');return base64.b64encode(out.getvalue()).decode()

def test_confirmed_evidence_charges_and_private_photos(pilot,mailbox):
 people,m,p,db=pilot;farmer,owner,path=rental(pilot)
 for stage,reading in [('start',0),('end',2)]:
  body={'stage':stage,'reading':reading,'condition':'Left fender scratched','photos':[photo()]}
  if stage=='end':body['additional_charges']=[{'description':'Agreed extra delivery trip','amount':'125.50'}]
  r=owner.post(path+'/meter/request',json=body);assert r.status_code==200,r.text
  proof={'challenge_id':r.json()['challenge_id'],'code':mailbox['farmer@pilot.test']}
  pending=farmer.get(path+'/meter/pending').json()[0]['payload'];assert pending['condition']==body['condition']
  photo_path=path+'/evidence-photos/'+pending['photo_ids'][0]
  assert people['stranger'][0].get(photo_path).status_code==403
  img=farmer.get(photo_path);assert img.status_code==200
  with Image.open(BytesIO(img.content)) as im:assert im.format=='JPEG' and not im.getexif()
  assert owner.post(path+'/meter/confirm',json=proof).status_code==403
  done=farmer.post(path+'/meter/confirm',json=proof);assert done.status_code==200,done.text
  assert farmer.post(path+'/meter/confirm',json=proof).status_code==400
 rows=farmer.get(path+'/handover-records').json()
 assert len(rows)==2 and all(r['confirmation_status']=='CONFIRMED' for r in rows)
 assert all(r['submitted_by']==people['owner'][1]['id'] and r['confirmed_by']==people['farmer'][1]['id'] for r in rows)
 invoice=farmer.get(path+'/invoice').json()
 assert float(invoice['breakdown']['total'])==1425.50
 assert float(invoice['booking']['final_total'])==1425.50
 assert invoice['breakdown']['additional_charges'][0]['description']=='Agreed extra delivery trip'
 assert people['stranger'][0].get(path+'/handover-records').status_code==403

def test_replacement_expiry_and_validation(pilot,mailbox):
 people,m,p,db=pilot;farmer,owner,path=rental(pilot)
 assert farmer.post(path+'/meter/request',json={'stage':'start','reading':0}).status_code==403
 for body in [dict(stage='start',reading=0,photos=['invalid']),dict(stage='start',reading=0,additional_charges=[dict(description='Extra trip',amount=2)])]:
  assert owner.post(path+'/meter/request',json=body).status_code==422
 first=owner.post(path+'/meter/request',json={'stage':'start','reading':1}).json();code=mailbox['farmer@pilot.test']
 second=owner.post(path+'/meter/request',json={'stage':'start','reading':2}).json()
 assert farmer.post(path+'/meter/confirm',json={'challenge_id':first['challenge_id'],'code':code}).status_code==400
 assert len(farmer.get(path+'/meter/pending').json())==1
 with db() as c:c.execute("UPDATE challenges SET expires_at=now()-interval '1 second' WHERE id=%s",(second['challenge_id'],))
 assert farmer.post(path+'/meter/confirm',json={'challenge_id':second['challenge_id'],'code':mailbox['farmer@pilot.test']}).status_code==400
 rows=farmer.get(path+'/handover-records').json();assert {r['confirmation_status'] for r in rows}=={'SUPERSEDED','EXPIRED'}

def test_failed_codes_lock_and_cannot_change_booking(pilot,mailbox):
 people,m,p,db=pilot;farmer,owner,path=rental(pilot)
 r=owner.post(path+'/meter/request',json={'stage':'start','reading':0}).json();code=mailbox['farmer@pilot.test']
 wrong='000000' if code!='000000' else '111111'
 for _ in range(5):assert farmer.post(path+'/meter/confirm',json={'challenge_id':r['challenge_id'],'code':wrong}).status_code==400
 assert farmer.post(path+'/meter/confirm',json={'challenge_id':r['challenge_id'],'code':code}).status_code==400
 assert farmer.get('/api/bookings').json()[0]['status']=='APPROVED'
 assert farmer.get(path+'/handover-records').json()[0]['confirmed_at'] is None


def test_email_preferred_when_phone_present_and_delivery_failure_rolls_back(pilot,mailbox,monkeypatch):
 from app import main
 from fastapi import HTTPException
 people,m,p,db=pilot;farmer,owner,path=rental(pilot)
 with db() as c:c.execute("UPDATE users SET phone='+919876543219' WHERE id=%s",(people['farmer'][1]['id'],))
 r=owner.post(path+'/meter/request',json={'stage':'start','reading':0});assert r.status_code==200,r.text
 proof={'challenge_id':r.json()['challenge_id'],'code':mailbox['farmer@pilot.test']}
 def fail(*args):raise HTTPException(503,'Email unavailable')
 monkeypatch.setattr(main,'send_email',fail)
 replacement=owner.post(path+'/meter/request',json={'stage':'start','reading':1})
 assert replacement.status_code==503
 assert len(farmer.get(path+'/handover-records').json())==1
 assert farmer.post(path+'/meter/confirm',json=proof).status_code==200
 assert owner.post(path+'/meter/request',json={'stage':'end','reading':0}).status_code==422
 for amount in ['-1','0','1.001','NaN']:
  assert owner.post(path+'/meter/request',json={'stage':'end','reading':2,'additional_charges':[{'description':'Extra trip','amount':amount}]}).status_code==422
