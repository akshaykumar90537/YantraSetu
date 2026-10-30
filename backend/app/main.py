import os, secrets, hashlib, hmac, json, math
from pathlib import Path
from uuid import uuid4, UUID
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import Literal
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, AwareDatetime, EmailStr, field_validator
from psycopg.errors import ExclusionViolation
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

# Automatically load .env if present in project root or parent
env_path = Path(__file__).resolve().parents[2] / '.env'
if env_path.exists():
    load_dotenv(env_path, override=False)
else:
    load_dotenv(override=False)

from app.db import db, one, many
from app.domain import bill, meter_quantity, find_next_available_slot, validate_booking_interval, MIN_BOOKING_DURATION, MAX_BOOKING_DURATION
from app.sms import provider
from app.email_auth import email_mode, send_email, verify_google

app=FastAPI(title='YantraSetu',version='0.1.0')
_origins_raw=os.getenv('FRONTEND_ORIGIN','http://localhost:5173')
ALLOWED_ORIGINS=set(o.strip() for o in _origins_raw.split(',') if o.strip())
ALLOWED_ORIGINS.update({
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://yantrasetu-eight.vercel.app',
})
if os.getenv('VERCEL_URL'):
    ALLOWED_ORIGINS.add(f"https://{os.getenv('VERCEL_URL')}")
if os.getenv('VERCEL_PROJECT_PRODUCTION_URL'):
    ALLOWED_ORIGINS.add(f"https://{os.getenv('VERCEL_PROJECT_PRODUCTION_URL')}")

ORIGIN=next(iter(ALLOWED_ORIGINS)) if ALLOWED_ORIGINS else 'http://localhost:5173'
DEV=os.getenv('APP_ENV','development')=='development'
SECRET=os.environ.get('OTP_SECRET','')
if len(SECRET)<32:
    if DEV or os.getenv('VERCEL')=='1' or not os.getenv('DATABASE_URL'):
        SECRET='7c6d6a5c2f73db936128015f81ad3e6fef39f45d1da33f3c9cfdbbcd7e7f00cd'
    else:
        raise RuntimeError('Set OTP_SECRET to at least 32 random characters')

DEMO_USERS = {
    '+919000000002': {
        'id': '00000000-0000-4000-8000-000000000002',
        'phone': '+919000000002',
        'email': None,
        'name': 'Harpreet Singh (Owner)',
        'roles': ['farmer', 'owner'],
        'language': 'en',
    }
}
DEMO_CHALLENGES = {}
DEMO_SESSIONS = {}

def is_origin_allowed(origin: str | None) -> bool:
    if not origin: return True
    if origin in ALLOWED_ORIGINS: return True
    if origin.endswith('.vercel.app'): return True
    return False

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_origins=list(ALLOWED_ORIGINS),
    allow_credentials=True,
    allow_methods=['GET','POST','PATCH','DELETE','OPTIONS'],
    allow_headers=['Content-Type','X-Requested-With']
)

@app.middleware('http')
async def safety_headers(request,call_next):
    # Route normalization: ensure /api prefix is present for serverless proxies
    path = request.scope.get('path', '')
    if not path.startswith('/api') and not path.startswith('/docs') and not path.startswith('/openapi.json'):
        request.scope['path'] = '/api' + path

    if request.method in ('POST','PATCH','DELETE','PUT'):
        req_origin = request.headers.get('origin')
        if request.headers.get('x-requested-with')!='YantraSetu':
            return Response('Invalid request header',403)
        if req_origin and not is_origin_allowed(req_origin):
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
    require(bool(token),'Sign in first',401)
    try:
        with db() as c:
            u=one(c,'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=%s AND s.expires_at>now()',(digest(token),))
        require(u is not None,'Sign in first',401)
        return u
    except HTTPException:
        raise
    except Exception:
        u_id = DEMO_SESSIONS.get(digest(token))
        if u_id:
            for du in DEMO_USERS.values():
                if str(du['id']) == str(u_id):
                    return du
        raise HTTPException(401,'Sign in first')

def optional_user(request:Request):
    token=request.cookies.get('ys_session','')
    if not token: return None
    try:
        with db() as c:
            return one(c,'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=%s AND s.expires_at>now()',(digest(token),))
    except Exception:
        u_id = DEMO_SESSIONS.get(digest(token))
        if u_id:
            for du in DEMO_USERS.values():
                if str(du['id']) == str(u_id):
                    return du
        return None

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
def contact(u):
    return u.get('phone') or u.get('email')

def issue(c,phone,purpose,payload):
    throttle(c,'send:'+phone,5,600)
    code=f'{secrets.randbelow(1000000):06}'
    ident=uid()
    payload={**payload,'development': '@' not in phone or email_mode()=='development'}
    c.execute('INSERT INTO challenges(id,phone,purpose,digest,payload,expires_at) VALUES(%s,%s,%s,%s,%s,now()+interval \'5 minutes\')',(ident,phone,purpose,digest(ident+code),Jsonb(payload)))
    if '@' in phone:
        status=send_email(phone,code)
    else:
        try:
            status=provider().send(phone,f'YantraSetu verification code: {code}')
        except Exception:
            status={'delivery':'SIMULATED_NOT_SENT'}
        status['development_code']=code
    return {'challenge_id':ident,'expires_in':300,**status}

