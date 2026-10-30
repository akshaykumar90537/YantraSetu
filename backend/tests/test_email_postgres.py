"""Uses real PostgreSQL schemas; delivery and Google responses are isolated test doubles."""
import os
from contextlib import contextmanager
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row
from test_postgres import database
from app import main
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='TEST_DATABASE_URL unavailable; email database checks not executed')
HEADERS={'X-Requested-With':'YantraSetu','Origin':'http://localhost:5173'}

@pytest.fixture
def auth(database,monkeypatch):
    connect,*_=database
    @contextmanager
    def isolated():
        with connect() as c:
            c.row_factory=dict_row
            yield c
    monkeypatch.setattr(main,'db',isolated)
    monkeypatch.setenv('EMAIL_PROVIDER','development')
    monkeypatch.setenv('APP_ENV','development')
    return TestClient(main.app,headers=HEADERS),connect

def challenge(client,email='person@example.com'):
    r=client.post('/api/auth/email/request',json={'email':email})
    assert r.status_code==200,r.text
    return r.json()

def verify(client,r,**kwargs):
    return client.post('/api/auth/email/verify',json={'challenge_id':r['challenge_id'],'code':r['development_code'],**kwargs})

def test_persist_reuse_logout_and_replay(auth):
    client,connect=auth
    r=challenge(client,'Person@EXAMPLE.com')
    assert client.get('/api/me').status_code==401
    result=verify(client,r,name='Test Farmer',roles=['farmer','owner'])
    assert result.status_code==200,result.text
    u=result.json()
    assert u['email']=='person@example.com' and u['phone'] is None
    assert 'HttpOnly' in result.headers['set-cookie']
    assert client.get('/api/me').json()['id']==u['id']
    assert verify(client,r).status_code==400
    assert client.post('/api/auth/logout',json={}).status_code==200
    assert client.get('/api/me').status_code==401
    r=challenge(client)
    result=verify(client,r,name='Changed Name',roles=['operator'])
    assert result.json()['id']==u['id']
    assert result.json()['name']=='Test Farmer'
    assert set(result.json()['roles'])=={'farmer','owner'}
    with connect() as c:
        assert c.execute("SELECT count(*) FROM users WHERE email='person@example.com'").fetchone()[0]==1

def test_lockout_expiry_and_purpose(auth):
    client,connect=auth
    r=challenge(client)
    wrong='000000' if r['development_code']!='000000' else '999999'
    for _ in range(5):
        assert verify(client,{**r,'development_code':wrong}).status_code==400
    assert verify(client,r,name='Test').status_code==400
    r=challenge(client,'other@example.com')
    with connect() as c:
        c.execute("UPDATE challenges SET expires_at=now()-interval '1 second' WHERE id=%s",(r['challenge_id'],))
    assert verify(client,r,name='Test').status_code==400
    r=challenge(client,'third@example.com')
    assert client.post('/api/auth/verify',json={'challenge_id':r['challenge_id'],'code':r['development_code'],'name':'Test'}).status_code==400

def test_email_rate_limit(auth):
    client,_=auth
    for _ in range(5): challenge(client)
    assert client.post('/api/auth/email/request',json={'email':'person@example.com'}).status_code==429

def test_google_requires_email_code_and_nonce(auth,monkeypatch):
    client,connect=auth
    monkeypatch.setenv('GOOGLE_CLIENT_ID','test-client')
    nonce=client.post('/api/auth/google/nonce',json={}).json()['nonce']
    monkeypatch.setattr(main,'verify_google',lambda _: {'sub':'google-123','email':'google@example.com','nonce':nonce,'email_verified':True})
    result=client.post('/api/auth/google',json={'credential':'x'*30})
    assert result.status_code==200,result.text
    assert client.get('/api/me').status_code==401
    u=verify(client,result.json(),name='Google Farmer').json()
    assert u['google_sub']=='google-123'
    client.cookies.set('ys_google_nonce',nonce)
    assert client.post('/api/auth/google',json={'credential':'x'*30}).status_code==429

def test_email_meter_destination(auth):
    client,connect=auth
    r=challenge(client)
    u=verify(client,r,name='Test').json()
    with main.db() as c:
        result=main.issue(c,u['email'],'meter',{'booking_id':'test'})
    with main.db() as c:
        consumed=main.consume(c,result['challenge_id'],result['development_code'],'meter',u)
        assert consumed['phone']==u['email']

def test_smtp_failure_does_not_create_account(auth,monkeypatch):
    from fastapi import HTTPException
    client,connect=auth
    def failed(*args): raise HTTPException(503,'Email could not be sent.')
    monkeypatch.setattr(main,'send_email',failed)
    assert client.post('/api/auth/email/request',json={'email':'person@example.com'}).status_code==503
    with connect() as c:
        assert c.execute('SELECT count(*) FROM challenges').fetchone()[0]==0
