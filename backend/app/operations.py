"""Role-scoped coordination, in-app alerts and support APIs."""
import os
from uuid import UUID
from datetime import datetime, timezone
from typing import Literal
from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime

class OperationInput(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)

class ReminderPreference(OperationInput):
    reminders:bool
class Travel(OperationInput):
    status:Literal['ON_THE_WAY','ARRIVED']
class Readiness(OperationInput):
    machine_checked:bool=False
    fuel_checked:bool=False
    operator_confirmed:bool=False
    transport_confirmed:bool=False
class Support(OperationInput):
    booking_id:UUID
    kind:Literal['BREAKDOWN','DELAY','BILLING','SAFETY','OTHER']
    description:str=Field(min_length=10,max_length=2000)
class Resolution(OperationInput):
    status:Literal['OPEN','IN_REVIEW','RESOLVED']
    resolution:str=Field(min_length=3,max_length=2000)
class Demand(OperationInput):
    village:str=Field(min_length=2,max_length=100)
    category:Literal['Tractor','Rotavator','Harvester','Seed drill','Sprayer','Cultivator']
    needed_at:AwareDatetime
    notes:str=Field(default='',max_length=500)
class SupportMessage(OperationInput):
    body:str=Field(min_length=3,max_length=2000)
class ContentReport(OperationInput):
    machine_id:UUID
    reason:Literal['SCAM','MISLEADING','UNSAFE','ABUSIVE','OTHER']
    description:str=Field(min_length=10,max_length=2000)
class Delegation(OperationInput):
    coordinator_id:UUID
class Group(OperationInput):
    name:str=Field(min_length=3,max_length=100)
class Moderation(OperationInput):
    restricted:bool
    reason:str=Field(min_length=5,max_length=500)

