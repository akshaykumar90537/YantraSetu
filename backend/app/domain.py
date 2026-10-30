"""Pure, deterministic rules. Money is always Decimal, never binary float."""
from decimal import Decimal, ROUND_HALF_UP
from math import radians, sin, cos, asin, sqrt, ceil
from itertools import permutations

ACTIVE = {'PENDING', 'APPROVED', 'IN_PROGRESS'}
TRANSITIONS = {'approve': ('PENDING', 'APPROVED'), 'reject': ('PENDING','REJECTED')}

def money(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def bill(rate, quantity, mobilization, addons_rate=0):
    r, q, m, a = map(lambda x: Decimal(str(x)), (rate, quantity, mobilization, addons_rate))
    if not all(x.is_finite() for x in (r, q, m, a)) or r <= 0 or q <= 0 or m < 0 or a < 0:
        raise ValueError('Invalid price or quantity')
    base_rental = money(r * q)
    addons = money(a * q)
    rental = money((r + a) * q)
    return {'rental': rental, 'base_rental': base_rental, 'addons': addons, 'mobilization': money(m), 'total': money(rental + m)}

def meter_quantity(start, end):
    result = Decimal(str(end))-Decimal(str(start))
    if Decimal(str(start)) < 0 or result <= 0:
        raise ValueError('End reading must exceed the nonnegative start reading')
    return result

def distance(a,b):
    lat1,lon1,lat2,lon2 = map(radians,(*a,*b))
    return 6371.0088 * 2 * asin(min(1,sqrt(sin((lat2-lat1)/2)**2+cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2)))

def optimize(depot, jobs, speed_kmh=20):
    """Exact small-instance solver: fixed appointments, one machine, max 8 jobs.
    Travel is a disclosed straight-line approximation, never road navigation.
    No commitment is moved. Returns infeasible if all jobs cannot be served.
    Windows and duration are minutes from the selected day's midnight.
    """
    if not jobs or len(jobs)>8 or speed_kmh<=0:
        raise ValueError('Supply 1–8 jobs and positive travel speed')
    best = None
    for order in permutations(jobs):
        now,km,pos,stops = 0,0.0,depot,[]
        for job in order:
            leg = distance(pos,job['point'])
            arrival = now + ceil(leg/speed_kmh*60)
            start = max(arrival,job['earliest'])
            finish = start+job['duration']
            if start>job['latest_start'] or finish>1440:
                break
            stops.append({'id':job['id'],'arrival_minute':arrival,'start_minute':start,'end_minute':finish,'leg_km':round(leg,3)})
            km += leg
            now,pos = finish,job['point']
        else:
            back = distance(pos,depot)
            if now+ceil(back/speed_kmh*60)>1440: continue
            km+=back
            if best is None or km<best['estimated_km']:
                best={'stops':stops,'estimated_km':km,'return_minute':now+ceil(back/speed_kmh*60)}
    baseline=sum(2*distance(depot,j['point']) for j in jobs)
    if best is None:
        return {'feasible':False,'reason':'Travel plus service cannot meet every fixed appointment.'}
    best.update(feasible=True,baseline_km=round(baseline,3),saved_km=round(baseline-best['estimated_km'],3),
                baseline='Separate depot round trip for each job; distance-only comparator.',
                assumptions='Straight-line distance at 20 km/h, fixed start times, one machine, return to depot. Not road routing; access restrictions and breaks need review.',
                solver='Exact enumeration v1 (maximum 8 jobs); proposal only, bookings unchanged.')
    best['estimated_km']=round(best['estimated_km'],3)
    return best

def find_next_available_slot(now_dt, busy_intervals, buffer_minutes=15, duration_minutes=120):
    """Finds next continuous free slot of duration_minutes starting at or after now_dt."""
    from datetime import timedelta
    minute = (now_dt.minute // 15 + 1) * 15
    curr = now_dt.replace(second=0, microsecond=0)
    if minute >= 60:
        curr = curr.replace(minute=0) + timedelta(hours=1)
    else:
        curr = curr.replace(minute=minute)
    
    intervals = []
    for iv in busy_intervals:
        s = iv.get('start_at') if isinstance(iv, dict) else iv[0]
        e = iv.get('reserved_until', iv.get('end_at')) if isinstance(iv, dict) else iv[1]
        if e > curr:
            intervals.append((s, e))
    intervals.sort(key=lambda x: x[0])
    
    req_dur = timedelta(minutes=duration_minutes)
    candidate_start = curr
    for s, e in intervals:
        if candidate_start + req_dur <= s:
            return {'start_at': candidate_start.isoformat(), 'end_at': (candidate_start + req_dur).isoformat()}
        if candidate_start < e:
            candidate_start = e
    return {'start_at': candidate_start.isoformat(), 'end_at': (candidate_start + req_dur).isoformat()}

