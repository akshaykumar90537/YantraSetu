import os, secrets, hashlib, hmac, json
from uuid import uuid4, UUID
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import Literal
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, AwareDatetime
from psycopg.errors import ExclusionViolation
from psycopg.types.json import Jsonb
from app.db import db, one, many
from app.domain import bill, meter_quantity, optimize
from app.sms import provider

app=FastAPI(title='YantraSetu',version='0.1.0')
ORIGIN=os.getenv('FRONTEND_ORIGIN','http://localhost:5173')
SECRET=os.environ.get('OTP_SECRET','')
if len(SECRET)<32: raise RuntimeError('Set OTP_SECRET to at least 32 random characters')
DEV=os.getenv('APP_ENV','development')=='development'
provider() # fail closed until a live adapter is implemented
app.add_middleware(CORSMiddleware,allow_origins=[ORIGIN],allow_credentials=True,allow_methods=['GET','POST','PATCH'],allow_headers=['Content-Type','X-Requested-With'])

@app.middleware('http')
async def safety_headers(request,call_next):
    if request.method in ('POST','PATCH','DELETE','PUT'):
        if request.headers.get('x-requested-with')!='YantraSetu' or request.headers.get('origin',ORIGIN)!=ORIGIN:
            return Response('Invalid request origin',403)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Cache-Control']='no-store'
    response.headers['Referrer-Policy']='same-origin'
    return response

@app.exception_handler(ExclusionViolation)
async def overlap(request,exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=409,content={'detail':'BOOKING_CONFLICT: Machine or operator already reserved, including turnaround buffer. Refresh availability.'})

def uid(): return str(uuid4())
def digest(value): return hmac.new(SECRET.encode(),value.encode(),hashlib.sha256).hexdigest()
def require(condition,message='Forbidden',status=403):
    if not condition: raise HTTPException(status,message)
def user(request:Request):
    token=request.cookies.get('ys_session','')
    with db() as c:
        u=one(c,'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=%s AND s.expires_at>now()',(digest(token),))
    require(u is not None,'Sign in first',401)
    return u

def throttle(c,key,limit,seconds):
    c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',(key,))
    row=one(c,'SELECT * FROM rate_limits WHERE bucket=%s',(key,))
    now=datetime.now(timezone.utc)
    if row and row['started_at']>now-timedelta(seconds=seconds):
        require(row['attempts']<limit,'Too many attempts; please wait',429)
        c.execute('UPDATE rate_limits SET attempts=attempts+1 WHERE bucket=%s',(key,))
    else:
        c.execute('INSERT INTO rate_limits VALUES(%s,1,%s) ON CONFLICT(bucket) DO UPDATE SET attempts=1,started_at=EXCLUDED.started_at',(key,now))

def audit(c,u,b,action,detail={}):
    c.execute('INSERT INTO audit_log(actor_id,booking_id,action,detail) VALUES(%s,%s,%s,%s)',(u,b,action,Jsonb(detail)))
def notify(c,u,message):
    c.execute('INSERT INTO notifications(user_id,message) VALUES(%s,%s)',(u,message))
def issue(c,phone,purpose,payload):
    throttle(c,'send:'+phone,5,600)
    code=f'{secrets.randbelow(1000000):06}'
    ident=uid()
    c.execute('INSERT INTO challenges(id,phone,purpose,digest,payload,expires_at) VALUES(%s,%s,%s,%s,%s,now()+interval \'5 minutes\')',(ident,phone,purpose,digest(ident+code),Jsonb(payload)))
    status=provider().send(phone,f'YantraSetu verification code: {code}')
    return {'challenge_id':ident,'expires_in':300,**status,**({'development_code':code} if DEV else {})}

def consume(c,ident,code,purpose,actor=None):
    row=one(c,'SELECT * FROM challenges WHERE id=%s FOR UPDATE',(ident,))
    require(row is not None,'Invalid challenge',400)
    require(row['purpose']==purpose,'Wrong verification purpose',400)
    if actor: require(row['phone']==actor['phone'],'This code belongs to the farmer who booked')
    require(row['consumed_at'] is None and row['expires_at']>datetime.now(timezone.utc) and row['attempts']<5,'Code expired or locked',400)
    c.execute('UPDATE challenges SET attempts=attempts+1 WHERE id=%s',(ident,))
    if not hmac.compare_digest(row['digest'],digest(str(ident)+code)):
        c.commit() # persist failed attempts even when HTTPException follows
        raise HTTPException(400,'Incorrect code')
    c.execute('UPDATE challenges SET consumed_at=now() WHERE id=%s',(ident,))
    return row

