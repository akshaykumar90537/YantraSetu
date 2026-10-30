"""Run only against a disposable PostgreSQL/PostGIS test database.
Requires TEST_DATABASE_URL. Each test gets an isolated schema; never truncates public.
"""
import os
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
import psycopg
DSN=os.getenv('TEST_DATABASE_URL')
pytestmark=pytest.mark.skipif(not DSN,reason='TEST_DATABASE_URL unavailable; real PostGIS integration not executed')

@pytest.fixture
def database():
    schema='test_'+uuid4().hex
    with psycopg.connect(DSN,autocommit=True) as c:
        c.execute('CREATE EXTENSION IF NOT EXISTS postgis')
        c.execute('CREATE EXTENSION IF NOT EXISTS btree_gist')
        c.execute(f'CREATE SCHEMA {schema}')
        c.execute(f'SET search_path TO {schema},public')
        migrations_dir = Path(os.getenv('MIGRATIONS_DIR', str(Path(__file__).parents[2] / 'db')))
        for sql_file in sorted(migrations_dir.glob('*.sql')):
            c.execute(sql_file.read_text(encoding='utf-8'))
    def connect():
        c=psycopg.connect(DSN)
        c.execute(f'SET search_path TO {schema},public')
        return c
    owner,farmer,operator,machine=[uuid4() for _ in range(4)]
    with connect() as c:
        for ident,phone in [(owner,'+919000000002'),(farmer,'+919000000001'),(operator,'+919000000003')]:
            c.execute('INSERT INTO users(id,phone,name) VALUES(%s,%s,%s)',(ident,phone,'Test'))
        c.execute("INSERT INTO machines(id,owner_id,name,category,village,location,rate,unit) VALUES(%s,%s,'Test','Tractor','Test',ST_SetSRID(ST_MakePoint(75,30),4326)::geography,650,'hour')",(machine,owner))
    yield connect,farmer,machine,operator,owner
    with psycopg.connect(DSN,autocommit=True) as c:c.execute(f'DROP SCHEMA {schema} CASCADE')

def insert(c,farmer,machine,operator=None,start='2030-01-01 08:00+00',end='2030-01-01 09:00+00'):
    c.execute("INSERT INTO bookings(id,machine_id,farmer_id,operator_id,start_at,end_at,reserved_until,quantity,latitude,longitude,rate,unit,mobilization,estimate,idempotency_key,request_hash) VALUES(%s,%s,%s,%s,%s,%s,%s,1,30,75,650,'hour',0,650,%s,'test')",(uuid4(),machine,farmer,operator,start,end,end,uuid4()))

def test_ten_concurrent_bookings_exactly_one_wins(database):
    connect,farmer,machine,_,_=database
    def attempt(_):
        try:
            with connect() as c: insert(c,farmer,machine)
            return True
        except psycopg.errors.ExclusionViolation:return False
    with ThreadPoolExecutor(max_workers=10) as pool:
        assert sum(pool.map(attempt,range(10)))==1

def test_adjacent_half_open_slots_allowed(database):
    connect,farmer,machine,_,_=database
    with connect() as c:
        insert(c,farmer,machine)
        insert(c,farmer,machine,start='2030-01-01 09:00+00',end='2030-01-01 10:00+00')

def test_cancel_releases_reservation(database):
    connect,farmer,machine,_,_=database
    with connect() as c:
        insert(c,farmer,machine)
        c.execute("UPDATE bookings SET status='CANCELLED'")
        insert(c,farmer,machine)

def test_operator_overlap_across_machines_rejected(database):
    connect,farmer,machine,operator,owner=database
    other=uuid4()
    with connect() as c:
        c.execute("INSERT INTO machines(id,owner_id,name,category,village,location,rate,unit) VALUES(%s,%s,'Other','Tractor','Test',ST_SetSRID(ST_MakePoint(75,30),4326)::geography,650,'hour')",(other,owner))
        insert(c,farmer,machine,operator)
    with pytest.raises(psycopg.errors.ExclusionViolation):
        with connect() as c:insert(c,farmer,other,operator)