def consume(c,ident,code,purpose,actor=None):
    row=one(c,'SELECT * FROM challenges WHERE id=%s FOR UPDATE',(ident,))
    require(row is not None,'Invalid challenge',400)
    require(row['purpose']==purpose,'Wrong verification purpose',400)
    require(DEV or not row['payload'].get('development',False) or row.get('purpose') in ('login','email_login'),'Development codes cannot be used in production',400)
    if actor: require(row['phone']==contact(actor),'This code belongs to the farmer who booked')
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
    name:str|None=Field(default=None,min_length=2,max_length=80)
    roles:list[Literal['farmer','owner','operator','fpo']]|None=Field(default=None,min_length=1,max_length=4)
    language:Literal['en','hi','pa']='en'
    phone:str|None=None
    email:str|None=None

def establish_session(c,u,response):
    token=secrets.token_urlsafe(32)
    c.execute("INSERT INTO sessions VALUES(%s,%s,now()+interval '24 hours')",(digest(token),u['id']))
    response.set_cookie('ys_session',token,httponly=True,secure=not DEV,samesite='strict',max_age=86400,path='/')
    return u

class EmailLogin(BaseModel):
    email:str=Field(pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$',max_length=254)
class GoogleLogin(BaseModel):
    credential:str=Field(min_length=20,max_length=10000)

@app.get('/api/auth/config')
def auth_config():
    return {'email':email_mode(), 'phone':True, 'google_client_id':os.getenv('GOOGLE_CLIENT_ID','') if email_mode()!='disabled' else ''}

@app.post('/api/auth/email/request')
def email_request(p:EmailLogin,request:Request):
    require(email_mode()!='disabled','Email sign-in is not configured.',503)
    with db() as c:
        throttle(c,'ip:'+request.client.host,20,600)
        return issue(c,str(p.email).lower(),'email_login',{})

@app.post('/api/auth/google/nonce')
def google_nonce(request:Request,response:Response):
    require(bool(os.getenv('GOOGLE_CLIENT_ID')) and email_mode()!='disabled','Google sign-in is not configured.',503)
    with db() as c:
        throttle(c,'google-ip:'+request.client.host,20,600)
    nonce=secrets.token_urlsafe(32)
    response.set_cookie('ys_google_nonce',nonce,httponly=True,secure=not DEV,samesite='strict',max_age=300,path='/api/auth/google')
    return {'nonce':nonce}

@app.post('/api/auth/google')
def google_request(p:GoogleLogin,request:Request,response:Response):
    nonce=request.cookies.get('ys_google_nonce','')
    require(bool(nonce),'Restart Google sign-in.',401)
    with db() as c:
        throttle(c,'google-verify:'+request.client.host,20,600)
    claims=verify_google(p.credential)
    require(hmac.compare_digest(str(claims.get('nonce','')),nonce),'Invalid Google sign-in nonce.',401)
    email=str(EmailLogin(email=claims['email']).email).lower()
    with db() as c:
        # A persisted one-use nonce prevents replay even with a copied cookie.
        throttle(c,'google-nonce:'+digest(nonce),1,600)
        result=issue(c,email,'email_login',{'google_sub':claims['sub']})
    response.delete_cookie('ys_google_nonce',path='/api/auth/google')
    return {**result,'email':email}

@app.post('/api/auth/email/verify')
def email_verify(p:LoginVerify,response:Response):
    with db() as c:
        row=consume(c,p.challenge_id,p.code,'email_login')
        email=row['phone'] # Legacy column stores the challenge destination.
        c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',('email:'+email,))
        sub=row['payload'].get('google_sub')
        u=one(c,'SELECT * FROM users WHERE lower(email)=%s',(email,))
        if sub:
            linked=one(c,'SELECT * FROM users WHERE google_sub=%s',(sub,))
            require(not linked or (u is not None and linked['id']==u['id']),
                    'Google account email changed. Sign in with your existing email and contact support.',409)
            require(not u or not u['google_sub'] or u['google_sub']==sub,'Email belongs to a different Google identity.',409)
        if not u:
            require(p.name is not None and len(p.name.strip())>=2,'Your name is required to create an account.',422)
            u=one(c,'INSERT INTO users(id,email,name,roles,language,email_verified_at,google_sub) VALUES(%s,%s,%s,%s,%s,now(),%s) RETURNING *',
                  (uid(),email,p.name.strip(),list(set(p.roles or ['farmer'])),p.language,sub))
        else:
            # Login never changes existing roles or profile names.
            u=one(c,'UPDATE users SET email_verified_at=now(),google_sub=COALESCE(google_sub,%s) WHERE id=%s RETURNING *',(sub,u['id']))
        return establish_session(c,u,response)

@app.get('/api/health')
@app.get('/health')
def health():
    db_status = 'connected'
    try:
        with db() as c: one(c,'SELECT 1')
    except Exception:
        db_status = 'disconnected_demo_mode'
    return {'status':'ok','database':db_status,'sms':'SIMULATED_NOT_SENT','payments':'outside_platform_only','version':'0.1.0'}
@app.post('/api/auth/request')
def login(p:Login,request:Request):
    try:
        with db() as c:
            client_host = request.client.host if request.client else '127.0.0.1'
            throttle(c,'ip:'+client_host,20,600)
            existing = one(c,'SELECT id,name,roles,phone FROM users WHERE phone=%s',(p.phone,))
            res = issue(c,p.phone,'login',{'user_exists': existing is not None})
            res['is_new_user'] = existing is None
            return res
    except HTTPException:
        raise
    except Exception:
        ch_id = str(uuid4())
        is_new = p.phone not in DEMO_USERS
        DEMO_CHALLENGES[ch_id] = {'phone': p.phone, 'is_new_user': is_new}
        return {
            'challenge_id': ch_id,
            'expires_in': 300,
            'delivery': 'SIMULATED_NOT_SENT',
            'development_code': '123456',
            'message': 'Demo mode active. Use code: 123456',
            'is_new_user': is_new,
        }

@app.post('/api/auth/verify')
def verify(p:LoginVerify,response:Response):
    try:
        with db() as c:
            row=consume(c,p.challenge_id,p.code,'login')
            u=one(c,'SELECT * FROM users WHERE phone=%s',(row['phone'],))
            if not u:
                require(p.name is not None and len(p.name.strip())>=2,'Your name is required to complete new account registration',422)
                assigned_roles=list(set(p.roles)) if p.roles else ['farmer']
                import uuid
                phone_uuid=str(uuid.uuid5(uuid.NAMESPACE_OID,row['phone']))
                u=one(c,'INSERT INTO users(id,phone,name,roles,language) VALUES(%s,%s,%s,%s,%s) RETURNING *',(phone_uuid,row['phone'],p.name.strip(),assigned_roles,p.language))
            return establish_session(c,u,response)
    except HTTPException:
        raise
    except Exception:
        import uuid
        ch = DEMO_CHALLENGES.get(str(p.challenge_id))
        phone = ch['phone'] if ch else p.phone or '+919000000002'
        phone_uuid = str(uuid.uuid5(uuid.NAMESPACE_OID, phone))
        if phone in DEMO_USERS:
            u = DEMO_USERS[phone]
        else:
            require(p.name is not None and len(p.name.strip())>=2,'Your name is required to complete new account registration',422)
            assigned_roles = list(set(p.roles)) if p.roles else ['farmer']
            u = {
                'id': phone_uuid,
                'phone': phone,
                'email': None,
                'name': p.name.strip(),
                'roles': assigned_roles,
                'language': p.language,
            }
            DEMO_USERS[phone] = u
        token = secrets.token_urlsafe(32)
        DEMO_SESSIONS[digest(token)] = u['id']
        response.set_cookie('ys_session', token, httponly=True, secure=not DEV, samesite='strict', max_age=86400, path='/')
        return u

@app.get('/api/me')
def me(u=Depends(user)): return u
@app.post('/api/auth/logout')
def logout(request:Request,response:Response):
    token = request.cookies.get('ys_session','')
    try:
        with db() as c: c.execute('DELETE FROM sessions WHERE token_hash=%s',(digest(token),))
    except Exception:
        pass
    if token:
        DEMO_SESSIONS.pop(digest(token), None)
    response.delete_cookie('ys_session',path='/')
    return {'ok':True}

class Attachment(BaseModel):
    name:str=Field(min_length=2,max_length=50)
    rate:Decimal=Field(ge=0,le=50000,max_digits=12,decimal_places=2)

class Machine(BaseModel):
    name:str=Field(min_length=3,max_length=100)
    category:str=Field(min_length=2,max_length=50)
    model:str=Field(default='Standard',min_length=2,max_length=100)
    description:str=Field(default='',max_length=1000)
    village:str=Field(min_length=2,max_length=100)
    latitude:float=Field(ge=-90,le=90,allow_inf_nan=False)
    longitude:float=Field(ge=-180,le=180,allow_inf_nan=False)
    rate:Decimal=Field(gt=0,le=100000,max_digits=12,decimal_places=2)
    unit:Literal['hour','acre']='hour'
    mobilization:Decimal=Field(default=0,ge=0,le=100000,max_digits=12,decimal_places=2)
    buffer_minutes:int=Field(default=15,ge=0,le=180)
    organization_id:UUID|None=None
    attachments:list[Attachment]=Field(default=[])
    fuel_included:bool=Field(default=False)
    fuel_rate_extra:Decimal=Field(default=0,ge=0,le=50000,max_digits=12,decimal_places=2)

    @field_validator('name','category','model','village',mode='before')
    @classmethod
    def strip_and_validate_text(cls, v):
        if v is None: raise ValueError('Field cannot be null')
        s = str(v).strip()
        if not s: raise ValueError('Field cannot be empty or whitespace-only')
        return s

    @field_validator('rate')
    @classmethod
    def check_rate(cls, v):
        if v <= 0: raise ValueError('Rate must be greater than zero')
        return v

    @field_validator('buffer_minutes')
    @classmethod
    def check_buffer(cls, v):
        if v < 0: raise ValueError('Buffer cannot be negative')
        return v

    @field_validator('mobilization','fuel_rate_extra')
    @classmethod
    def check_nonneg(cls, v):
        if v < 0: raise ValueError('Amount cannot be negative')
        return v

MACHINE_SELECT='''SELECT m.id,m.owner_id,m.organization_id,m.name,m.category,COALESCE(m.model, 'Standard') AS model,m.description,m.village,m.rate,m.unit,m.mobilization,m.buffer_minutes,m.active,COALESCE(m.is_active, m.active) AS is_active,COALESCE(m.attachments, '[]'::jsonb) AS attachments,COALESCE(m.fuel_included, false) AS fuel_included,COALESCE(m.fuel_rate_extra, 0) AS fuel_rate_extra,u.name AS owner_name,u.phone AS owner_phone,ST_Y(m.location::geometry) AS latitude,ST_X(m.location::geometry) AS longitude,
COALESCE((SELECT ROUND(AVG(r.score)::numeric, 1) FROM ratings r JOIN bookings b ON b.id=r.booking_id WHERE b.machine_id=m.id AND r.target_id=m.owner_id), 0) AS rating_avg,
COALESCE((SELECT COUNT(*) FROM ratings r JOIN bookings b ON b.id=r.booking_id WHERE b.machine_id=m.id AND r.target_id=m.owner_id), 0) AS rating_count,
COALESCE((SELECT array_agg(DISTINCT badge) FROM ratings r JOIN bookings b ON b.id=r.booking_id, unnest(r.badges) AS badge WHERE b.machine_id=m.id AND r.target_id=m.owner_id), ARRAY[]::text[]) AS badges
FROM machines m JOIN users u ON u.id=m.owner_id'''
@app.post('/api/machines')
def create_machine(p:Machine,u=Depends(user)):
    require('owner' in u['roles'],'Owner role required')
    with db() as c:
        if p.organization_id:
            require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(p.organization_id,u['id'])) is not None)
        ident=uid()
        att_json=Jsonb([a.model_dump(mode='json') for a in p.attachments])
        c.execute('INSERT INTO machines(id,owner_id,organization_id,name,category,model,description,village,location,rate,unit,mobilization,buffer_minutes,attachments,fuel_included,fuel_rate_extra,active,is_active) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,%s,%s,%s,%s,%s,%s,%s,true,true)',(ident,u['id'],p.organization_id,p.name,p.category,p.model,p.description,p.village,p.longitude,p.latitude,p.rate,p.unit,p.mobilization,p.buffer_minutes,att_json,p.fuel_included,p.fuel_rate_extra))
        return one(c,MACHINE_SELECT+' WHERE m.id=%s',(ident,))

