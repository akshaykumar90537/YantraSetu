import os
import pytest
from test_operations import pilot,database,mailbox
pytestmark=pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'),reason='Disposable PostGIS database required')
def test_search_excludes_other_villages_and_same_name_distant_listings(pilot):
 people,m,p,db=pilot;owner=people['owner'][0];farmer=people['farmer'][0]
 for village,lat,lon in [('Neighbour village',30.741,76.641),('Kharar, Punjab',30.742,76.642),('Kharar',31.74,77.64)]:
  r=owner.post('/api/machines',json={'name':'Location test equipment','category':'Tractor','village':village,'latitude':lat,'longitude':lon,'rate':600,'unit':'hour'});assert r.status_code==200,r.text
 path='/api/machines?latitude=30.74&longitude=76.64&radius=5&locality=kharar'
 r=farmer.get(path);assert r.status_code==200,r.text
 rows=r.json();assert len(rows)==2
 assert all(x['village'].lower().split(',')[0]=='kharar' for x in rows)
 assert farmer.get(path+'&category=Harvester').json()==[]
 assert farmer.get(path.replace('locality=kharar','locality=Missing')).json()==[]
 assert farmer.get(path.replace('locality=kharar','locality=')).status_code==422
 assert len(farmer.get(path.replace('locality=kharar','locality=Neighbour%20village')).json())==1