class Login(BaseModel):
    phone:str=Field(pattern=r'^\+91[6-9]\d{9}$')
class Verify(BaseModel):
    challenge_id:UUID
    code:str=Field(pattern=r'^\d{6}$')
class LoginVerify(Verify):
    name:str=Field(min_length=2,max_length=80)
    roles:list[Literal['farmer','owner','operator','fpo']]=Field(default=['farmer'],min_length=1,max_length=4)
    language:Literal['en','hi','pa']='en'

@app.get('/api/health')
def health():
    with db() as c: one(c,'SELECT 1')
    return {'database':'connected','sms':'SIMULATED_NOT_SENT','payments':'outside_platform_only','version':'0.1.0'}
@app.post('/api/auth/request')
def login(p:Login,request:Request):
    with db() as c:
        throttle(c,'ip:'+request.client.host,20,600)
        return issue(c,p.phone,'login',{})
@app.post('/api/auth/verify')
def verify(p:LoginVerify,response:Response):
    with db() as c:
        row=consume(c,p.challenge_id,p.code,'login')
        u=one(c,'SELECT * FROM users WHERE phone=%s',(row['phone'],))
        if not u:
            u=one(c,'INSERT INTO users(id,phone,name,roles,language) VALUES(%s,%s,%s,%s,%s) RETURNING *',(uid(),row['phone'],p.name,list(set(p.roles)),p.language))
        token=secrets.token_urlsafe(32)
        c.execute('INSERT INTO sessions VALUES(%s,%s,now()+interval \'24 hours\')',(digest(token),u['id']))
    response.set_cookie('ys_session',token,httponly=True,secure=not DEV,samesite='strict',max_age=86400,path='/')
    return u
@app.get('/api/me')
def me(u=Depends(user)): return u
@app.post('/api/auth/logout')
def logout(request:Request,response:Response):
    with db() as c: c.execute('DELETE FROM sessions WHERE token_hash=%s',(digest(request.cookies.get('ys_session','')),))
    response.delete_cookie('ys_session',path='/')
    return {'ok':True}

class Machine(BaseModel):
    name:str=Field(min_length=3,max_length=100)
    category:str=Field(min_length=2,max_length=50)
    description:str=Field(default='',max_length=1000)
    village:str=Field(min_length=2,max_length=100)
    latitude:float=Field(ge=-90,le=90,allow_inf_nan=False)
    longitude:float=Field(ge=-180,le=180,allow_inf_nan=False)
    rate:Decimal=Field(gt=0,le=100000,max_digits=12,decimal_places=2)
    unit:Literal['hour','acre']='hour'
    mobilization:Decimal=Field(default=0,ge=0,le=100000,max_digits=12,decimal_places=2)
    buffer_minutes:int=Field(default=15,ge=0,le=180)
    organization_id:UUID|None=None

MACHINE_SELECT='''SELECT m.id,m.owner_id,m.organization_id,m.name,m.category,m.description,m.village,m.rate,m.unit,m.mobilization,m.buffer_minutes,m.active,u.name AS owner_name,ST_Y(m.location::geometry) AS latitude,ST_X(m.location::geometry) AS longitude FROM machines m JOIN users u ON u.id=m.owner_id'''
@app.post('/api/machines')
def create_machine(p:Machine,u=Depends(user)):
    require('owner' in u['roles'],'Owner role required')
    with db() as c:
        if p.organization_id:
            require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(p.organization_id,u['id'])) is not None)
        ident=uid()
        c.execute('INSERT INTO machines(id,owner_id,organization_id,name,category,description,village,location,rate,unit,mobilization,buffer_minutes) VALUES(%s,%s,%s,%s,%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,%s,%s,%s,%s)',(ident,u['id'],p.organization_id,p.name,p.category,p.description,p.village,p.longitude,p.latitude,p.rate,p.unit,p.mobilization,p.buffer_minutes))
        return one(c,MACHINE_SELECT+' WHERE m.id=%s',(ident,))