class MachineUpdate(BaseModel):
    name:str|None=Field(default=None,min_length=3,max_length=100)
    category:str|None=Field(default=None,min_length=2,max_length=50)
    model:str|None=Field(default=None,min_length=2,max_length=100)
    description:str|None=Field(default=None,max_length=1000)
    village:str|None=Field(default=None,min_length=2,max_length=100)
    latitude:float|None=Field(default=None,ge=-90,le=90,allow_inf_nan=False)
    longitude:float|None=Field(default=None,ge=-180,le=180,allow_inf_nan=False)
    rate:Decimal|None=Field(default=None,gt=0,le=100000,max_digits=12,decimal_places=2)
    unit:Literal['hour','acre']|None=None
    mobilization:Decimal|None=Field(default=None,ge=0,le=100000,max_digits=12,decimal_places=2)
    buffer_minutes:int|None=Field(default=None,ge=0,le=180)
    active:bool|None=None
    is_active:bool|None=None
    organization_id:UUID|None=None
    attachments:list[Attachment]|None=None
    fuel_included:bool|None=None
    fuel_rate_extra:Decimal|None=Field(default=None,ge=0,le=50000,max_digits=12,decimal_places=2)

    @field_validator('name','category','model','village',mode='before')
    @classmethod
    def strip_and_validate_update_text(cls, v):
        if v is None: return None
        s = str(v).strip()
        if not s: raise ValueError('Field cannot be empty or whitespace-only')
        return s

