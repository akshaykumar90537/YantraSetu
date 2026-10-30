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
        except (psycopg.errors.ExclusionViolation, psycopg.errors.DeadlockDetected):return False
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

def test_user_login_does_not_recreate_or_require_registration(database, monkeypatch):
    from contextlib import contextmanager
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from app import main
    connect, *_ = database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory = dict_row
            yield c
    monkeypatch.setattr(main, 'db', isolated_db)
    headers = {'X-Requested-With': 'YantraSetu', 'Origin': 'http://localhost:5173'}
    client = TestClient(main.app, headers=headers)

    phone = '+919988776655'

    # 1. First time request: user does not exist yet
    r1 = client.post('/api/auth/request', json={'phone': phone})
    assert r1.status_code == 200
    ch1 = r1.json()
    assert ch1['is_new_user'] is True
    assert ch1.get('name') is None

    # 2. Register first time
    v1 = client.post('/api/auth/verify', json={
        'challenge_id': ch1['challenge_id'],
        'code': ch1['development_code'],
        'name': 'Gurpreet Singh',
        'roles': ['farmer']
    })
    assert v1.status_code == 200
    u1 = v1.json()
    assert u1['name'] == 'Gurpreet Singh'
    assert u1['phone'] == phone

    # Logout
    client.post('/api/auth/logout')

    # 3. Second time request: user already exists
    r2 = client.post('/api/auth/request', json={'phone': phone})
    assert r2.status_code == 200
    ch2 = r2.json()
    assert ch2['is_new_user'] is False
    assert 'name' not in ch2 and 'user_name' not in ch2
    assert 'roles' not in ch2 and 'user_roles' not in ch2

    # 4. Login without name or roles (must succeed into existing account)
    v2 = client.post('/api/auth/verify', json={
        'challenge_id': ch2['challenge_id'],
        'code': ch2['development_code']
    })
    assert v2.status_code == 200
    u2 = v2.json()
    assert u2['id'] == u1['id']
    assert u2['name'] == 'Gurpreet Singh'

    # 5. Verify only 1 record exists in users table for this phone
    with isolated_db() as c:
        records = c.execute('SELECT * FROM users WHERE phone=%s', (phone,)).fetchall()
        assert len(records) == 1

def test_owner_cannot_view_or_book_own_equipment(database, monkeypatch):
    from contextlib import contextmanager
    from datetime import datetime, timezone, timedelta
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from app import main
    connect, farmer, machine, operator, owner = database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory = dict_row
            yield c
    monkeypatch.setattr(main, 'db', isolated_db)
    headers = {'X-Requested-With': 'YantraSetu', 'Origin': 'http://localhost:5173'}
    
    # 1. Sign in as owner (must have owner role)
    with connect() as c:
        c.execute("UPDATE users SET roles=ARRAY['owner','farmer'] WHERE id=%s", (owner,))
        c.execute("UPDATE users SET roles=ARRAY['farmer'] WHERE id=%s", (farmer,))

    owner_client = TestClient(main.app, headers=headers)
    r_ch = owner_client.post('/api/auth/request', json={'phone': '+919000000002'}).json()
    owner_client.post('/api/auth/verify', json={'challenge_id': r_ch['challenge_id'], 'code': r_ch['development_code']})

    # 2. Search machines as owner: owner's own machine must be excluded
    res = owner_client.get('/api/machines?latitude=30&longitude=75&radius=10')
    assert res.status_code == 200
    owner_machines = [m for m in res.json() if m['id'] == str(machine)]
    assert len(owner_machines) == 0, "Owner must not see their own machine in search results"

    # 3. Owner attempts to book their own machine: must return 403 "You cannot book your own equipment."
    start = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    book_attempt = owner_client.post('/api/bookings', json={
        'machine_id': str(machine),
        'start_at': start,
        'end_at': end,
        'latitude': 30.0,
        'longitude': 75.0,
        'idempotency_key': str(uuid4())
    })
    assert book_attempt.status_code == 403
    assert book_attempt.json()['detail'] == "You cannot book your own equipment."

    # 4. Sign in as non-owner (farmer)
    farmer_client = TestClient(main.app, headers=headers)
    r_ch_f = farmer_client.post('/api/auth/request', json={'phone': '+919000000001'}).json()
    farmer_client.post('/api/auth/verify', json={'challenge_id': r_ch_f['challenge_id'], 'code': r_ch_f['development_code']})

    # 5. Non-owner searches: machine is visible
    res_f = farmer_client.get('/api/machines?latitude=30&longitude=75&radius=10')
    assert res_f.status_code == 200
    farmer_machines = [m for m in res_f.json() if m['id'] == str(machine)]
    assert len(farmer_machines) == 1, "Non-owner must be able to view the machine"

    # 6. Non-owner can book normally
    book_ok = farmer_client.post('/api/bookings', json={
        'machine_id': str(machine),
        'start_at': start,
        'end_at': end,
        'latitude': 30.0,
        'longitude': 75.0,
        'idempotency_key': str(uuid4())
    })
    assert book_ok.status_code == 200

