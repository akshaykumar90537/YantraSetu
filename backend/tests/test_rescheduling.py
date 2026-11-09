import os
from datetime import datetime,timedelta
from uuid import uuid4
import pytest
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Disposable PostGIS database required')

def setup_booking(pilot):
    people,m,p,db=pilot
    farmer=people['farmer'][0];owner=people['owner'][0]
    result=farmer.post('/api/bookings',json=p);assert result.status_code==200,result.text
    b=result.json();assert owner.post('/api/bookings/'+b['id']+'/action',json={'action':'approve'}).status_code==200
    start=datetime.fromisoformat(p['start_at'])+timedelta(days=1)
    return b,{'start_at':start.isoformat(),'end_at':(start+timedelta(hours=3)).isoformat(),'reason':'Rain delayed field preparation'}

def test_reschedule_requires_counterparty_and_preserves_agreed_costs(pilot,mailbox):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    changes={'operator_rate_extra':100,'fuel_included':True,'fuel_rate_extra':50,'attachments':[{'name':'Trailer','rate':25}]}
    assert owner.patch('/api/machines/'+m['id'],json=changes).status_code==200
    p.update(fuel_included=True,selected_attachments=[{'name':'Trailer','rate':25}],expected_total=1650)
    quote=farmer.post('/api/quote',json=p).json();assert float(quote['total'])==1650 and float(quote['operator_rate'])==100
    assert farmer.post('/api/bookings',json={**p,'expected_total':1}).status_code==409
    b,dates=setup_booking(pilot);path='/api/bookings/'+b['id']+'/reschedules'
    assert owner.patch('/api/machines/'+m['id'],json={'rate':900,'operator_rate_extra':999}).status_code==200
    result=farmer.post(path,json=dates);assert result.status_code==200,result.text
    proposal=result.json();assert float(proposal['estimate'])==2475
    assert farmer.post(path,json=dates).status_code==409
    endpoint=path+'/'+proposal['id']
    assert farmer.post(endpoint,json={'action':'accept'}).status_code==403
    assert people['stranger'][0].post(endpoint,json={'action':'accept'}).status_code==403
    before=farmer.get('/api/bookings').json()[0];assert before['start_at']==b['start_at']
    accepted=owner.post(endpoint,json={'action':'accept'});assert accepted.status_code==200,accepted.text
    assert owner.post(endpoint,json={'action':'accept'}).status_code==200
    after=farmer.get('/api/bookings').json()[0]
    assert datetime.fromisoformat(after['start_at'])==datetime.fromisoformat(dates['start_at'])
    assert float(after['estimate'])==2475 and float(after['operator_extra'])==100
    # Accepted change releases the original slot. No new prices are substituted into the existing booking.
    original={**p,'idempotency_key':str(uuid4())};original.pop('expected_total')
    assert farmer.post('/api/bookings',json=original).status_code==200
    with db() as c:
        c.execute("UPDATE bookings SET start_at=now()-interval '1 minute',end_at=now()+interval '3 hours',reserved_until=now()+interval '3 hours 15 minutes' WHERE id=%s",(b['id'],))
    for stage,reading in [('start',100),('end',103)]:
        challenge=owner.post('/api/bookings/'+b['id']+'/meter/request',json={'stage':stage,'reading':reading})
        assert challenge.status_code==200,challenge.text
        proof={'challenge_id':challenge.json()['challenge_id'],'code':mailbox['farmer@pilot.test']}
        confirmed=farmer.post('/api/bookings/'+b['id']+'/meter/confirm',json=proof)
        assert confirmed.status_code==200,confirmed.text
    invoice=farmer.get('/api/bookings/'+b['id']+'/invoice').json()
    assert float(invoice['breakdown']['total'])==2475
    assert float(invoice['booking']['final_total'])==2475

def test_conflict_at_acceptance_keeps_original_reservation(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    b,dates=setup_booking(pilot);path='/api/bookings/'+b['id']+'/reschedules'
    proposal=farmer.post(path,json=dates).json()
    competing={**p,**{k:dates[k] for k in ['start_at','end_at']},'idempotency_key':str(uuid4())}
    assert people['stranger'][0].post('/api/bookings',json=competing).status_code==200
    assert owner.post(path+'/'+proposal['id'],json={'action':'accept'}).status_code==409
    assert farmer.get('/api/bookings').json()[0]['start_at']==b['start_at']
    assert farmer.post(path+'/'+proposal['id'],json={'action':'withdraw'}).status_code==200
    assert farmer.post(path,json=dates).status_code==409

def test_owner_proposal_rejection_maintenance_and_started_booking(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    b,dates=setup_booking(pilot);path='/api/bookings/'+b['id']+'/reschedules'
    proposal=owner.post(path,json=dates).json()
    assert farmer.post(path+'/'+proposal['id'],json={'action':'reject'}).status_code==200
    assert farmer.get('/api/bookings').json()[0]['start_at']==b['start_at']
    assert owner.post('/api/machines/'+m['id']+'/maintenance',json=dates).status_code==200
    assert farmer.post(path,json=dates).status_code==409
    with db() as c:c.execute("UPDATE bookings SET status='IN_PROGRESS' WHERE id=%s",(b['id'],))
    assert farmer.post(path,json=dates).status_code==409

def test_operator_conflict_is_rechecked_on_acceptance(pilot):
    people,m,p,db=pilot;farmer=people['farmer'][0];owner=people['owner'][0]
    b,dates=setup_booking(pilot)
    with db() as c:c.execute("UPDATE users SET roles=ARRAY['operator'] WHERE phone='+919000000003'")
    assert owner.post('/api/bookings/'+b['id']+'/operator',json={'phone':'+919000000003'}).status_code==200
    path='/api/bookings/'+b['id']+'/reschedules';proposal=farmer.post(path,json=dates).json()
    other=owner.post('/api/machines',json={'name':'Second machine','category':'Tractor','village':'Test','latitude':30,'longitude':75,'rate':700,'unit':'hour'}).json()
    result=farmer.post('/api/bookings',json={**p,**{k:dates[k] for k in ['start_at','end_at']},'machine_id':other['id'],'idempotency_key':str(uuid4())})
    other_id=result.json()['id'];assert owner.post('/api/bookings/'+other_id+'/action',json={'action':'approve'}).status_code==200
    assert owner.post('/api/bookings/'+other_id+'/operator',json={'phone':'+919000000003'}).status_code==200
    assert owner.post(path+'/'+proposal['id'],json={'action':'accept'}).status_code==409
