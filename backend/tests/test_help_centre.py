import os,base64
from io import BytesIO
from uuid import uuid4
import pytest
from PIL import Image
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Disposable PostGIS database required')

def test_general_ticket_idempotency_evidence_and_staff_states(pilot):
 people,m,p,db=pilot; farmer=people['farmer'][0];other=people['stranger'][0];staff=people['staff'][0]
 buf=BytesIO();Image.new('RGB',(20,20),'green').save(buf,format='PNG')
 body={'subject':'Account help','kind':'ACCOUNT','description':'Please help update my account details.','request_key':str(uuid4()),'photos':[base64.b64encode(buf.getvalue()).decode()]}
 r=farmer.post('/api/support',json=body);assert r.status_code==200,r.text
 row=r.json();ident=row['id'];assert row['booking_id'] is None
 assert farmer.post('/api/support',json=body).json()['id']==ident
 assert len(farmer.get('/api/support?limit=1&offset=0').json())==1
 assert farmer.get('/api/support?limit=1&offset=1').json()==[]
 assert other.get('/api/support').json()==[]
 evidence='/api/help-evidence/support/'+ident
 assert other.get(evidence).status_code==403
 photo=farmer.get(evidence).json()[0]['id']
 assert other.get(evidence+'/'+photo).status_code==403
 assert staff.get(evidence+'/'+photo).headers['content-type']=='image/jpeg'
 for status in ['AWAITING_RESPONSE','CLOSED']:
  assert staff.post('/api/admin/support/'+ident,json={'status':status,'resolution':'Please review this account update.'}).status_code==200
 assert farmer.post('/api/support/'+ident+'/messages',json={'body':'A new reply'}).status_code==409
 assert farmer.post('/api/support',json={**body,'request_key':str(uuid4()),'photos':['invalid']}).status_code==422
 assert farmer.post('/api/support',json={**body,'request_key':str(uuid4()),'subject':''}).status_code==422

def test_general_report_privacy_validation_and_closed_state(pilot):
 people,m,p,db=pilot;farmer=people['farmer'][0];other=people['stranger'][0];staff=people['staff'][0]
 body={'reason':'DISPUTE','description':'Please investigate this rental dispute.','request_key':str(uuid4())}
 r=farmer.post('/api/content-reports',json=body);assert r.status_code==200,r.text
 ident=r.json()['id'];assert farmer.post('/api/content-reports',json=body).json()['id']==ident
 assert farmer.get('/api/content-reports?limit=1').json()[0]['id']==ident
 assert other.get('/api/help-evidence/reports/'+ident).status_code==403
 assert staff.post('/api/admin/content-reports/'+ident,json={'status':'CLOSED','resolution':'Reviewed the submitted information.'}).status_code==200
 assert farmer.post('/api/content-reports',json={**body,'request_key':str(uuid4()),'booking_id':str(uuid4())}).status_code==404
 assert farmer.get('/api/support?limit=1000').status_code==422
