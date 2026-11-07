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
def mailbox(monkeypatch):
    from app import main
    messages = {}
    def deliver(address, code):
        messages[address] = code
        return {'delivery': 'EMAIL_ACCEPTED'}
    monkeypatch.setenv('EMAIL_PROVIDER', 'smtp')
    monkeypatch.setenv('SMTP_HOST', 'test.invalid')
    monkeypatch.setenv('SMTP_FROM', 'sender@example.test')
    monkeypatch.setattr(main, 'send_email', deliver)
    return messages

def sign_in(client, address, mailbox, **profile):
    challenge = client.post('/api/auth/email/request', json={'email': address})
    assert challenge.status_code == 200, challenge.text
    response = client.post('/api/auth/email/verify', json={
        'challenge_id': challenge.json()['challenge_id'], 'code': mailbox[address], **profile})
    assert response.status_code == 200, response.text
    return response.json()

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
            c.execute('INSERT INTO users(id,phone,name,email) VALUES(%s,%s,%s,%s)',(ident,phone,'Test',phone[1:]+'@example.test'))
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

def test_api_full_booking_billing_and_authorization(database, monkeypatch, mailbox):
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
    sign_in(owner,'owner@example.test',mailbox,name='Test Owner',roles=['owner'])
    sign_in(farmer,'farmer@example.test',mailbox,name='Test Farmer',roles=['farmer'])
    sign_in(stranger,'other@example.test',mailbox,name='Test Stranger',roles=['farmer'])
    r=owner.post('/api/machines',json={'name':'Test tractor','category':'Tractor','village':'Test village','latitude':30,'longitude':75,'rate':'650.00','unit':'hour','mobilization':'250.00'})
    assert r.status_code==200,r.text
    machine=r.json()['id']
    now=datetime.now(timezone.utc)
    body={'machine_id':machine,'start_at':(now+timedelta(minutes=1)).isoformat(),'end_at':(now+timedelta(hours=2)).isoformat(),'latitude':30,'longitude':75,'idempotency_key':str(uuid4())}
    body['contact_phone'] = '+919876543210'
    invalid = farmer.post('/api/bookings',json={**body,'contact_phone':'123'})
    assert invalid.status_code == 422
    r=farmer.post('/api/bookings',json=body);assert r.status_code==200,r.text
    booking=r.json()['id']
    assert 'contact_phone' not in r.json()
    with connect() as c:
        assert c.execute('SELECT phone FROM booking_contacts WHERE booking_id=%s',(booking,)).fetchone()[0] == body['contact_phone']
    assert owner.get(f'/api/bookings/{booking}/farmer-contact').status_code == 403
    assert stranger.get(f'/api/bookings/{booking}/farmer-contact').status_code == 403
    assert body['contact_phone'] not in owner.get('/api/bookings').text
    assert farmer.post('/api/bookings',json=body).json()['id']==booking
    changed={**body,'longitude':76}
    assert farmer.post('/api/bookings',json=changed).status_code==409
    assert stranger.get(f'/api/bookings/{booking}/audit').status_code==403
    assert farmer.post(f'/api/bookings/{booking}/action',json={'action':'approve'}).status_code==403
    assert owner.post(f'/api/bookings/{booking}/action',json={'action':'approve'}).status_code==200
    contact = owner.get(f'/api/bookings/{booking}/farmer-contact')
    assert contact.status_code == 200, contact.text
    assert contact.json()['phone'] == body['contact_phone']
    assert contact.json()['verified'] is False
    assert stranger.get(f'/api/bookings/{booking}/farmer-contact').status_code == 403
    assert farmer.get(f'/api/bookings/{booking}/farmer-contact').status_code == 403
    assert body['contact_phone'] not in stranger.get('/api/bookings').text
    # Move only this isolated test record into its start window, avoiding a timed sleep.
    with isolated_db() as c:c.execute('UPDATE bookings SET start_at=now()-interval \'1 minute\' WHERE id=%s',(booking,))
    for stage,reading in [('start','100.000'),('end','102.500')]:
        r=owner.post(f'/api/bookings/{booking}/meter/request',json={'stage':stage,'reading':reading});assert r.status_code==200,r.text
        challenge=r.json()
        proof={'challenge_id':challenge['challenge_id'],'code':mailbox['farmer@example.test']}
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