class MachineUpdate(BaseModel):
    name:str|None=Field(default=None,min_length=3,max_length=100)
    category:str|None=Field(default=None,min_length=2,max_length=50)
    description:str|None=Field(default=None,max_length=1000)
    village:str|None=Field(default=None,min_length=2,max_length=100)
    latitude:float|None=Field(default=None,ge=-90,le=90,allow_inf_nan=False)
    longitude:float|None=Field(default=None,ge=-180,le=180,allow_inf_nan=False)
    rate:Decimal|None=Field(default=None,gt=0,le=100000,max_digits=12,decimal_places=2)
    unit:Literal['hour','acre']|None=None
    mobilization:Decimal|None=Field(default=None,ge=0,le=100000,max_digits=12,decimal_places=2)
    buffer_minutes:int|None=Field(default=None,ge=0,le=180)
    active:bool|None=None
    organization_id:UUID|None=None

@app.patch('/api/machines/{ident}')
def update_machine(ident:UUID,p:MachineUpdate,u=Depends(user)):
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(ident,))
        require(m is not None,'Machine not found',404)
        require(m['owner_id']==u['id'],'Forbidden: not machine owner',403)
        if p.organization_id is not None:
            require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(p.organization_id,u['id'])) is not None)
        updates,args=[],[]
        fields=['name','category','description','village','rate','unit','mobilization','buffer_minutes','active','organization_id']
        for field in fields:
            val=getattr(p,field)
            if val is not None:
                updates.append(f'{field}=%s')
                args.append(val)
        if p.latitude is not None and p.longitude is not None:
            updates.append('location=ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography')
            args.extend([p.longitude,p.latitude])
        if updates:
            args.append(ident)
            c.execute(f"UPDATE machines SET {','.join(updates)} WHERE id=%s",args)
        return one(c,MACHINE_SELECT+' WHERE m.id=%s',(ident,))
@app.get('/api/machines')
def machines(latitude:float=30.901,longitude:float=75.857,radius:int=5,category:str=''):
    require(-90<=latitude<=90 and -180<=longitude<=180 and 1<=radius<=50,'Invalid search radius or location',422)
    with db() as c:
        return many(c,MACHINE_SELECT+''' WHERE m.active AND (%s='' OR m.category=%s) AND ST_DWithin(m.location,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,%s) ORDER BY ST_Distance(m.location,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography) LIMIT 100''',(category,category,longitude,latitude,radius*1000,longitude,latitude))
@app.get('/api/fleet')
def fleet(u=Depends(user)):
    with db() as c: return many(c,MACHINE_SELECT+' WHERE m.owner_id=%s ORDER BY m.created_at',(u['id'],))
@app.get('/api/machines/{ident}/availability')
def availability(ident:UUID):
    with db() as c:
        return {'reserved':many(c,"SELECT start_at,reserved_until AS end_at,status FROM bookings WHERE machine_id=%s AND status IN ('PENDING','APPROVED','IN_PROGRESS') AND reserved_until>now() ORDER BY start_at",(ident,)), 'maintenance':many(c,'SELECT start_at,end_at FROM maintenance WHERE machine_id=%s AND end_at>now() ORDER BY start_at',(ident,))}
class Block(BaseModel):
    start_at:AwareDatetime
    end_at:AwareDatetime
    reason:str=Field(min_length=2,max_length=200)
@app.post('/api/machines/{ident}/maintenance')
def block(ident:UUID,p:Block,u=Depends(user)):
    require(p.end_at>p.start_at,'Invalid interval',422)
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(ident,))
        require(m and m['owner_id']==u['id'])
        clash=one(c,"SELECT id FROM bookings WHERE machine_id=%s AND status IN ('PENDING','APPROVED','IN_PROGRESS') AND tstzrange(start_at,reserved_until,'[)') && tstzrange(%s,%s,'[)')",(ident,p.start_at,p.end_at))
        require(not clash,'Existing reservation conflicts with maintenance',409)
        c.execute('INSERT INTO maintenance VALUES(%s,%s,%s,%s,%s)',(uid(),ident,p.start_at,p.end_at,p.reason))
    return {'ok':True}

class Booking(BaseModel):
    machine_id:UUID
    start_at:AwareDatetime
    end_at:AwareDatetime
    acres:Decimal|None=Field(default=None,gt=0,le=10000,max_digits=12,decimal_places=3)
    latitude:float=Field(ge=-90,le=90,allow_inf_nan=False)
    longitude:float=Field(ge=-180,le=180,allow_inf_nan=False)
    idempotency_key:UUID

def quote_for(p,m):
    require(p.end_at>p.start_at and p.end_at-p.start_at<=timedelta(days=2),'Choose a duration between 0 and 48 hours',422)
    quantity=Decimal(str((p.end_at-p.start_at).total_seconds()))/3600 if m['unit']=='hour' else p.acres
    require(quantity is not None,'Acreage required',422)
    return quantity,bill(m['rate'],quantity,m['mobilization'])
