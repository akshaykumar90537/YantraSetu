import os
import pytest
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Requires disposable PostGIS database')
@pytest.mark.parametrize('role',['owner','farmer'])
def test_profile_update_persists_without_changing_identity(pilot,role):
 people,*_=pilot;client,user=people[role]
 result=client.patch('/api/me',json={'name':' Updated Name ','language':'hi'})
 assert result.status_code==200,result.text
 assert result.json()['name']=='Updated Name'
 assert result.json()['id']==user['id'] and result.json()['roles']==user['roles']
 assert 'password_hash' not in result.json()
 saved=client.get('/api/me').json();assert saved['name']=='Updated Name' and saved['language']=='hi'
 other=people['stranger'][0].get('/api/me').json();assert other['name']!='Updated Name'
 for fields in [{'name':'  ','language':'en'},{'name':'Okay','language':'xx'},{'name':'Okay','language':'en','roles':['owner']},{'name':'Okay','language':'en','id':other['id']}]:
  assert client.patch('/api/me',json=fields).status_code==422
 client.cookies.clear();assert client.patch('/api/me',json={'name':'Okay','language':'en'}).status_code==401


def test_profile_picture_persistence_replacement_removal_and_privacy(pilot):
 import base64
 from io import BytesIO
 from PIL import Image
 people,*_=pilot;client=people['farmer'][0];other=people['owner'][0]
 def encoded(color):
  data=BytesIO();Image.new('RGB',(24,24),color).save(data,'PNG');return base64.b64encode(data.getvalue()).decode()
 payload={'name':'Photo Farmer','language':'en','photo':encoded('red')}
 result=client.patch('/api/me',json=payload);assert result.status_code==200,result.text
 version=result.json()['profile_photo_version'];assert version
 image=client.get('/api/me/photo');assert image.status_code==200
 with Image.open(BytesIO(image.content)) as im:assert im.format=='JPEG' and not im.getexif()
 assert other.get('/api/me/photo').status_code==404
 assert client.get('/api/me').json()['profile_photo_version']==version
 assert client.patch('/api/me',json={'name':'Updated Farmer','language':'hi'}).json()['profile_photo_version']==version
 for invalid in ['not an image','A'*1400001]:
  assert client.patch('/api/me',json={**payload,'photo':invalid}).status_code==422
 assert client.get('/api/me').json()['profile_photo_version']==version
 changed=client.patch('/api/me',json={**payload,'photo':encoded('blue')});assert changed.status_code==200
 assert changed.json()['profile_photo_version']!=version
 assert client.get('/api/me/photo').content!=image.content
 for field in [{'email':'other@example.test'},{'roles':['owner']}]:
  assert client.patch('/api/me',json={**payload,**field}).status_code==422
 assert client.patch('/api/me',json={**payload,'photo':None}).json()['profile_photo_version'] is None
 assert client.get('/api/me/photo').status_code==404
 client.cookies.clear();assert client.get('/api/me/photo').status_code==401