class MachineStatusUpdate(BaseModel):
    is_active:bool

@app.patch('/api/machines/{ident}/status')
@app.post('/api/machines/{ident}/status')
def update_machine_status(ident:UUID,p:MachineStatusUpdate,u=Depends(user)):
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(ident,))
        require(m is not None,'Machine not found',404)
        require(m['owner_id']==u['id'],'Forbidden: not machine owner',403)
        c.execute('UPDATE machines SET active=%s, is_active=%s WHERE id=%s',(p.is_active,p.is_active,ident))
        return one(c,MACHINE_SELECT+' WHERE m.id=%s',(ident,))

@app.patch('/api/machines/{ident}')
def update_machine(ident:UUID,p:MachineUpdate,u=Depends(user)):
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(ident,))
        require(m is not None,'Machine not found',404)
        require(m['owner_id']==u['id'],'Forbidden: not machine owner',403)
        if p.organization_id is not None:
            require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(p.organization_id,u['id'])) is not None)
        updates,args=[],[]
        fields=['name','category','model','description','village','rate','unit','mobilization','buffer_minutes','active','is_active','organization_id','fuel_included','fuel_rate_extra']
        if p.attachments is not None:
            updates.append('attachments=%s')
            args.append(Jsonb([a.model_dump(mode='json') for a in p.attachments]))
        for field in fields:
            val=getattr(p,field)
            if val is not None:
                updates.append(f'{field}=%s')
                args.append(val)
                if field == 'active' and p.is_active is None:
                    updates.append('is_active=%s')
                    args.append(val)
                elif field == 'is_active' and p.active is None:
                    updates.append('active=%s')
                    args.append(val)
        if p.latitude is not None and p.longitude is not None:
            updates.append('location=ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography')
            args.extend([p.longitude,p.latitude])
        if updates:
            args.append(ident)
            c.execute(f"UPDATE machines SET {','.join(updates)} WHERE id=%s",args)
        return one(c,MACHINE_SELECT+' WHERE m.id=%s',(ident,))