@app.post('/api/quote')
def quote(p:Booking,u=Depends(user)):
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s AND active',(p.machine_id,))
        require(m is not None,'Machine unavailable',404)
        q,b=quote_for(p,m)
        return {**b,'quantity':q,'unit':m['unit'],'rate':m['rate'],'payment':'Directly to owner outside platform'}
@app.post('/api/bookings')
def book(p:Booking,u=Depends(user)):
    require('farmer' in u['roles'],'Farmer role required')
    req_hash=hashlib.sha256(p.model_dump_json().encode()).hexdigest()
    with db() as c:
        c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',(str(u['id'])+str(p.idempotency_key),))
        existing=one(c,'SELECT * FROM bookings WHERE farmer_id=%s AND idempotency_key=%s',(u['id'],p.idempotency_key))
        if existing:
            require(existing['request_hash']==req_hash,'Idempotency key reused with changed request',409)
            return existing
        require(p.start_at>datetime.now(timezone.utc),'Start time must be in the future',422)
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(p.machine_id,))
        require(m and m['active'],'Machine unavailable',404)
        require(m['owner_id']!=u['id'],'Cannot book your own machine',422)
        quantity,b=quote_for(p,m)
        reserved_until=p.end_at+timedelta(minutes=m['buffer_minutes'])
        blocked=one(c,"SELECT id FROM maintenance WHERE machine_id=%s AND tstzrange(start_at,end_at,'[)') && tstzrange(%s,%s,'[)')",(p.machine_id,p.start_at,reserved_until))
        require(not blocked,'Machine under maintenance during this interval',409)
        ident=uid()
        row=one(c,'INSERT INTO bookings(id,machine_id,farmer_id,start_at,end_at,reserved_until,quantity,latitude,longitude,rate,unit,mobilization,estimate,idempotency_key,request_hash) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *',(ident,p.machine_id,u['id'],p.start_at,p.end_at,reserved_until,quantity,p.latitude,p.longitude,m['rate'],m['unit'],m['mobilization'],b['total'],p.idempotency_key,req_hash))
        audit(c,u['id'],ident,'BOOKING_REQUESTED')
        notify(c,m['owner_id'],f'New booking request {ident}')
        notify(c,u['id'],f'Booking {ident} awaits owner approval')
        return row

BOOKING_SELECT='''SELECT b.*,m.name AS machine_name,m.owner_id,m.village,u.name AS farmer_name FROM bookings b JOIN machines m ON m.id=b.machine_id JOIN users u ON u.id=b.farmer_id'''
def booking_access(c,ident,u,lock=False):
    row=one(c,BOOKING_SELECT+' WHERE b.id=%s'+(' FOR UPDATE OF b' if lock else ''),(ident,))
    require(row is not None,'Booking not found',404)
    require(u['id'] in (row['owner_id'],row['farmer_id'],row['operator_id']))
    return row
@app.get('/api/bookings')
def bookings(u=Depends(user)):
    with db() as c: return many(c,BOOKING_SELECT+' WHERE b.farmer_id=%s OR m.owner_id=%s OR b.operator_id=%s ORDER BY b.created_at DESC',(u['id'],)*3)
class Action(BaseModel):
    action:Literal['approve','reject','cancel']
