import os
os.environ.setdefault('OTP_SECRET','testing-only-secret-32-characters-minimum')
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
headers={'X-Requested-With':'YantraSetu','Origin':'http://localhost:5173'}
def test_cross_origin_request_rejected():
    r=client.post('/api/auth/request',json={'phone':'+919000000001'},headers={'Origin':'https://other.example','X-Requested-With':'YantraSetu'})
    assert r.status_code==403
def test_missing_request_header_rejected():
    assert client.post('/api/auth/request',json={'phone':'+919000000001'}).status_code==403
def test_bad_phone_rejected_before_database():
    assert client.post('/api/auth/request',json={'phone':'123'},headers=headers).status_code==422
def test_search_radius_bounded():
    assert client.get('/api/machines?radius=1000').status_code==422
def test_search_location_bounded():
    assert client.get('/api/machines?latitude=999').status_code==422
def test_openapi_has_no_gateway_or_subscription_endpoints():
    schema=client.get('/openapi.json').json()
    assert not any(x in path for path in schema['paths'] for x in ('checkout','gateway','subscription','wallet','settlement'))