DEMO_MACHINES = [
    {
        'id': '10000000-0000-4000-8000-000000000001',
        'owner_id': '00000000-0000-4000-8000-000000000002',
        'organization_id': None,
        'name': 'DEMO · Mahindra 575 DI (45 HP)',
        'category': 'Tractor',
        'model': '575 DI',
        'description': 'Synthetic hackathon listing. Verified with attachments & fuel options.',
        'village': 'Ludhiana Ag Hub',
        'rate': 650.0,
        'unit': 'hour',
        'mobilization': 250.0,
        'buffer_minutes': 15,
        'active': True,
        'is_active': True,
        'attachments': [
            {'name': 'Rotavator', 'rate': 250},
            {'name': 'Disc Harrow', 'rate': 200},
            {'name': 'Trolley', 'rate': 150}
        ],
        'fuel_included': True,
        'fuel_rate_extra': 180.0,
        'owner_name': 'Harpreet Singh (Owner)',
        'owner_phone': '+919000000002',
        'latitude': 30.901,
        'longitude': 75.857,
        'rating_avg': 5.0,
        'rating_count': 1,
        'badges': ['Clean Machine', 'Experienced Driver', 'Full Tank', 'On-Time Arrival']
    },
    {
        'id': '10000000-0000-4000-8000-000000000002',
        'owner_id': '00000000-0000-4000-8000-000000000002',
        'organization_id': None,
        'name': 'DEMO · Shaktiman 6-foot Rotavator',
        'category': 'Rotavator',
        'model': '6-foot',
        'description': 'Heavy duty rotavator for soil preparation.',
        'village': 'Ludhiana Ag Hub',
        'rate': 1200.0,
        'unit': 'acre',
        'mobilization': 0.0,
        'buffer_minutes': 15,
        'active': True,
        'is_active': True,
        'attachments': [
            {'name': 'Laser Leveller', 'rate': 350}
        ],
        'fuel_included': False,
        'fuel_rate_extra': 0.0,
        'owner_name': 'Harpreet Singh (Owner)',
        'owner_phone': '+919000000002',
        'latitude': 30.912,
        'longitude': 75.865,
        'rating_avg': 4.8,
        'rating_count': 3,
        'badges': ['Sharp Blades', 'On-Time Arrival']
    },
    {
        'id': '10000000-0000-4000-8000-000000000003',
        'owner_id': '00000000-0000-4000-8000-000000000002',
        'organization_id': None,
        'name': 'DEMO · Preet 987 Self-Propelled Harvester',
        'category': 'Harvester',
        'model': '987 Deluxe',
        'description': 'High output crop harvesting with low grain loss.',
        'village': 'Ludhiana Ag Hub',
        'rate': 2200.0,
        'unit': 'acre',
        'mobilization': 500.0,
        'buffer_minutes': 30,
        'active': True,
        'is_active': True,
        'attachments': [
            {'name': 'Straw Reaper', 'rate': 400},
            {'name': 'Baler Attachment', 'rate': 500}
        ],
        'fuel_included': True,
        'fuel_rate_extra': 250.0,
        'owner_name': 'Harpreet Singh (Owner)',
        'owner_phone': '+919000000002',
        'latitude': 30.889,
        'longitude': 75.841,
        'rating_avg': 4.9,
        'rating_count': 5,
        'badges': ['High Capacity', 'Full Tank']
    }
]

@app.get('/api/machines')
def machines(latitude:float=30.901,longitude:float=75.857,radius:int=5,category:str='',u=Depends(optional_user)):
    require(-90<=latitude<=90 and -180<=longitude<=180 and 1<=radius<=50,'Invalid search radius or location',422)
    try:
        with db() as c:
            owner_filter = " AND m.owner_id != %s" if u else ""
            params = [category, category, longitude, latitude, radius*1000]
            if u:
                params.append(u['id'])
            params.extend([longitude, latitude])
            return many(c,MACHINE_SELECT+f''' WHERE m.active AND COALESCE(m.is_active, true) AND (%s='' OR m.category=%s) AND ST_DWithin(m.location,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography,%s){owner_filter} ORDER BY ST_Distance(m.location,ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography) LIMIT 100''',tuple(params))
    except Exception:
        results = [m for m in DEMO_MACHINES if not u or m.get('owner_id') != u.get('id')]
        if category:
            results = [m for m in results if m['category'].lower() == category.lower()]
        return results

@app.get('/api/fleet')
def fleet(u=Depends(user)):
    try:
        with db() as c: return many(c,MACHINE_SELECT+' WHERE m.owner_id=%s ORDER BY m.created_at',(u['id'],))
    except Exception:
        return [m for m in DEMO_MACHINES if m.get('owner_id') == u.get('id')]
@app.get('/api/machines/{ident}/availability')
def availability(ident:UUID,duration_minutes:int=120,u=Depends(optional_user)):
    with db() as c:
        m=one(c,'SELECT id,owner_id,buffer_minutes,active,COALESCE(is_active,true) AS is_active FROM machines WHERE id=%s',(ident,))
        require(m is not None,'Machine not found',404)
        require(m['active'] and m['is_active'],'This equipment is currently unavailable.',400)
        if u and m['owner_id']==u['id']:
            raise HTTPException(403,'You cannot book your own equipment.')
        buffer=m['buffer_minutes'] if m else 15
        reserved=many(c,"SELECT start_at,reserved_until AS end_at,reserved_until,status,quantity FROM bookings WHERE machine_id=%s AND status IN ('PENDING','APPROVED','IN_PROGRESS') AND reserved_until>now() ORDER BY start_at",(ident,))
        maintenance=many(c,'SELECT start_at,end_at,reason FROM maintenance WHERE machine_id=%s AND end_at>now() ORDER BY start_at',(ident,))
        all_busy=[*reserved,*[{'start_at':x['start_at'],'reserved_until':x['end_at'],'status':'MAINTENANCE'} for x in maintenance]]
        now=datetime.now(timezone.utc)
        next_slot=find_next_available_slot(now,all_busy,buffer,duration_minutes)
        return {'reserved':reserved,'maintenance':maintenance,'next_available':next_slot,'buffer_minutes':buffer}
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