def test_equipment_delisting_and_reactivation(database, monkeypatch):
    from contextlib import contextmanager
    from datetime import datetime, timezone, timedelta
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from app import main
    connect, farmer, machine, operator, owner = database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory = dict_row
            yield c
    monkeypatch.setattr(main, 'db', isolated_db)
    headers = {'X-Requested-With': 'YantraSetu', 'Origin': 'http://localhost:5173'}

    with connect() as c:
        c.execute("UPDATE users SET roles=ARRAY['owner','farmer'] WHERE id=%s", (owner,))
        c.execute("UPDATE users SET roles=ARRAY['farmer'] WHERE id=%s", (farmer,))

    # Sign in as owner
    owner_client = TestClient(main.app, headers=headers)
    r_ch = owner_client.post('/api/auth/request', json={'phone': '+919000000002'}).json()
    owner_client.post('/api/auth/verify', json={'challenge_id': r_ch['challenge_id'], 'code': r_ch['development_code']})

    # Delist equipment
    delist_res = owner_client.patch(f'/api/machines/{machine}/status', json={'is_active': False})
    assert delist_res.status_code == 200
    assert delist_res.json()['is_active'] is False

    # Sign in as farmer
    farmer_client = TestClient(main.app, headers=headers)
    r_ch_f = farmer_client.post('/api/auth/request', json={'phone': '+919000000001'}).json()
    farmer_client.post('/api/auth/verify', json={'challenge_id': r_ch_f['challenge_id'], 'code': r_ch_f['development_code']})

    # Delisted equipment is hidden from search
    res = farmer_client.get('/api/machines?latitude=30&longitude=75&radius=10')
    assert not any(m['id'] == str(machine) for m in res.json())

    # Booking delisted equipment is rejected with 400
    start = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(hours=7)).isoformat()
    book_fail = farmer_client.post('/api/bookings', json={
        'machine_id': str(machine),
        'start_at': start,
        'end_at': end,
        'latitude': 30.0,
        'longitude': 75.0,
        'idempotency_key': str(uuid4())
    })
    assert book_fail.status_code == 400
    assert book_fail.json()['detail'] == "This equipment is currently unavailable."

    # Relist equipment
    relist_res = owner_client.patch(f'/api/machines/{machine}/status', json={'is_active': True})
    assert relist_res.status_code == 200
    assert relist_res.json()['is_active'] is True

    # Now booking succeeds
    book_success = farmer_client.post('/api/bookings', json={
        'machine_id': str(machine),
        'start_at': start,
        'end_at': end,
        'latitude': 30.0,
        'longitude': 75.0,
        'idempotency_key': str(uuid4())
    })
    assert book_success.status_code == 200

