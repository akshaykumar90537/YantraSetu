"""Real PostGIS tests: privacy, persistence and transitions for pilot operations."""
import os, base64
from io import BytesIO
from uuid import uuid4
from contextlib import contextmanager
from datetime import datetime,timezone,timedelta
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row
from PIL import Image
from test_postgres import database,mailbox,sign_in
from app import main
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Requires disposable PostGIS database')

@pytest.fixture
def pilot(database,mailbox,monkeypatch):
    connect,*_=database
    @contextmanager
    def isolated():
        with connect() as c:
            c.row_factory=dict_row
            yield c
    monkeypatch.setattr(main,'db',isolated)
    people={}
    for role in ['owner','farmer','fpo','stranger','staff']:
        client=TestClient(main.app,headers={'X-Requested-With':'YantraSetu'})
        user=sign_in(client,role+'@pilot.test',mailbox,name=role,roles=[role if role in ['owner','farmer','fpo'] else 'farmer'])
        people[role]=(client,user)
    monkeypatch.setenv('ADMIN_USER_IDS',people['staff'][1]['id'])
    output=BytesIO();Image.new('RGB',(40,40),'green').save(output,'PNG')
    photo=base64.b64encode(output.getvalue()).decode()
    response=people['owner'][0].post('/api/machines',json={'name':'Pilot tractor','category':'Tractor','village':'Kharar','latitude':30.74,'longitude':76.64,'rate':650,'unit':'hour','photos':[photo],'condition':'Good','horsepower':45,'transport_available':True})
    assert response.status_code==200,response.text
    start=datetime.now(timezone.utc)+timedelta(hours=6)
    payload={'machine_id':response.json()['id'],'start_at':start.isoformat(),'end_at':(start+timedelta(hours=2)).isoformat(),'latitude':30.74,'longitude':76.64,'idempotency_key':str(uuid4()),'contact_phone':'+919876543210'}
    return people,response.json(),payload,isolated

def test_photo_persistence_validation_and_moderation(pilot):
    people,m,p,db=pilot; owner=people['owner'][0];farmer=people['farmer'][0];staff=people['staff'][0]
    photo=m['photo_ids'][0]
    r=farmer.get('/api/photos/'+photo);assert r.status_code==200
    with Image.open(BytesIO(r.content)) as im:assert im.format=='JPEG' and not im.getexif()
    assert m['horsepower']==45 and m['condition']=='Good'
    r=owner.patch('/api/machines/'+m['id'],json={'photos':['not-an-image']})
    assert r.status_code==422,r.text
    assert farmer.get('/api/photos/'+photo).status_code==200
    assert farmer.post('/api/admin/machines/'+m['id'],json={'restricted':True,'reason':'Unsafe equipment'}).status_code==403
    assert staff.post('/api/admin/machines/'+m['id'],json={'restricted':True,'reason':'Unsafe equipment'}).status_code==200
    assert farmer.get('/api/photos/'+photo).status_code==404
    assert owner.get('/api/photos/'+photo).status_code==200
    assert farmer.post('/api/bookings',json=p).status_code==400
    assert farmer.get('/api/machines/'+m['id']).status_code==404