class SelectedAttachment(BaseModel):
    name:str=Field(min_length=2,max_length=50)
    rate:Decimal=Field(ge=0,le=50000,max_digits=12,decimal_places=2)

class Booking(BaseModel):
    machine_id:UUID
    start_at:AwareDatetime
    end_at:AwareDatetime
    acres:Decimal|None=Field(default=None,gt=0,le=10000,max_digits=12,decimal_places=3)
    latitude:float=Field(ge=-90,le=90,allow_inf_nan=False)
    longitude:float=Field(ge=-180,le=180,allow_inf_nan=False)
    idempotency_key:UUID
    selected_attachments:list[SelectedAttachment]=Field(default=[])
    fuel_included:bool=Field(default=False)

def quote_for(p,m):
    try:
        validate_booking_interval(p.start_at, p.end_at)
    except ValueError as e:
        raise HTTPException(400, str(e))
    quantity=Decimal(str((p.end_at-p.start_at).total_seconds()))/3600 if m['unit']=='hour' else p.acres
    require(quantity is not None,'Acreage required',422)
    addons_rate=Decimal('0')
    if getattr(p,'selected_attachments',None):
        for att in p.selected_attachments:
            addons_rate += Decimal(str(att.rate))
    fuel_extra=Decimal('0')
    if getattr(p,'fuel_included',False) and m.get('fuel_rate_extra'):
        fuel_extra=Decimal(str(m['fuel_rate_extra']))
        addons_rate += fuel_extra
    b=bill(m['rate'],quantity,m['mobilization'],addons_rate=addons_rate)
    return quantity,b,addons_rate,fuel_extra
@app.post('/api/quote')
def quote(p:Booking,u=Depends(user)):
    try:
        validate_booking_interval(p.start_at, p.end_at)
    except ValueError as e:
        raise HTTPException(400, str(e))
    with db() as c:
        m=one(c,'SELECT * FROM machines WHERE id=%s',(p.machine_id,))
        require(m is not None,'Machine not found',404)
        require(m['active'] and m.get('is_active', True),'This equipment is currently unavailable.',400)
        require(m['owner_id']!=u['id'],'You cannot book your own equipment.',403)
        q,b,addons_rate,fuel_extra=quote_for(p,m)
        return {**b,'quantity':q,'unit':m['unit'],'rate':m['rate'],'addons_rate':addons_rate,'fuel_extra':fuel_extra,'payment':'Directly to owner outside platform'}
@app.post('/api/bookings')
def book(p:Booking,u=Depends(user)):
    require('farmer' in u['roles'],'Farmer role required')
    try:
        validate_booking_interval(p.start_at, p.end_at)
    except ValueError as e:
        raise HTTPException(400, str(e))
    req_hash=hashlib.sha256(p.model_dump_json().encode()).hexdigest()
    with db() as c:
        c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',(str(u['id'])+str(p.idempotency_key),))
        existing=one(c,'SELECT * FROM bookings WHERE farmer_id=%s AND idempotency_key=%s',(u['id'],p.idempotency_key))
        if existing:
            require(existing['request_hash']==req_hash,'Idempotency key reused with changed request',409)
            return existing
        m=one(c,'SELECT * FROM machines WHERE id=%s FOR UPDATE',(p.machine_id,))
        require(m is not None,'Machine not found',404)
        require(m['active'] and m.get('is_active', True),'This equipment is currently unavailable.',400)
        require(m['owner_id']!=u['id'],'You cannot book your own equipment.',403)
        quantity,b,addons_rate,fuel_extra=quote_for(p,m)
        reserved_until=p.end_at+timedelta(minutes=m['buffer_minutes'])
        blocked=one(c,"SELECT id FROM maintenance WHERE machine_id=%s AND tstzrange(start_at,end_at,'[)') && tstzrange(%s,%s,'[)')",(p.machine_id,p.start_at,reserved_until))
        require(not blocked,'Machine under maintenance during this interval',409)
        ident=uid()
        sel_att_json=Jsonb([att.model_dump(mode='json') for att in p.selected_attachments])
        row=one(c,'INSERT INTO bookings(id,machine_id,farmer_id,start_at,end_at,reserved_until,quantity,latitude,longitude,rate,unit,mobilization,estimate,idempotency_key,request_hash,selected_attachments,fuel_included,fuel_extra) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *',(ident,p.machine_id,u['id'],p.start_at,p.end_at,reserved_until,quantity,p.latitude,p.longitude,m['rate'],m['unit'],m['mobilization'],b['total'],p.idempotency_key,req_hash,sel_att_json,p.fuel_included,fuel_extra))
        audit(c,u['id'],ident,'BOOKING_REQUESTED')
        notify(c,m['owner_id'],f'New booking request {ident}')
        notify(c,u['id'],f'Booking {ident} awaits owner approval')
        return row

BOOKING_SELECT='''SELECT b.*,
m.name AS machine_name,
m.category AS machine_category,
m.owner_id,
m.village,
u.name AS farmer_name,
u.phone AS farmer_phone,
ow.name AS owner_name,
ow.phone AS owner_phone,
COALESCE((SELECT ROUND(AVG(r.score)::numeric, 1) FROM ratings r WHERE r.target_id=b.farmer_id), 5.0) AS farmer_rating_avg,
COALESCE((SELECT COUNT(*) FROM ratings r WHERE r.target_id=b.farmer_id), 0) AS farmer_rating_count,
COALESCE((SELECT ROUND(AVG(r.score)::numeric, 1) FROM ratings r WHERE r.target_id=m.owner_id), 5.0) AS owner_rating_avg,
COALESCE((SELECT COUNT(*) FROM ratings r WHERE r.target_id=m.owner_id), 0) AS owner_rating_count
FROM bookings b
JOIN machines m ON m.id=b.machine_id
JOIN users u ON u.id=b.farmer_id
JOIN users ow ON ow.id=m.owner_id'''
def booking_access(c,ident,u,lock=False):
    row=one(c,BOOKING_SELECT+' WHERE b.id=%s'+(' FOR UPDATE OF b' if lock else ''),(ident,))
    require(row is not None,'Booking not found',404)
    require(u['id'] in (row['owner_id'],row['farmer_id'],row['operator_id']))
    return row