def test_owner_listing_persists_and_farmer_discovers(database, monkeypatch, mailbox):
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
    headers = {'X-Requested-With': 'YantraSetu'}
    owner = TestClient(main.app, headers=headers)
    farmer = TestClient(main.app, headers=headers)
    owner_user = sign_in(owner, 'listing-owner@example.test', mailbox, name='Listing Owner', roles=['owner'])
    sign_in(farmer, 'listing-farmer@example.test', mailbox, name='Listing Farmer', roles=['farmer'])
    payload = {'name':'Persistence tractor', 'category':'Tractor', 'village':'Kharar',
               'latitude':30.7441, 'longitude':76.6472, 'rate':'850.00', 'unit':'hour'}
    assert farmer.post('/api/machines', json=payload).status_code == 403
    created = owner.post('/api/machines', json=payload)
    assert created.status_code == 200, created.text
    ident = created.json()['id']
    # A fresh database connection proves the create request committed its record.
    with connect() as c:
        row = c.execute('SELECT owner_id,name,rate FROM machines WHERE id=%s', (ident,)).fetchone()
        assert str(row[0]) == owner_user['id']
        assert row[1] == payload['name'] and float(row[2]) == 850
    owner.post('/api/auth/logout', json={})
    sign_in(owner, 'listing-owner@example.test', mailbox)
    assert any(m['id'] == ident for m in owner.get('/api/fleet').json())
    query = {'latitude':30.7441, 'longitude':76.6472, 'radius':5, 'category':'Tractor'}
    found = farmer.get('/api/machines', params=query)
    assert found.status_code == 200, found.text
    assert any(m['id'] == ident and m['owner_id'] == owner_user['id'] for m in found.json())
    assert not any(m['id'] == ident for m in farmer.get('/api/machines', params={**query, 'category':'Harvester'}).json())
    assert not any(m['id'] == ident for m in farmer.get('/api/machines', params={**query, 'longitude':75}).json())
    assert farmer.patch(f'/api/machines/{ident}/status', json={'is_active':False}).status_code == 403


def test_otp_wrong_attempts_persist_and_lock(database, monkeypatch, mailbox):
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
    challenge=client.post('/api/auth/email/request',json={'email':'locked@example.test'}).json()
    wrong='000000' if mailbox['locked@example.test']!='000000' else '111111'
    body={'challenge_id':challenge['challenge_id'],'code':wrong,'name':'Test'}
    for _ in range(5):assert client.post('/api/auth/email/verify',json=body).status_code==400
    body['code']=mailbox['locked@example.test']
    assert client.post('/api/auth/email/verify',json=body).status_code==400

def test_user_login_does_not_recreate_or_require_registration(database, monkeypatch, mailbox):
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

    address = 'returning@example.test'
    first = sign_in(client,address,mailbox,name='Gurpreet Singh',roles=['farmer'])
    client.post('/api/auth/logout')
    again = sign_in(client,address,mailbox)
    assert again['id'] == first['id']
    assert again['name'] == 'Gurpreet Singh'
    with isolated_db() as c:
        assert len(c.execute('SELECT id FROM users WHERE email=%s',(address,)).fetchall()) == 1

def test_owner_cannot_view_or_book_own_equipment(database, monkeypatch, mailbox):
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
    sign_in(owner_client,'919000000002@example.test',mailbox)

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
    assert owner_client.get(f'/api/machines/{machine}/availability').status_code == 200

    window = {'start':start,'end':end}
    assert owner_client.get('/api/fleet/maintenance',params=window).json() == []
    block = owner_client.post(f'/api/machines/{machine}/maintenance',json={'start_at':(datetime.now(timezone.utc)+timedelta(hours=5)).isoformat(),'end_at':(datetime.now(timezone.utc)+timedelta(hours=6)).isoformat(),'reason':'Service'})
    assert block.status_code == 200
    week = {**window,'end':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}
    assert owner_client.get('/api/fleet/maintenance',params=week).json()[0]['reason']=='Service'
    # 4. Sign in as non-owner (farmer)
    farmer_client = TestClient(main.app, headers=headers)
    sign_in(farmer_client,'919000000001@example.test',mailbox)

    assert farmer_client.get('/api/fleet/maintenance',params=week).status_code==403
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

def test_equipment_delisting_and_reactivation(database, monkeypatch, mailbox):
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
    sign_in(owner_client,'919000000002@example.test',mailbox)

    # Delist equipment
    delist_res = owner_client.patch(f'/api/machines/{machine}/status', json={'is_active': False})
    assert delist_res.status_code == 200
    assert delist_res.json()['is_active'] is False

    # Sign in as farmer
    farmer_client = TestClient(main.app, headers=headers)
    sign_in(farmer_client,'919000000001@example.test',mailbox)

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

def test_mutual_rating_and_booking_fields(database, monkeypatch, mailbox):
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
    sign_in(owner_client,'919000000002@example.test',mailbox)

    farmer_client = TestClient(main.app, headers=headers)
    sign_in(farmer_client,'919000000001@example.test',mailbox)

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


