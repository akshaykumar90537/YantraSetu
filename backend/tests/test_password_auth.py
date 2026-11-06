"""Account identity and password flows against isolated PostgreSQL schemas."""
from test_email_postgres import auth, challenge, verify, pytestmark
from test_postgres import database
from app import main

PASSWORD = 'my strong passphrase 123'


def login(client, password=PASSWORD, email=' PERSON@EXAMPLE.COM '):
    return client.post('/api/auth/password/login', json={'email': email, 'password': password})


def test_password_registration_and_same_account(auth):
    client, connect = auth
    code = challenge(client)
    registered = verify(client, code, name='Farmer One', roles=['farmer'], password=PASSWORD)
    assert registered.status_code == 200, registered.text
    user = registered.json()
    client.post('/api/auth/logout', json={})
    assert login(client, 'incorrect password').status_code == 401
    result = login(client)
    assert result.status_code == 200, result.text
    assert result.json()['id'] == user['id']
    assert 'password_hash' not in result.json()
    assert 'password_hash' not in client.get('/api/me').json()
    with connect() as c:
        assert c.execute('SELECT password_hash FROM user_passwords').fetchone()[0] != PASSWORD
        assert c.execute("SELECT count(*) FROM users WHERE email='person@example.com'").fetchone()[0] == 1


def test_legacy_account_set_password_and_reset_revokes_sessions(auth):
    client, _ = auth
    user = verify(client, challenge(client), name='Owner One', roles=['owner']).json()
    old_session = client.cookies.get('ys_session')
    request = client.post('/api/auth/email/request', json={'email':user['email'], 'action':'reset'}).json()
    code = {**request, 'test_code':client.mailbox[user['email']]}
    result = verify(client, code, password=PASSWORD, name='Changed', roles=['farmer'])
    assert result.status_code == 200, result.text
    assert result.json()['id'] == user['id']
    assert result.json()['roles'] == ['owner']
    assert result.json()['name'] == 'Owner One'
    assert verify(client, code, password=PASSWORD).status_code == 400
    client.cookies.clear()
    client.cookies.set('ys_session', old_session)
    assert client.get('/api/me').status_code == 401
    assert login(client).status_code == 200


def test_password_failures_are_limited(auth):
    client, _ = auth
    for _ in range(10):
        assert login(client).status_code == 401
    assert login(client).status_code == 429


def test_reset_does_not_register_unknown_email(auth):
    client, _ = auth
    request = client.post('/api/auth/email/request', json={'email':'missing@example.com', 'action':'reset'}).json()
    result = verify(client, {**request,'test_code':client.mailbox['missing@example.com']},password=PASSWORD)
    assert result.status_code == 404


def test_google_direct_login_links_existing_and_preserves_role(auth, monkeypatch):
    client, connect = auth
    user = verify(client, challenge(client, 'owner@gmail.com'), name='Owner', roles=['owner'],password=PASSWORD).json()
    client.post('/api/auth/logout',json={})
    monkeypatch.setenv('GOOGLE_CLIENT_ID','test-client')
    monkeypatch.setenv('EMAIL_PROVIDER','disabled')
    for _ in range(2):
        nonce = client.post('/api/auth/google/nonce',json={}).json()['nonce']
        monkeypatch.setattr(main,'verify_google',lambda _: {'sub':'google-owner','email':'owner@gmail.com','nonce':nonce,'email_verified':True})
        result = client.post('/api/auth/google',json={'credential':'x'*30,'role':'farmer'})
        assert result.status_code == 200, result.text
        assert result.json()['id'] == user['id']
        assert result.json()['roles'] == ['owner']
        assert client.get('/api/me').json()['id'] == user['id']
        client.post('/api/auth/logout',json={})
    with connect() as c:
        assert c.execute("SELECT count(*) FROM users WHERE email='owner@gmail.com'").fetchone()[0] == 1
    client.cookies.set('ys_google_nonce',nonce)
    assert client.post('/api/auth/google',json={'credential':'x'*30}).status_code == 429


def test_google_creates_once_and_rejects_wrong_nonce(auth, monkeypatch):
    client, _ = auth
    monkeypatch.setenv('GOOGLE_CLIENT_ID','test-client')
    nonce = client.post('/api/auth/google/nonce',json={}).json()['nonce']
    claims = {'sub':'new-google','email':'new@gmail.com','name':'New Farmer','nonce':'wrong','email_verified':True}
    monkeypatch.setattr(main,'verify_google',lambda _: claims)
    assert client.post('/api/auth/google',json={'credential':'x'*30}).status_code == 401
    claims['nonce'] = nonce
    result = client.post('/api/auth/google',json={'credential':'x'*30})
    assert result.status_code == 200, result.text
    assert result.json()['name'] == 'New Farmer'
    assert client.get('/api/me').json()['id'] == result.json()['id']