@app.get('/api/bookings')
def bookings(u=Depends(user)):
    try:
        with db() as c: return many(c,BOOKING_SELECT+' WHERE b.farmer_id=%s OR m.owner_id=%s OR b.operator_id=%s ORDER BY b.created_at DESC',(u['id'],)*3)
    except Exception:
        return []
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
        if b.get('operator_id'):
            notify(c,b['operator_id'],f'Booking {ident}: {state}')
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
        farmer=one(c,'SELECT phone,email FROM users WHERE id=%s',(b['farmer_id'],))
        result=issue(c,contact(farmer),'meter',{'booking_id':str(ident),'stage':p.stage,'reading':str(p.reading),'acres':str(p.acres) if p.acres is not None else None})
        audit(c,u['id'],ident,'METER_CONFIRMATION_REQUESTED',{'stage':p.stage,'reading':str(p.reading)})
        return result
@app.get('/api/bookings/{ident}/meter/pending')
def pending_meter(ident:UUID,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u)
        require(b['farmer_id']==u['id'])
        return many(c,"SELECT id,payload,expires_at FROM challenges WHERE phone=%s AND purpose='meter' AND payload->>'booking_id'=%s AND consumed_at IS NULL AND expires_at>now() AND attempts<5 ORDER BY created_at DESC",(contact(u),str(ident)))
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
            now_utc = datetime.now(timezone.utc)
            require(b['start_at'] - timedelta(minutes=15) <= now_utc < b['reserved_until'], 'Work can start only from 15 minutes before start time until the end of the reserved slot', 409)
            running=one(c,"SELECT id FROM bookings WHERE machine_id=%s AND status='IN_PROGRESS' AND id<>%s",(b['machine_id'],ident))
            require(not running,'Previous job is still in progress. Resolve the overrun before starting.',409)
            c.execute("UPDATE bookings SET meter_start=%s,status='IN_PROGRESS' WHERE id=%s",(Decimal(data['reading']),ident))
        else:
            hours=meter_quantity(b['meter_start'],data['reading'])
            quantity=hours if b['unit']=='hour' else Decimal(data['acres'])
            addons_rate=Decimal('0')
            if b.get('selected_attachments'):
                for att in b['selected_attachments']:
                    addons_rate += Decimal(str(att.get('rate', 0)))
            if b.get('fuel_included') and b.get('fuel_extra'):
                addons_rate += Decimal(str(b['fuel_extra']))
            total=bill(b['rate'],quantity,b['mobilization'],addons_rate=addons_rate)['total']
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
class RatingPayload(BaseModel):
    score:int=Field(ge=1,le=5)
    punctuality:int=Field(default=5,ge=1,le=5)
    badges:list[str]=Field(default=[])
    comment:str=Field(default='',max_length=500)

@app.post('/api/bookings/{ident}/rating')
def rate(ident:UUID,p:RatingPayload,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u,True)
        require(b['status']=='COMPLETED' and u['id'] in (b['farmer_id'],b['owner_id']),'Only completed bookings can be rated')
        target=b['owner_id'] if u['id']==b['farmer_id'] else b['farmer_id']
        c.execute('''INSERT INTO ratings(booking_id,author_id,target_id,score,punctuality,badges,comment,created_at)
                     VALUES(%s,%s,%s,%s,%s,%s,%s,now())
                     ON CONFLICT(booking_id,author_id) DO UPDATE
                     SET score=EXCLUDED.score,punctuality=EXCLUDED.punctuality,badges=EXCLUDED.badges,comment=EXCLUDED.comment''',
                  (ident,u['id'],target,p.score,p.punctuality,p.badges,p.comment))
        audit(c,u['id'],ident,'RATING_SUBMITTED',{'score':p.score,'punctuality':p.punctuality,'badges':p.badges})
    return {'ok':True}

@app.get('/api/machines/{ident}/reviews')
def machine_reviews(ident:UUID):
    with db() as c:
        return many(c,'''SELECT r.score,r.punctuality,r.badges,r.comment,r.created_at,u.name AS author_name
                          FROM ratings r
                          JOIN bookings b ON b.id=r.booking_id
                          JOIN machines m ON m.id=b.machine_id
                          JOIN users u ON u.id=r.author_id
                          WHERE b.machine_id=%s AND r.target_id=m.owner_id ORDER BY r.created_at DESC LIMIT 50''',(ident,))

@app.get('/api/bookings/{ident}/rating')
def get_booking_rating(ident:UUID,u=Depends(user)):
    with db() as c:
        booking_access(c,ident,u)
        return one(c,'SELECT score,punctuality,badges,comment,created_at FROM ratings WHERE booking_id=%s AND author_id=%s',(ident,u['id']))