def test_mutual_rating_and_booking_fields(database, monkeypatch):
    from contextlib import contextmanager
    from datetime import datetime, timezone, timedelta
    from uuid import uuid4
    from psycopg.rows import dict_row
    from fastapi.testclient import TestClient
    from app import main
    connect, farmer, machine, operator, owner = database
    @contextmanager
    def isolated_db():
        with connect() as c:
            c.row_factory = dict_row
            yield c
    monkeypatch.setattr(main, 'db', isolated_db)
    headers = {'X-Requested-With': 'YantraSetu', 'Origin': 'http://localhost:5173'}

    with connect() as c:
        c.execute("UPDATE users SET roles=ARRAY['owner'] WHERE id=%s", (owner,))
        c.execute("UPDATE users SET roles=ARRAY['farmer'] WHERE id=%s", (farmer,))

    owner_client = TestClient(main.app, headers=headers)
    r_ch_o = owner_client.post('/api/auth/request', json={'phone': '+919000000002'}).json()
    owner_client.post('/api/auth/verify', json={'challenge_id': r_ch_o['challenge_id'], 'code': r_ch_o['development_code']})

    farmer_client = TestClient(main.app, headers=headers)
    r_ch_f = farmer_client.post('/api/auth/request', json={'phone': '+919000000001'}).json()
    farmer_client.post('/api/auth/verify', json={'challenge_id': r_ch_f['challenge_id'], 'code': r_ch_f['development_code']})

    # Farmer requests booking
    start = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    b_res = farmer_client.post('/api/bookings', json={
        'machine_id': str(machine),
        'start_at': start,
        'end_at': end,
        'latitude': 30.0,
        'longitude': 75.0,
        'idempotency_key': str(uuid4())
    })
    assert b_res.status_code == 200
    booking_id = b_res.json()['id']

    # Owner views bookings: must include farmer_rating_avg and farmer_rating_count
    owner_bookings = owner_client.get('/api/bookings').json()
    target_b = next(b for b in owner_bookings if b['id'] == booking_id)
    assert 'farmer_rating_avg' in target_b
    assert 'farmer_rating_count' in target_b
    assert target_b['farmer_rating_avg'] == 5.0
    assert target_b['farmer_rating_count'] == 0

    # Owner approves booking
    appr_res = owner_client.post(f'/api/bookings/{booking_id}/action', json={'action': 'approve'})
    assert appr_res.status_code == 200

    # Check availability: approved slot is reserved
    avail = farmer_client.get(f'/api/machines/{machine}/availability').json()
    assert any(r['start_at'] is not None for r in avail['reserved'])

    # Directly set to COMPLETED for rating test
    with connect() as c:
        c.execute("UPDATE bookings SET status='COMPLETED', actual_quantity=2, final_total=1300 WHERE id=%s", (booking_id,))

    # Farmer rates Owner
    f_rate = farmer_client.post(f'/api/bookings/{booking_id}/rating', json={
        'score': 5,
        'punctuality': 5,
        'badges': ['Clean Machine', 'On-Time Arrival'],
        'comment': 'Excellent service'
    })
    assert f_rate.status_code == 200

    # Owner rates Farmer
    o_rate = owner_client.post(f'/api/bookings/{booking_id}/rating', json={
        'score': 4,
        'punctuality': 5,
        'badges': ['Prompt Payment', 'Cooperative'],
        'comment': 'Good farmer'
    })
    assert o_rate.status_code == 200

    # Check that owner's bookings now show updated farmer_rating_avg=4.0, count=1
    updated_b = owner_client.get('/api/bookings').json()
    ub = next(b for b in updated_b if b['id'] == booking_id)
    assert ub['farmer_rating_avg'] == 4.0
    assert ub['farmer_rating_count'] == 1
    assert ub['owner_rating_avg'] == 5.0
    assert ub['owner_rating_count'] == 1