def test_expiry_releases_slot_and_is_idempotent(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    r=farmer.post('/api/bookings',json=p);assert r.status_code==200,r.text
    ident=r.json()['id']
    with db() as c:c.execute("UPDATE bookings SET response_due_at=now()-interval '1 second' WHERE id=%s",(ident,))
    r=owner.post('/api/bookings/'+ident+'/action',json={'action':'approve'})
    assert r.status_code==409,r.text
    records=farmer.get('/api/bookings').json();assert records[0]['status']=='CANCELLED'
    p['idempotency_key']=str(uuid4());assert farmer.post('/api/bookings',json=p).status_code==200
    with db() as c:assert c.execute("SELECT count(*) AS n FROM audit_log WHERE booking_id=%s AND action='REQUEST_EXPIRED'",(ident,)).fetchone()['n']==1

def test_travel_readiness_support_and_notifications(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0];stranger=people['stranger'][0];staff=people['staff'][0]
    ident=farmer.post('/api/bookings',json=p).json()['id']
    assert owner.post('/api/bookings/'+ident+'/action',json={'action':'approve'}).status_code==200
    assert farmer.post('/api/bookings/'+ident+'/travel',json={'status':'ARRIVED'}).status_code==403
    assert owner.post('/api/bookings/'+ident+'/travel',json={'status':'ARRIVED'}).status_code==200
    assert owner.post('/api/bookings/'+ident+'/travel',json={'status':'ON_THE_WAY'}).status_code==409
    assert owner.post('/api/bookings/'+ident+'/readiness',json={'machine_checked':True}).status_code==200
    body={'booking_id':ident,'kind':'BREAKDOWN','description':'The machine stopped unexpectedly.'}
    assert stranger.post('/api/support',json=body).status_code==403
    case=farmer.post('/api/support',json=body);assert case.status_code==200,case.text
    assert stranger.get('/api/support').json()==[]
    assert stranger.get('/api/admin/support').status_code==403
    assert staff.post('/api/admin/support/'+case.json()['id'],json={'status':'RESOLVED','resolution':'Owner replaced the machine.'}).status_code==200
    assert farmer.get('/api/support').json()[0]['resolution']=='Owner replaced the machine.'
    for _ in range(2):assert farmer.get('/api/notifications').status_code==200
    with db() as c:assert c.execute('SELECT count(*) AS n FROM reminder_receipts WHERE booking_id=%s AND user_id=%s',(ident,people['farmer'][1]['id'])).fetchone()['n']==1
    notifications=farmer.get('/api/notifications').json();note=notifications[0]
    assert stranger.post('/api/notifications/'+str(note['id'])+'/read',json={}).status_code==200
    assert farmer.get('/api/notifications').json()[0]['read_at'] is None
    farmer.post('/api/notifications/'+str(note['id'])+'/read',json={})
    assert farmer.get('/api/notifications').json()[0]['read_at'] is not None
    assert staff.get('/api/pilot-metrics').status_code==200
    assert owner.get('/api/fleet-utilization').status_code==200

def test_assistance_requires_consent_and_survives_revoke(pilot):
    people,m,p,db=pilot;farmer,fu=people['farmer'];fpo,cu=people['fpo'];owner=people['owner'][0]
    body={**p,'farmer_id':fu['id']}
    assert fpo.post('/api/assisted-bookings',json=body).status_code==403
    assert farmer.post('/api/delegations',json={'coordinator_id':cu['id']}).status_code==200
    assert fpo.post('/api/assisted-quote',json=body).status_code==200
    r=fpo.post('/api/assisted-bookings',json=body);assert r.status_code==200,r.text
    assert r.json()['farmer_id']==fu['id'] and r.json()['assisted_by']==cu['id']
    assert fpo.get('/api/bookings/'+r.json()['id']+'/farmer-contact').status_code==403
    assert farmer.delete('/api/delegations/'+cu['id']).status_code==200
    assert fpo.post('/api/assisted-bookings',json=body).status_code==403
    assert farmer.get('/api/bookings').json()[0]['id']==r.json()['id']
    assert owner.get('/api/bookings').json()[0]['id']==r.json()['id']

def test_group_membership_saved_demand_and_account_restriction(pilot):
    people,m,p,db=pilot;farmer,fu=people['farmer'];other=people['stranger'][0];staff=people['staff'][0]
    group=farmer.post('/api/rental-groups',json={'name':'Kharar collective'}).json()
    p['group_id']=group['id']
    assert other.post('/api/bookings',json=p).status_code==403
    r=farmer.post('/api/bookings',json=p);assert r.status_code==200,r.text
    assert other.get('/api/rental-groups').json()==[]
    assert other.post('/api/rental-groups/'+group['id']+'/join',json={}).status_code==200
    shared=other.get('/api/rental-groups').json()[0]['bookings'][0]
    assert 'farmer_id' not in shared and 'latitude' not in shared and 'contact_phone' not in shared
    assert farmer.post('/api/rental-groups/'+group['id']+'/leave',json={}).status_code==200
    assert farmer.get('/api/rental-groups').json()==[]
    assert other.get('/api/rental-groups').json()[0]['bookings']==[]
    assert farmer.post('/api/saved-machines/'+m['id'],json={}).status_code==200
    assert len(farmer.get('/api/saved-machines').json())==1
    assert other.get('/api/saved-machines').json()==[]
    assert farmer.post('/api/demand',json={'village':'Kharar','category':'Tractor','needed_at':p['start_at'],'notes':'Private note'}).status_code==200
    assert 'notes' not in other.get('/api/demand').json()['summary'][0]
    assert staff.post('/api/admin/users/'+fu['id'],json={'restricted':True,'reason':'Repeated unsafe behaviour'}).status_code==200
    assert farmer.get('/api/me').status_code==401

def test_prices_cannot_be_changed_by_client_and_reminders_can_be_disabled(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    with db() as c:c.execute('UPDATE machines SET attachments=%s WHERE id=%s',(main.Jsonb([{'name':'Trailer','rate':100}]),m['id']))
    tampered={**p,'selected_attachments':[{'name':'Trailer','rate':0}]}
    assert farmer.post('/api/quote',json=tampered).status_code==409
    assert farmer.post('/api/bookings',json=tampered).status_code==409
    assert farmer.post('/api/quote',json={**p,'fuel_included':True}).status_code==409
    p['selected_attachments']=[{'name':'Trailer','rate':100}]
    result=farmer.post('/api/bookings',json=p);assert result.status_code==200,result.text
    ident=result.json()['id'];assert float(result.json()['estimate'])==1500
    # A client retry across the migration must still find its pre-group booking.
    legacy_hash=main.hashlib.sha256(main.Booking(**p).model_dump_json(exclude={'group_id','expected_total'}).encode()).hexdigest()
    with db() as c:c.execute('UPDATE bookings SET request_hash=%s WHERE id=%s',(legacy_hash,ident))
    assert farmer.post('/api/bookings',json=p).json()['id']==ident
    assert farmer.post('/api/bookings',json={**p,'longitude':77}).status_code==409
    assert farmer.post('/api/notification-preferences',json={'reminders':False}).status_code==200
    assert owner.post('/api/bookings/'+ident+'/action',json={'action':'approve'}).status_code==200
    assert farmer.get('/api/notifications').status_code==200
    with db() as c:assert c.execute('SELECT count(*) AS n FROM reminder_receipts WHERE user_id=%s',(people['farmer'][1]['id'],)).fetchone()['n']==0
    assert farmer.post('/api/bookings/'+ident+'/action',json={'action':'cancel','reason':'Heavy rain on my field'}).status_code==200
    assert farmer.get('/api/bookings').json()[0]['closure_reason']=='Heavy rain on my field'

def test_unrelated_vercel_origin_cannot_change_data(pilot):
    people,m,p,db=pilot
    assert people['farmer'][0].post('/api/bookings',json=p,headers={'Origin':'https://unrelated-project.vercel.app'}).status_code==403

def test_unavailable_database_is_not_reported_as_healthy(monkeypatch):
    @contextmanager
    def unavailable():
        raise RuntimeError('private diagnostic that must not be exposed')
        yield
    monkeypatch.setattr(main,'db',unavailable)
    response=TestClient(main.app).get('/api/health')
    assert response.status_code==503
    assert 'private diagnostic' not in response.text
    assert response.headers.get('X-Request-ID')