def test_api_full_booking_billing_and_authorization(database,monkeypatch):
    from contextlib import contextmanager
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from datetime import datetime,timedelta,timezone
    from app import main
    connect,_,_,_,_=database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory=dict_row
            yield c
    monkeypatch.setattr(main,'db',isolated_db)
    headers={'X-Requested-With':'YantraSetu','Origin':'http://localhost:5173'}
    owner=TestClient(main.app,headers=headers)
    farmer=TestClient(main.app,headers=headers)
    stranger=TestClient(main.app,headers=headers)
    def login(client,phone,roles):
        r=client.post('/api/auth/request',json={'phone':phone});assert r.status_code==200,r.text
        challenge=r.json()
        r=client.post('/api/auth/verify',json={'challenge_id':challenge['challenge_id'],'code':challenge['development_code'],'name':'Integration Test','roles':roles})
        assert r.status_code==200,r.text
    login(owner,'+919100000001',['owner'])
    login(farmer,'+919100000002',['farmer'])
    login(stranger,'+919100000003',['farmer'])
    r=owner.post('/api/machines',json={'name':'Test tractor','category':'Tractor','village':'Test village','latitude':30,'longitude':75,'rate':'650.00','unit':'hour','mobilization':'250.00'})
    assert r.status_code==200,r.text
    machine=r.json()['id']
    now=datetime.now(timezone.utc)
    body={'machine_id':machine,'start_at':(now+timedelta(minutes=1)).isoformat(),'end_at':(now+timedelta(hours=2)).isoformat(),'latitude':30,'longitude':75,'idempotency_key':str(uuid4())}
    r=farmer.post('/api/bookings',json=body);assert r.status_code==200,r.text
    booking=r.json()['id']
    assert farmer.post('/api/bookings',json=body).json()['id']==booking
    changed={**body,'longitude':76}
    assert farmer.post('/api/bookings',json=changed).status_code==409
    assert stranger.get(f'/api/bookings/{booking}/audit').status_code==403
    assert farmer.post(f'/api/bookings/{booking}/action',json={'action':'approve'}).status_code==403
    assert owner.post(f'/api/bookings/{booking}/action',json={'action':'approve'}).status_code==200
    # Move only this isolated test record into its start window, avoiding a timed sleep.
    with isolated_db() as c:c.execute('UPDATE bookings SET start_at=now()-interval \'1 minute\' WHERE id=%s',(booking,))
    for stage,reading in [('start','100.000'),('end','102.500')]:
        r=owner.post(f'/api/bookings/{booking}/meter/request',json={'stage':stage,'reading':reading});assert r.status_code==200,r.text
        challenge=r.json()
        proof={'challenge_id':challenge['challenge_id'],'code':challenge['development_code']}
        assert owner.post(f'/api/bookings/{booking}/meter/confirm',json=proof).status_code==403
        r=farmer.post(f'/api/bookings/{booking}/meter/confirm',json=proof);assert r.status_code==200,r.text
        assert farmer.post(f'/api/bookings/{booking}/meter/confirm',json=proof).status_code==400
    invoice=farmer.get(f'/api/bookings/{booking}/invoice').json()
    from decimal import Decimal
    assert Decimal(str(invoice['breakdown']['total']))==Decimal('1875.00')
    assert farmer.post(f'/api/bookings/{booking}/payment-report',json={'status':'PAID_OUTSIDE_PLATFORM'}).status_code==200
    assert farmer.post(f'/api/bookings/{booking}/rating',json={'score':5,'comment':'Test'}).status_code==200
    assert owner.post(f'/api/bookings/{booking}/rating',json={'score':4}).status_code==200
    assert stranger.post(f'/api/bookings/{booking}/payment-report',json={'status':'UNPAID'}).status_code==403

def test_otp_wrong_attempts_persist_and_lock(database,monkeypatch):
    from contextlib import contextmanager
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from app import main
    connect,*_=database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory=dict_row
            yield c
    monkeypatch.setattr(main,'db',isolated_db)
    client=TestClient(main.app,headers={'X-Requested-With':'YantraSetu'})
    challenge=client.post('/api/auth/request',json={'phone':'+919100000004'}).json()
    wrong='000000' if challenge['development_code']!='000000' else '111111'
    body={'challenge_id':challenge['challenge_id'],'code':wrong,'name':'Test'}
    for _ in range(5):assert client.post('/api/auth/verify',json=body).status_code==400
    body['code']=challenge['development_code']
    assert client.post('/api/auth/verify',json=body).status_code==400
