"""Idempotent, explicit synthetic demo data. Never creates fake real listings."""
from uuid import UUID
from app.db import db
with db() as c:
    users=[('00000000-0000-4000-8000-000000000001','+919000000001','Demo Farmer',['farmer']),('00000000-0000-4000-8000-000000000002','+919000000002','Demo Owner',['owner','farmer','fpo']),('00000000-0000-4000-8000-000000000003','+919000000003','Demo Operator',['operator'])]
    for ident,phone,name,roles in users:
        c.execute('INSERT INTO users(id,phone,name,roles) VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING',(ident,phone,name,roles))
    for i,name,category,rate,unit,lat,lon in [(1,'DEMO · Mahindra 575 DI','Tractor',650,'hour',30.901,75.857),(2,'DEMO · 6-foot rotavator','Rotavator',1200,'acre',30.912,75.865),(3,'DEMO · Combine harvester','Harvester',2200,'acre',30.889,75.841)]:
        ident=f'10000000-0000-4000-8000-{i:012d}'
        c.execute("INSERT INTO machines(id,owner_id,name,category,description,village,location,rate,unit,mobilization) SELECT %s,id,%s,%s,%s,'Ludhiana demo area',ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,%s,%s,250 FROM users WHERE phone='+919000000002' ON CONFLICT DO NOTHING",(ident,name,category,'Synthetic hackathon listing. Not real equipment or an offer for hire.',lon,lat,rate,unit))
print('Seeded 3 labeled sample machines and 3 development accounts. Sign in using the simulated OTP flow.')
