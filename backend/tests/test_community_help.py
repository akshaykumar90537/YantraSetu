import os
from uuid import uuid4
from datetime import datetime,timezone,timedelta
import pytest
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Disposable PostGIS database required')

def test_support_messages_privacy_history_and_resolution(pilot):
 people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0];staff=people['staff'][0];other=people['stranger'][0]
 bid=farmer.post('/api/bookings',json=p).json()['id']
 case=farmer.post('/api/support',json={'booking_id':bid,'kind':'BILLING','description':'Please review the agreed rental charge.'}).json()
 path='/api/support/'+case['id']+'/messages'
 for client in [owner,other]:
  assert client.get(path).status_code==403
  assert client.post(path,json={'body':'Unauthorized reply'}).status_code==403
 assert farmer.post(path,json={'body':'The agreed amount is on the invoice.'}).status_code==200
 assert staff.post('/api/admin/support/'+case['id'],json={'status':'IN_REVIEW','resolution':'We are checking the rental record.'}).status_code==200
 assert staff.post(path,json={'body':'Please confirm the booking dates.'}).status_code==200
 assert staff.post('/api/admin/support/'+case['id'],json={'status':'RESOLVED','resolution':'The invoice matches the agreed rates.'}).status_code==200
 rows=farmer.get(path).json();assert len(rows)==4 and rows[-1]['status']=='RESOLVED'
 assert all('author_id' not in r for r in rows)
 assert farmer.post(path,json={'body':'Another message'}).status_code==409
 assert farmer.get('/api/support').json()[0]['machine_name']==m['name']
 assert any('Support case' in n['message'] for n in farmer.get('/api/notifications').json())

def test_listing_reports_private_staff_review_and_duplicates(pilot):
 people,m,p,db=pilot;farmer=people['farmer'][0];staff=people['staff'][0];owner=people['owner'][0]
 body={'machine_id':m['id'],'reason':'MISLEADING','description':'The listing description misrepresents this machine.'}
 r=farmer.post('/api/content-reports',json=body);assert r.status_code==200,r.text
 ident=r.json()['id'];path='/api/admin/content-reports/'+ident
 assert farmer.post('/api/content-reports',json=body).status_code==409
 assert owner.get('/api/content-reports').json()==[]
 assert owner.get('/api/admin/content-reports').status_code==403
 assert owner.post(path,json={'status':'RESOLVED','resolution':'Dismissed by owner'}).status_code==403
 assert staff.get('/api/admin/content-reports').json()[0]['id']==ident
 assert staff.post(path,json={'status':'RESOLVED','resolution':'Reviewed and contacted the listing owner.'}).status_code==200
 assert farmer.get('/api/content-reports').json()[0]['status']=='RESOLVED'
 assert farmer.post('/api/content-reports',json=body).status_code==200
 assert staff.post(path,json={'status':'OPEN','resolution':'Reopening old report'}).status_code==409
 assert farmer.post('/api/content-reports',json={**body,'machine_id':str(uuid4())}).status_code==404
 assert farmer.post('/api/content-reports',json={**body,'description':'   '}).status_code==422

def test_unavailable_equipment_requests_are_owned_and_private(pilot):
 people,m,p,db=pilot;farmer=people['farmer'][0];other=people['stranger'][0];owner=people['owner'][0]
 body={'village':'My village','category':'Harvester','needed_at':p['start_at'],'notes':'Private field details'}
 assert owner.post('/api/demand',json=body).status_code==403
 r=farmer.post('/api/demand',json=body);assert r.status_code==200,r.text
 ident=r.json()['id']
 summary=owner.get('/api/demand').json();assert summary['mine']==[] and summary['summary'][0]['category']=='Harvester'
 assert 'Private field details' not in str(summary)
 assert other.post('/api/demand/'+ident+'/close',json={}).status_code==404
 assert farmer.post('/api/demand/'+ident+'/close',json={}).status_code==200
 assert owner.get('/api/demand').json()['summary']==[]
 assert farmer.post('/api/demand',json={**body,'needed_at':(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()}).status_code==422