def register(app,m):
    one,many,require=m.one,m.many,m.require
    def db(): return m.db()
    def staff_ids(): return {x.strip() for x in os.getenv('ADMIN_USER_IDS','').split(',') if x.strip()}
    def admin(u=Depends(m.user)):
        require(str(u['id']) in staff_ids(),'Staff access required',403)
        return u

    @app.get('/api/capabilities')
    def capabilities(u=Depends(m.user)):
        return {'admin':str(u['id']) in staff_ids()}

    @app.get('/api/machines/{ident}')
    def detail(ident:UUID,u=Depends(m.optional_user)):
        with db() as c:
            row=one(c,m.MACHINE_SELECT+' WHERE m.id=%s AND ((m.active AND m.is_active AND NOT m.moderated AND NOT u.suspended) OR m.owner_id=%s)',(ident,u['id'] if u else None))
            require(row is not None,'Equipment is unavailable',404)
            return row

    @app.get('/api/saved-machines')
    def saved(u=Depends(m.user)):
        with db() as c:
            return many(c,m.MACHINE_SELECT+' WHERE m.active AND m.is_active AND NOT m.moderated AND NOT u.suspended AND m.id IN (SELECT machine_id FROM saved_machines WHERE user_id=%s)',(u['id'],))

    @app.post('/api/saved-machines/{ident}')
    def save(ident:UUID,u=Depends(m.renter)):
        with db() as c:
            require(one(c,'SELECT id FROM machines WHERE id=%s AND active AND is_active AND NOT moderated',(ident,)) is not None,'Equipment unavailable',404)
            c.execute('INSERT INTO saved_machines VALUES(%s,%s) ON CONFLICT DO NOTHING',(u['id'],ident))
        return {'ok':True}

    @app.delete('/api/saved-machines/{ident}')
    def unsave(ident:UUID,u=Depends(m.user)):
        with db() as c:c.execute('DELETE FROM saved_machines WHERE user_id=%s AND machine_id=%s',(u['id'],ident))
        return {'ok':True}

    @app.get('/api/notification-preferences')
    def preferences(u=Depends(m.user)):
        with db() as c:return one(c,'SELECT reminders FROM notification_preferences WHERE user_id=%s',(u['id'],)) or {'reminders':True}

    @app.post('/api/notification-preferences')
    def set_preferences(p:ReminderPreference,u=Depends(m.user)):
        with db() as c:c.execute('INSERT INTO notification_preferences VALUES(%s,%s) ON CONFLICT(user_id) DO UPDATE SET reminders=EXCLUDED.reminders',(u['id'],p.reminders))
        return p

    @app.post('/api/notifications/{ident}/read')
    def mark_read(ident:int,u=Depends(m.user)):
        with db() as c:c.execute('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=%s AND user_id=%s',(ident,u['id']))
        return {'ok':True}

    @app.post('/api/bookings/{ident}/travel')
    def travel(ident:UUID,p:Travel,u=Depends(m.user)):
        with db() as c:
            b=m.booking_access(c,ident,u,True)
            require(u['id'] in (b['owner_id'],b['operator_id']) and b['status']=='APPROVED','Only the owner or assigned operator can update travel for accepted bookings',403)
            require(b['travel_status']!='ARRIVED' or p.status=='ARRIVED','Arrival cannot be reversed',409)
            c.execute('UPDATE bookings SET travel_status=%s WHERE id=%s',(p.status,ident))
            if b['travel_status']!=p.status:
                m.audit(c,u['id'],ident,p.status)
                m.notify(c,b['farmer_id'],f'Booking {ident}: {p.status.replace("_"," ").lower()}')
        return {'status':p.status}

    @app.post('/api/bookings/{ident}/readiness')
    def readiness(ident:UUID,p:Readiness,u=Depends(m.user)):
        with db() as c:
            b=m.booking_access(c,ident,u,True)
            require(b['owner_id']==u['id'] and b['status']=='APPROVED','Owner can update readiness for accepted rentals',403)
            c.execute('UPDATE bookings SET readiness=%s WHERE id=%s',(m.Jsonb(p.model_dump()),ident))
            m.audit(c,u['id'],ident,'READINESS_UPDATED',p.model_dump())
        return p

    @app.post('/api/support')
    def report(p:Support,u=Depends(m.user)):
        with db() as c:
            m.booking_access(c,p.booking_id,u)
            m.throttle(c,'support:'+str(u['id']),10,3600)
            row=one(c,'INSERT INTO support_cases(id,booking_id,reporter_id,kind,description) VALUES(%s,%s,%s,%s,%s) RETURNING *',(m.uid(),p.booking_id,u['id'],p.kind,p.description.strip()))
            m.audit(c,u['id'],p.booking_id,'SUPPORT_REQUESTED',{'case_id':str(row['id']),'kind':p.kind})
            return row

    @app.get('/api/support')
    def my_cases(u=Depends(m.user)):
        with db() as c:return many(c,'SELECT s.*,m.name AS machine_name FROM support_cases s JOIN bookings b ON b.id=s.booking_id JOIN machines m ON m.id=b.machine_id WHERE reporter_id=%s ORDER BY updated_at DESC LIMIT 100',(u['id'],))

    @app.get('/api/admin/support')
    def cases(u=Depends(admin)):
        with db() as c:return many(c,'SELECT * FROM support_cases ORDER BY updated_at DESC LIMIT 200')

    @app.post('/api/admin/support/{ident}')
    def resolve(ident:UUID,p:Resolution,u=Depends(admin)):
        with db() as c:
            row=one(c,'UPDATE support_cases SET status=%s,resolution=%s,updated_at=now() WHERE id=%s RETURNING *',(p.status,p.resolution,ident))
            require(row is not None,'Case not found',404)
            c.execute('INSERT INTO support_messages(id,case_id,author_id,is_staff,body,status) VALUES(%s,%s,%s,true,%s,%s)',(m.uid(),ident,u['id'],p.resolution,p.status))
            m.audit(c,u['id'],row['booking_id'],'SUPPORT_UPDATED',{'case_id':str(ident),'status':p.status})
            m.notify(c,row['reporter_id'],f'Support case {ident}: {p.status}. View Support for details.')
            return row

    def case_access(c,ident,u,lock=False):
        row=one(c,'SELECT * FROM support_cases WHERE id=%s'+(' FOR UPDATE' if lock else ''),(ident,))
        require(row is not None,'Case not found',404)
        require(row['reporter_id']==u['id'] or str(u['id']) in staff_ids(),'This support case is private',403)
        return row

    @app.get('/api/support/{ident}/messages')
    def messages(ident:UUID,u=Depends(m.user)):
        with db() as c:
            case_access(c,ident,u)
            return many(c,'SELECT id,is_staff,body,status,created_at FROM support_messages WHERE case_id=%s ORDER BY created_at,id',(ident,))

    @app.post('/api/support/{ident}/messages')
    def reply(ident:UUID,p:SupportMessage,u=Depends(m.user)):
        with db() as c:
            case=case_access(c,ident,u,True)
            require(case['status']!='RESOLVED','This case is resolved. Staff must reopen it before further replies.',409)
            m.throttle(c,'support-reply:'+str(u['id']),20,3600)
            staff=str(u['id']) in staff_ids()
            row=one(c,'INSERT INTO support_messages(id,case_id,author_id,is_staff,body) VALUES(%s,%s,%s,%s,%s) RETURNING id,is_staff,body,created_at',(m.uid(),ident,u['id'],staff,p.body))
            c.execute('UPDATE support_cases SET updated_at=now() WHERE id=%s',(ident,))
            if staff:m.notify(c,case['reporter_id'],f'Support case {ident}: new staff reply.')
            m.audit(c,u['id'],case['booking_id'],'SUPPORT_REPLY',{'case_id':str(ident)})
            return row

    @app.post('/api/content-reports')
    def report_content(p:ContentReport,u=Depends(m.user)):
        with db() as c:
            m.throttle(c,'content-report:'+str(u['id']),10,3600)
            require(one(c,'SELECT id FROM machines WHERE id=%s',(p.machine_id,)) is not None,'Listing not found',404)
            require(not one(c,"SELECT id FROM content_reports WHERE reporter_id=%s AND machine_id=%s AND status!='RESOLVED'",(u['id'],p.machine_id)),'You already have an open report for this listing',409)
            row=one(c,'INSERT INTO content_reports(id,reporter_id,machine_id,reason,description) VALUES(%s,%s,%s,%s,%s) RETURNING *',(m.uid(),u['id'],p.machine_id,p.reason,p.description))
            m.audit(c,u['id'],None,'CONTENT_REPORTED',{'report_id':str(row['id']),'machine_id':str(p.machine_id)})
            return row

    @app.get('/api/content-reports')
    def my_reports(u=Depends(m.user)):
        with db() as c:return many(c,'SELECT r.*,m.name AS machine_name FROM content_reports r JOIN machines m ON m.id=r.machine_id WHERE reporter_id=%s ORDER BY updated_at DESC LIMIT 100',(u['id'],))

    @app.get('/api/admin/content-reports')
    def all_reports(u=Depends(admin)):
        with db() as c:return many(c,'SELECT r.*,m.name AS machine_name FROM content_reports r JOIN machines m ON m.id=r.machine_id ORDER BY updated_at DESC LIMIT 200')

    @app.post('/api/admin/content-reports/{ident}')
    def resolve_report(ident:UUID,p:Resolution,u=Depends(admin)):
        with db() as c:
            current=one(c,'SELECT * FROM content_reports WHERE id=%s',(ident,))
            require(current is not None,'Report not found',404)
            c.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,0))',('content-report:'+str(current['reporter_id']),))
            if p.status!='RESOLVED':
                require(not one(c,"SELECT id FROM content_reports WHERE reporter_id=%s AND machine_id=%s AND id!=%s AND status!='RESOLVED'",(current['reporter_id'],current['machine_id'],ident)),'Another report for this listing is already open',409)
            row=one(c,'UPDATE content_reports SET status=%s,resolution=%s,updated_at=now() WHERE id=%s RETURNING *',(p.status,p.resolution,ident))
            require(row is not None,'Report not found',404)
            m.audit(c,u['id'],None,'CONTENT_REPORT_UPDATED',{'report_id':str(ident),**p.model_dump()})
            m.notify(c,row['reporter_id'],f'Listing report {ident}: {p.status}. View Community & support.')
            return row

    @app.post('/api/admin/machines/{ident}')
    def moderate(ident:UUID,p:Moderation,u=Depends(admin)):
        with db() as c:
            row=one(c,'UPDATE machines SET moderated=%s WHERE id=%s RETURNING owner_id',(p.restricted,ident))
            require(row is not None,'Equipment not found',404)
            m.audit(c,u['id'],None,'LISTING_MODERATED',{'machine_id':str(ident),**p.model_dump()})
            m.notify(c,row['owner_id'],f'Listing {ident}: '+('hidden' if p.restricted else 'restored')+'. Reason: '+p.reason)
        return {'ok':True}

    @app.post('/api/admin/users/{ident}')
    def suspend(ident:UUID,p:Moderation,u=Depends(admin)):
        require(ident!=u['id'],'Cannot restrict your own staff account',400)
        require(str(ident) not in staff_ids(),'Staff restrictions require server configuration',400)
        with db() as c:
            require(one(c,'UPDATE users SET suspended=%s WHERE id=%s RETURNING id',(p.restricted,ident)) is not None,'Account not found',404)
            c.execute('DELETE FROM sessions WHERE user_id=%s',(ident,))
            m.audit(c,u['id'],None,'ACCOUNT_MODERATED',{'user_id':str(ident),**p.model_dump()})
        return {'ok':True}

    @app.post('/api/demand')
    def demand(p:Demand,u=Depends(m.renter)):
        require(p.needed_at>datetime.now(timezone.utc),'Choose a future date',422)
        with db() as c:
            m.throttle(c,'demand:'+str(u['id']),10,86400)
            return one(c,'INSERT INTO equipment_demand(id,farmer_id,village,category,needed_at,notes) VALUES(%s,%s,%s,%s,%s,%s) RETURNING *',(m.uid(),u['id'],p.village.strip(),p.category,p.needed_at,p.notes))

    @app.get('/api/demand')
    def demands(u=Depends(m.user)):
        with db() as c:
            return {'mine':many(c,'SELECT * FROM equipment_demand WHERE farmer_id=%s ORDER BY created_at DESC LIMIT 100',(u['id'],)),
                    'summary':many(c,"SELECT village,category,count(*) AS requests,min(needed_at) AS earliest FROM equipment_demand WHERE status='OPEN' AND needed_at>now() GROUP BY village,category ORDER BY requests DESC LIMIT 100")}

    @app.post('/api/demand/{ident}/close')
    def close_demand(ident:UUID,u=Depends(m.user)):
        with db() as c:require(one(c,"UPDATE equipment_demand SET status='CLOSED' WHERE id=%s AND farmer_id=%s RETURNING id",(ident,u['id'])) is not None,'Request not found or not yours',404)
        return {'ok':True}

    @app.post('/api/delegations')
    def delegate(p:Delegation,u=Depends(m.renter)):
        with db() as c:
            require(one(c,"SELECT id FROM users WHERE id=%s AND 'fpo'=ANY(roles) AND NOT suspended",(p.coordinator_id,)) is not None,'Active FPO coordinator not found',404)
            c.execute("INSERT INTO booking_delegations VALUES(%s,%s,now()+interval '7 days') ON CONFLICT(farmer_id,coordinator_id) DO UPDATE SET expires_at=EXCLUDED.expires_at",(u['id'],p.coordinator_id))
            m.audit(c,u['id'],None,'BOOKING_ASSISTANCE_GRANTED',{'coordinator_id':str(p.coordinator_id)})
        return {'ok':True}

    @app.delete('/api/delegations/{ident}')
    def revoke(ident:UUID,u=Depends(m.user)):
        with db() as c:
            c.execute('DELETE FROM booking_delegations WHERE farmer_id=%s AND coordinator_id=%s',(u['id'],ident))
            m.audit(c,u['id'],None,'BOOKING_ASSISTANCE_REVOKED',{'coordinator_id':str(ident)})
        return {'ok':True}

    @app.get('/api/delegations')
    def grants(u=Depends(m.user)):
        with db() as c:return many(c,'SELECT d.*,f.name AS farmer_name,o.name AS coordinator_name FROM booking_delegations d JOIN users f ON f.id=d.farmer_id JOIN users o ON o.id=d.coordinator_id WHERE (d.farmer_id=%s OR d.coordinator_id=%s) AND d.expires_at>now()',(u['id'],u['id']))

    class Assisted(m.Booking):
        farmer_id:UUID

    @app.post('/api/assisted-quote')
    def assisted_quote(p:Assisted,u=Depends(m.user)):
        require('fpo' in u['roles'],'FPO coordinator required',403)
        with db() as c:
            require(one(c,'SELECT 1 FROM booking_delegations WHERE farmer_id=%s AND coordinator_id=%s AND expires_at>now()',(p.farmer_id,u['id'])) is not None,'Farmer consent required',403)
            farmer=one(c,'SELECT * FROM users WHERE id=%s AND NOT suspended',(p.farmer_id,))
            require(farmer and m.can_rent(farmer['roles']),'Farmer account required',403)
            return m.quote(p,farmer)

    @app.post('/api/assisted-bookings')
    def assisted(p:Assisted,u=Depends(m.user)):
        require('fpo' in u['roles'],'FPO coordinator required',403)
        with db() as c:
            grant=one(c,'SELECT * FROM booking_delegations WHERE farmer_id=%s AND coordinator_id=%s AND expires_at>now() FOR SHARE',(p.farmer_id,u['id']))
            require(grant is not None,'Farmer consent is required and may have expired',403)
            farmer=one(c,'SELECT * FROM users WHERE id=%s AND NOT suspended',(p.farmer_id,))
            require(farmer and m.can_rent(farmer['roles']),'Farmer account required',403)
            return m.create_booking(m.Booking(**p.model_dump()),farmer,assisted_by=u['id'])

    @app.post('/api/rental-groups')
    def group(p:Group,u=Depends(m.renter)):
        with db() as c:
            row=one(c,'INSERT INTO rental_groups(id,organizer_id,name) VALUES(%s,%s,%s) RETURNING *',(m.uid(),u['id'],p.name))
            c.execute('INSERT INTO rental_group_members VALUES(%s,%s)',(row['id'],u['id']))
            return row

    @app.post('/api/rental-groups/{ident}/join')
    def join(ident:UUID,u=Depends(m.renter)):
        with db() as c:
            require(one(c,'SELECT id FROM rental_groups WHERE id=%s',(ident,)) is not None,'Group not found',404)
            c.execute('INSERT INTO rental_group_members VALUES(%s,%s) ON CONFLICT DO NOTHING',(ident,u['id']))
        return {'ok':True}

    @app.get('/api/rental-groups')
    def groups(u=Depends(m.user)):
        with db() as c:
            rows=many(c,'SELECT g.* FROM rental_groups g JOIN rental_group_members x ON x.group_id=g.id WHERE x.user_id=%s ORDER BY g.created_at DESC',(u['id'],))
            for g in rows:
                g['bookings']=many(c,'SELECT b.id,b.start_at,b.end_at,b.status,b.estimate,b.final_total,m.name AS machine_name FROM bookings b JOIN machines m ON m.id=b.machine_id WHERE b.group_id=%s ORDER BY b.start_at',(g['id'],))
            return rows

    @app.post('/api/rental-groups/{ident}/leave')
    def leave(ident:UUID,u=Depends(m.user)):
        with db() as c:
            c.execute('DELETE FROM rental_group_members WHERE group_id=%s AND user_id=%s',(ident,u['id']))
            c.execute('UPDATE bookings SET group_id=NULL WHERE group_id=%s AND farmer_id=%s',(ident,u['id']))
            m.audit(c,u['id'],None,'RENTAL_GROUP_LEFT',{'group_id':str(ident)})
        return {'ok':True}

    @app.get('/api/pilot-metrics')
    def metrics(u=Depends(admin)):
        with db() as c:
            m.expire_pending(c)
            return {'bookings':one(c,"SELECT count(*) AS requests,count(*) FILTER(WHERE status IN ('APPROVED','IN_PROGRESS','COMPLETED')) AS accepted,count(*) FILTER(WHERE status='COMPLETED') AS completed,count(*) FILTER(WHERE status='CANCELLED') AS cancelled,count(*) FILTER(WHERE closure_reason='Request expired before owner acceptance') AS expired FROM bookings"),
                    'average_response_minutes':one(c,"SELECT avg(extract(epoch FROM a.created_at-b.created_at)/60) AS value FROM audit_log a JOIN bookings b ON b.id=a.booking_id WHERE a.action IN ('APPROVED','REJECTED')"),
                    'repeat_farmers':one(c,'SELECT count(*) AS count FROM (SELECT farmer_id FROM bookings GROUP BY farmer_id HAVING count(*)>1) x'),
                    'support':many(c,'SELECT status,kind,count(*) FROM support_cases GROUP BY status,kind')}

    @app.get('/api/fleet-utilization')
    def utilization(u=Depends(m.user)):
        require('owner' in u['roles'],'Owner role required',403)
        with db() as c:return many(c,"""SELECT m.id,m.name,count(b.id) FILTER(WHERE b.status='COMPLETED') AS completed_rentals,
            COALESCE(sum(extract(epoch FROM b.end_at-b.start_at)/3600) FILTER(WHERE b.status='COMPLETED'),0) AS scheduled_hours_completed,
            COALESCE(sum(b.final_total) FILTER(WHERE b.status='COMPLETED'),0) AS billed_total,
            COALESCE(sum(b.final_total) FILTER(WHERE b.status='COMPLETED' AND b.payment_status='PAID_OUTSIDE_PLATFORM'),0) AS manually_reported_paid
            FROM machines m LEFT JOIN bookings b ON b.machine_id=m.id WHERE m.owner_id=%s GROUP BY m.id,m.name""",(u['id'],))
