"""Mutually approved rescheduling; the original reservation stays until acceptance."""
from uuid import UUID
from decimal import Decimal
from datetime import datetime,timezone
from typing import Literal
from fastapi import Depends
from pydantic import BaseModel,Field,AwareDatetime,ConfigDict

class Proposal(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)
    start_at:AwareDatetime
    end_at:AwareDatetime
    reason:str=Field(min_length=3,max_length=500)
class Decision(BaseModel):
    action:Literal['accept','reject','withdraw']

def register(app,m):
    def expire(c,ident):
        c.execute("""UPDATE booking_reschedules r SET status='EXPIRED',responded_at=now()
          FROM bookings b WHERE r.booking_id=b.id AND b.id=%s AND r.status='PENDING'
          AND (r.start_at<=now() OR b.status!='APPROVED')""",(ident,))
    def lock(c,ident,u):
        first=m.booking_access(c,ident,u)
        m.require(u['id'] in (first['farmer_id'],first['owner_id']),'Only the farmer and owner can reschedule',403)
        c.execute('SELECT id FROM machines WHERE id=%s FOR UPDATE',(first['machine_id'],))
        return m.booking_access(c,ident,u,True)
    def check(c,b,start,end):
        m.validate_booking_interval(start,end)
        until=end+(b['reserved_until']-b['end_at'])
        conflict=m.one(c,"""SELECT id FROM bookings WHERE id!=%s AND status IN ('PENDING','APPROVED','IN_PROGRESS')
          AND (machine_id=%s OR (operator_id IS NOT NULL AND operator_id=%s))
          AND tstzrange(start_at,reserved_until,'[)') && tstzrange(%s,%s,'[)') LIMIT 1""",
          (b['id'],b['machine_id'],b['operator_id'],start,until))
        m.require(not conflict,'The machine or assigned operator is reserved for those dates.',409)
        maintenance=m.one(c,"SELECT id FROM maintenance WHERE machine_id=%s AND tstzrange(start_at,end_at,'[)') && tstzrange(%s,%s,'[)')",(b['machine_id'],start,until))
        m.require(not maintenance,'Equipment maintenance conflicts with the proposed dates.',409)
        return until

    @app.get('/api/bookings/{ident}/reschedules')
    def proposals(ident:UUID,u=Depends(m.user)):
        with m.db() as c:
            m.booking_access(c,ident,u)
            expire(c,ident)
            return m.many(c,'SELECT * FROM booking_reschedules WHERE booking_id=%s ORDER BY created_at DESC LIMIT 20',(ident,))

    @app.post('/api/bookings/{ident}/reschedules')
    def propose(ident:UUID,p:Proposal,u=Depends(m.user)):
        with m.db() as c:m.expire_pending(c)
        with m.db() as c:
            b=lock(c,ident,u);expire(c,ident)
            m.require(b['status']=='APPROVED','Only accepted rentals that have not started can be rescheduled.',409)
            m.require(not m.one(c,"SELECT id FROM booking_reschedules WHERE booking_id=%s AND status='PENDING'",(ident,)),'Respond to or withdraw the current proposal first.',409)
            m.require((p.start_at,p.end_at)!=(b['start_at'],b['end_at']),'Choose different dates.',422)
            check(c,b,p.start_at,p.end_at)
            quantity=Decimal(str((p.end_at-p.start_at).total_seconds()))/3600 if b['unit']=='hour' else b['quantity']
            quantity=quantity.quantize(Decimal('0.001'))
            addons=sum((Decimal(str(x['rate'])) for x in (b.get('selected_attachments') or [])),Decimal('0'))+Decimal(str(b.get('fuel_extra') or 0))+Decimal(str(b.get('operator_extra') or 0))
            total=m.bill(b['rate'],quantity,b['mobilization'],addons_rate=addons)['total']
            row=m.one(c,"""INSERT INTO booking_reschedules(id,booking_id,proposer_id,start_at,end_at,original_start_at,original_end_at,quantity,estimate,reason)
              VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",(m.uid(),ident,u['id'],p.start_at,p.end_at,b['start_at'],b['end_at'],quantity,total,p.reason))
            other=b['owner_id'] if u['id']==b['farmer_id'] else b['farmer_id']
            m.notify(c,other,f'Reschedule proposed for booking {ident}. Review the new dates and estimate in My bookings.')
            m.audit(c,u['id'],ident,'RESCHEDULE_PROPOSED',{'proposal_id':str(row['id']),'start_at':p.start_at.isoformat(),'end_at':p.end_at.isoformat(),'estimate':str(total)})
            return row

    @app.post('/api/bookings/{ident}/reschedules/{proposal_id}')
    def decide(ident:UUID,proposal_id:UUID,p:Decision,u=Depends(m.user)):
        with m.db() as c:m.expire_pending(c)
        with m.db() as c:
            b=lock(c,ident,u)
            row=m.one(c,'SELECT * FROM booking_reschedules WHERE id=%s AND booking_id=%s FOR UPDATE',(proposal_id,ident))
            m.require(row is not None,'Proposal not found',404)
            m.require((u['id']==row['proposer_id'])==(p.action=='withdraw'),'Only the other party may accept/reject; the proposer may withdraw.',403)
            state={'accept':'ACCEPTED','reject':'REJECTED','withdraw':'WITHDRAWN'}[p.action]
            if row['status']==state:return row
            m.require(row['status']=='PENDING','This proposal has already been resolved.',409)
            m.require(b['status']=='APPROVED','The booking is no longer eligible for rescheduling.',409)
            if p.action=='accept':
                m.require(row['start_at']>datetime.now(timezone.utc),'The proposed start time has passed.',409)
                m.require((b['start_at'],b['end_at'])==(row['original_start_at'],row['original_end_at']),'Booking dates changed; submit a new proposal.',409)
                until=check(c,b,row['start_at'],row['end_at'])
                c.execute('UPDATE bookings SET start_at=%s,end_at=%s,reserved_until=%s,quantity=%s,estimate=%s,travel_status=\'NOT_STARTED\',readiness=\'{}\' WHERE id=%s',(row['start_at'],row['end_at'],until,row['quantity'],row['estimate'],ident))
                c.execute('DELETE FROM reminder_receipts WHERE booking_id=%s',(ident,))
                c.execute("UPDATE challenges SET consumed_at=now() WHERE purpose='meter' AND payload->>'booking_id'=%s AND consumed_at IS NULL",(str(ident),))
            result=m.one(c,'UPDATE booking_reschedules SET status=%s,responded_at=now() WHERE id=%s RETURNING *',(state,proposal_id))
            m.audit(c,u['id'],ident,'RESCHEDULE_'+state,{'proposal_id':str(proposal_id)})
            for person in {b['farmer_id'],b['owner_id'],b['operator_id']} - {None}:
                m.notify(c,person,f'Booking {ident}: reschedule {state.lower()}. Check booking dates before travelling.')
            return result
