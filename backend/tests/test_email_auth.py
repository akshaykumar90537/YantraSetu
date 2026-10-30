import os
os.environ.setdefault('OTP_SECRET','testing-only-secret-32-characters-minimum')
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app import email_auth, main

HEADERS={'X-Requested-With':'YantraSetu','Origin':'http://localhost:5173'}

def test_anonymous_private_routes_require_session():
    client=TestClient(main.app)
    for path in ('/api/me','/api/bookings','/api/fleet','/api/organizations','/api/notifications'):
        assert client.get(path).status_code==401

def test_invalid_email_and_missing_google_nonce():
    client=TestClient(main.app,headers=HEADERS)
    assert client.post('/api/auth/email/request',json={'email':'bad'}).status_code==422
    assert client.post('/api/auth/google',json={'credential':'x'*30}).status_code==401

def test_email_disabled_fails_closed(monkeypatch):
    monkeypatch.setenv('EMAIL_PROVIDER','disabled')
    client=TestClient(main.app,headers=HEADERS)
    assert client.post('/api/auth/email/request',json={'email':'test@example.com'}).status_code==503
    assert client.get('/api/auth/config').json()['email']=='disabled'

def test_simulation_never_available_in_production(monkeypatch):
    monkeypatch.setenv('EMAIL_PROVIDER','development')
    monkeypatch.setenv('APP_ENV','production')
    with pytest.raises(HTTPException) as exc:
        email_auth.send_email('test@example.com','123456')
    assert exc.value.status_code==503

def test_smtp_does_not_return_code(monkeypatch):
    sent=[]
    class SMTP:
        def __init__(self,*a,**kw): pass
        def __enter__(self): return self
        def __exit__(self,*a): pass
        def starttls(self,**kw): sent.append('tls')
        def send_message(self,msg): sent.append(msg)
    monkeypatch.setenv('EMAIL_PROVIDER','smtp')
    monkeypatch.setenv('SMTP_HOST','smtp.example.com')
    monkeypatch.setenv('SMTP_FROM','sender@example.com')
    monkeypatch.delenv('SMTP_USERNAME',raising=False)
    monkeypatch.setattr(email_auth.smtplib,'SMTP',SMTP)
    assert email_auth.send_email('test@example.com','123456')=={'delivery':'EMAIL_ACCEPTED'}
    assert sent[0]=='tls' and '123456' in sent[1].get_content()

def test_google_checks_audience_and_verified_email(monkeypatch):
    from google.oauth2 import id_token
    monkeypatch.setenv('GOOGLE_CLIENT_ID','expected-client')
    def verify(token,request,audience):
        assert audience=='expected-client'
        return {'sub':'123','email':'test@example.com','email_verified':False}
    monkeypatch.setattr(id_token,'verify_oauth2_token',verify)
    with pytest.raises(HTTPException) as exc:
        email_auth.verify_google('credential')
    assert exc.value.status_code==401