@app.post('/api/bookings/{ident}/action')
def action(ident:UUID,p:Action,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        if p.action=='cancel':
            require(u['id'] in (b['owner_id'],b['farmer_id']))
            require(b['status'] in ('PENDING','APPROVED'),'Cannot cancel this booking state',409)
            state='CANCELLED'
        else:
            require(u['id']==b['owner_id'])
            require(b['status']=='PENDING','Only pending requests can be approved or rejected',409)
            require(b['start_at']>datetime.now(timezone.utc),'Request start time has passed; cancel and rebook',409)
            state='APPROVED' if p.action=='approve' else 'REJECTED'
        c.execute('UPDATE bookings SET status=%s WHERE id=%s',(state,ident))
        audit(c,u['id'],ident,state)
        notify(c,b['farmer_id'],f'Booking {ident}: {state}')
        notify(c,b['owner_id'],f'Booking {ident}: {state}')
    return {'status':state}
class OperatorAssignment(BaseModel):
    phone:str=Field(pattern=r'^\+91[6-9]\d{9}$')
@app.post('/api/bookings/{ident}/operator')
def assign(ident:UUID,p:OperatorAssignment,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(b['owner_id']==u['id'] and b['status']=='APPROVED')
        op=one(c,"SELECT id FROM users WHERE phone=%s AND 'operator'=ANY(roles)",(p.phone,))
        require(op is not None,'Operator must register first',422)
        c.execute('UPDATE bookings SET operator_id=%s WHERE id=%s',(op['id'],ident))
        audit(c,u['id'],ident,'OPERATOR_ASSIGNED',{'operator_id':str(op['id'])})
        notify(c,op['id'],f'Assigned booking {ident}. Contact owner if unavailable.')
    return {'ok':True}
class Reading(BaseModel):
    stage:Literal['start','end']
    reading:Decimal=Field(ge=0,le=100000000,max_digits=12,decimal_places=3)
    acres:Decimal|None=Field(default=None,gt=0,le=10000,max_digits=12,decimal_places=3)
@app.post('/api/bookings/{ident}/meter/request')
def meter_request(ident:UUID,p:Reading,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(u['id'] in (b['owner_id'],b['operator_id']),'Owner or assigned operator submits readings')
        require(b['status']==('APPROVED' if p.stage=='start' else 'IN_PROGRESS'),'Wrong booking stage',409)
        if p.stage=='end':
            meter_quantity(b['meter_start'],p.reading)
            require(b['unit']!='acre' or p.acres is not None,'Completed acreage required',422)
        farmer=one(c,'SELECT phone FROM users WHERE id=%s',(b['farmer_id'],))
        result=issue(c,farmer['phone'],'meter',{'booking_id':str(ident),'stage':p.stage,'reading':str(p.reading),'acres':str(p.acres) if p.acres is not None else None})
        audit(c,u['id'],ident,'METER_CONFIRMATION_REQUESTED',{'stage':p.stage,'reading':str(p.reading)})
        return result
@app.get('/api/bookings/{ident}/meter/pending')
def pending_meter(ident:UUID,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u)
        require(b['farmer_id']==u['id'])
        return many(c,"SELECT id,payload,expires_at FROM challenges WHERE phone=%s AND purpose='meter' AND payload->>'booking_id'=%s AND consumed_at IS NULL AND expires_at>now() AND attempts<5 ORDER BY created_at DESC",(u['phone'],str(ident)))
@app.post('/api/bookings/{ident}/meter/confirm')
def meter_confirm(ident:UUID,p:Verify,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(b['farmer_id']==u['id'],'Farmer must confirm the reading')
        row=consume(c,p.challenge_id,p.code,'meter',u)
        data=row['payload']
        require(data['booking_id']==str(ident),'Challenge belongs to another booking',400)
        expected='APPROVED' if data['stage']=='start' else 'IN_PROGRESS'
        require(b['status']==expected,'Reading no longer applies',409)
        if data['stage']=='start':
            one(c,'SELECT id FROM machines WHERE id=%s FOR UPDATE',(b['machine_id'],))
            require(b['start_at']<=datetime.now(timezone.utc)<b['end_at'],'Work can start only within the approved time slot',409)
            running=one(c,"SELECT id FROM bookings WHERE machine_id=%s AND status='IN_PROGRESS' AND id<>%s",(b['machine_id'],ident))
            require(not running,'Previous job is still in progress. Resolve the overrun before starting.',409)
            c.execute("UPDATE bookings SET meter_start=%s,status='IN_PROGRESS' WHERE id=%s",(Decimal(data['reading']),ident))
        else:
            hours=meter_quantity(b['meter_start'],data['reading'])
            quantity=hours if b['unit']=='hour' else Decimal(data['acres'])
            total=bill(b['rate'],quantity,b['mobilization'])['total']
            c.execute("UPDATE bookings SET meter_end=%s,actual_quantity=%s,final_total=%s,status='COMPLETED' WHERE id=%s",(data['reading'],quantity,total,ident))
        audit(c,u['id'],ident,'METER_'+data['stage'].upper()+'_CONFIRMED',data)
        notify(c,b['owner_id'],f'Booking {ident}: {data["stage"]} reading confirmed by farmer')
    return {'ok':True}
class PaymentReport(BaseModel):
    status:Literal['UNPAID','PAID_OUTSIDE_PLATFORM','PAYMENT_DISPUTED']
@app.post('/api/bookings/{ident}/payment-report')
def payment(ident:UUID,p:PaymentReport,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(u['id'] in (b['owner_id'],b['farmer_id']) and b['status']=='COMPLETED')
        c.execute('UPDATE bookings SET payment_status=%s,payment_reported_by=%s,payment_reported_at=now() WHERE id=%s',(p.status,u['id'],ident))
        audit(c,u['id'],ident,'MANUAL_PAYMENT_REPORT',{'before':b['payment_status'],'after':p.status})
        notify(c,b['owner_id'],f'Booking {ident}: manually reported {p.status}; not verified')
        notify(c,b['farmer_id'],f'Booking {ident}: manually reported {p.status}; not verified')
    return {'status':p.status,'notice':'Manually reported; not independently verified'}
class Rating(BaseModel):
    score:int=Field(ge=1,le=5)
    comment:str=Field(default='',max_length=500)
@app.post('/api/bookings/{ident}/rating')
def rate(ident:UUID,p:Rating,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(b['status']=='COMPLETED' and u['id'] in (b['farmer_id'],b['owner_id']))
        target=b['owner_id'] if u['id']==b['farmer_id'] else b['farmer_id']
        c.execute('INSERT INTO ratings VALUES(%s,%s,%s,%s,%s) ON CONFLICT(booking_id,author_id) DO UPDATE SET score=EXCLUDED.score,comment=EXCLUDED.comment',(ident,u['id'],target,p.score,p.comment))
    return {'ok':True}
@app.get('/api/bookings/{ident}/invoice')
def invoice(ident:UUID,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u)
        require(b['status']=='COMPLETED','Final invoice requires confirmed completion',409)
        return {'invoice_number':'YS-'+str(ident),'booking':b,'breakdown':bill(b['rate'],b['actual_quantity'],b['mobilization']),'notice':'Rental bill, not proof of payment. Payment status is manually reported and not independently verified. No platform fee. Tax treatment requires owner configuration before a real commercial pilot.'}
@app.get('/api/notifications')
def notifications(u=Depends(user)):
    with db() as c: return many(c,'SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 100',(u['id'],))
@app.get('/api/bookings/{ident}/audit')
def history(ident:UUID,u=Depends(user)):
    with db() as c:
        booking_access(c,ident,u)
        return many(c,'SELECT action,detail,created_at FROM audit_log WHERE booking_id=%s ORDER BY id',(ident,))
class Organization(BaseModel):
    name:str=Field(min_length=3,max_length=100)
@app.post('/api/organizations')
def organization(p:Organization,u=Depends(user)):
    require('fpo' in u['roles'])
    with db() as c: return one(c,'INSERT INTO organizations VALUES(%s,%s,%s) RETURNING *',(uid(),u['id'],p.name))
@app.get('/api/organizations')
def organizations(u=Depends(user)):
    with db() as c:
        return many(c,'SELECT o.*, (SELECT count(*) FROM machines m WHERE m.organization_id=o.id) AS machines FROM organizations o WHERE manager_id=%s',(u['id'],))
@app.get('/api/organizations/{ident}/bookings')
def org_bookings(ident:UUID,u=Depends(user)):
    with db() as c:
        require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(ident,u['id'])) is not None)
        return many(c,BOOKING_SELECT+' WHERE m.organization_id=%s ORDER BY b.start_at',(ident,))
@app.get('/api/routes/{machine_id}')
def route(machine_id:UUID,day:date,u=Depends(user)):
    from zoneinfo import ZoneInfo
    import time
    tz=ZoneInfo('Asia/Kolkata')
    start=datetime.combine(day,datetime.min.time(),tzinfo=tz)
    with db() as c:
        m=one(c,MACHINE_SELECT+' WHERE m.id=%s',(machine_id,))
        require(m and m['owner_id']==u['id'])
        rows=many(c,"SELECT * FROM bookings WHERE machine_id=%s AND status='APPROVED' AND start_at>=%s AND start_at<%s ORDER BY start_at",(machine_id,start,start+timedelta(days=1)))
    require(1<=len(rows)<=8,'Select a day with 1–8 approved bookings',422)
    jobs=[]
    for b in rows:
        minute=(b['start_at']-start).total_seconds()/60
        jobs.append({'id':str(b['id']),'point':(b['latitude'],b['longitude']),'earliest':minute,'latest_start':minute,'duration':(b['reserved_until']-b['start_at']).total_seconds()/60})
    timer=time.perf_counter()
    result=optimize((m['latitude'],m['longitude']),jobs)
    result['elapsed_ms']=round((time.perf_counter()-timer)*1000,3)
    result['run_id']=uid()
    return result

@app.exception_handler(ValueError)
async def invalid(request,exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=422,content={'detail':str(exc)})