@app.get('/api/bookings/{ident}/invoice')
def invoice(ident:UUID,u=Depends(user)):
    with db() as c:
        b=booking_access(c,ident,u)
        require(b['status']=='COMPLETED','Final invoice requires confirmed completion',409)
        owner=one(c,'SELECT name,phone FROM users WHERE id=%s',(b['owner_id'],))
        farmer=one(c,'SELECT name,phone FROM users WHERE id=%s',(b['farmer_id'],))
        machine=one(c,'SELECT name,category,village FROM machines WHERE id=%s',(b['machine_id'],))
        
        addons_rate=Decimal('0')
        att_list=b.get('selected_attachments') or []
        for att in att_list:
            addons_rate += Decimal(str(att.get('rate', 0)))
        fuel_extra=Decimal(str(b.get('fuel_extra', 0))) if b.get('fuel_included') else Decimal('0')
        addons_rate += fuel_extra
        
        breakdown=bill(b['rate'],b['actual_quantity'],b['mobilization'],addons_rate=addons_rate)
        return {
            'invoice_number':'YS-INV-'+str(ident)[:8].upper(),
            'booking_id':str(ident),
            'issued_at':datetime.now(timezone.utc).isoformat(),
            'booking':b,
            'owner':owner,
            'farmer':farmer,
            'machine':machine,
            'breakdown':{
                **breakdown,
                'rate':str(b['rate']),
                'quantity':str(b['actual_quantity']),
                'unit':b['unit'],
                'selected_attachments':att_list,
                'fuel_included':b.get('fuel_included',False),
                'fuel_extra':str(fuel_extra),
            },
            'payment_status':b['payment_status'],
            'notice':'Rental bill for agricultural machinery sharing. Payment status is manually reported outside the platform and not independently verified. No platform commission or escrow fee.'
        }
@app.get('/api/notifications')
def notifications(u=Depends(user)):
    try:
        with db() as c: return many(c,'SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 100',(u['id'],))
    except Exception:
        return []
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
    try:
        with db() as c:
            return many(c,'SELECT o.*, (SELECT count(*) FROM machines m WHERE m.organization_id=o.id) AS machines FROM organizations o WHERE manager_id=%s',(u['id'],))
    except Exception:
        return []
@app.get('/api/organizations/{ident}/bookings')
def org_bookings(ident:UUID,u=Depends(user)):
    with db() as c:
        require(one(c,'SELECT id FROM organizations WHERE id=%s AND manager_id=%s',(ident,u['id'])) is not None)
        return many(c,BOOKING_SELECT+' WHERE m.organization_id=%s ORDER BY b.start_at',(ident,))

def generate_agro_weather(latitude: float = 30.901, longitude: float = 75.857):
    now = datetime.now(timezone.utc)
    base_max, base_min, base_hum = 29, 15, 55
    month = now.month
    if month in (12, 1, 2):
        base_max, base_min, base_hum = 20, 8, 70
    elif month in (6, 7, 8, 9):
        base_max, base_min, base_hum = 34, 26, 80
    elif month in (3, 4, 5):
        base_max, base_min, base_hum = 35, 20, 40

    hour = now.hour
    h_factor = math.sin(((hour - 8) / 24) * 2 * math.pi)
    curr_t = round(((base_max + base_min) / 2) + ((base_max - base_min) / 2) * h_factor)
    curr_hum = max(30, min(90, round(base_hum - h_factor * 15)))

    daily_times = [(now + timedelta(days=d)).strftime('%Y-%m-%d') for d in range(7)]
    daily_max = [base_max + (1 if d % 3 == 0 else -1 if d % 2 == 0 else 0) for d in range(7)]
    daily_min = [base_min + (1 if d % 3 == 0 else -1 if d % 2 == 0 else 0) for d in range(7)]
    daily_codes = [1 if d == 3 else 2 if d == 5 else 0 for d in range(7)]
    daily_precip = [max(0, 5 + (1 if d % 3 == 0 else 0)) for d in range(7)]

    hourly_times = [(now + timedelta(hours=h)).strftime('%Y-%m-%dT%H:00') for h in range(48)]
    hourly_t = [round(((base_max + base_min) / 2) + ((base_max - base_min) / 2) * math.sin((((now + timedelta(hours=h)).hour - 8) / 24) * 2 * math.pi)) for h in range(48)]
    hourly_precip = [5 for _ in range(48)]
    hourly_codes = [0 for _ in range(48)]
    hourly_wind = [8 for _ in range(48)]

    return {
        'latitude': latitude,
        'longitude': longitude,
        'timezone': 'Asia/Kolkata',
        'is_fallback': True,
        'current': {
            'time': now.isoformat(),
            'temperature_2m': curr_t,
            'relative_humidity_2m': curr_hum,
            'precipitation': 0.0,
            'weather_code': 0,
            'wind_speed_10m': 9.0,
        },
        'hourly': {
            'time': hourly_times,
            'temperature_2m': hourly_t,
            'precipitation_probability': hourly_precip,
            'weather_code': hourly_codes,
            'wind_speed_10m': hourly_wind,
        },
        'daily': {
            'time': daily_times,
            'weather_code': daily_codes,
            'temperature_2m_max': daily_max,
            'temperature_2m_min': daily_min,
            'precipitation_probability_max': daily_precip,
        }
    }

@app.get('/api/weather')
def weather(latitude: float = 30.901, longitude: float = 75.857):
    import urllib.request
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=7"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'YantraSetu/2.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if not data.get('error') and data.get('current'):
                return data
    except Exception:
        pass
    return generate_agro_weather(latitude, longitude)

@app.exception_handler(ValueError)
async def invalid(request,exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=422,content={'detail':str(exc)})
