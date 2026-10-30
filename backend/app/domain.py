"""Pure, deterministic rules. Money is always Decimal, never binary float."""
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta, timezone
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

def find_next_available_slot(now_dt, busy_intervals, buffer_minutes=15, duration_minutes=120):
    """Finds next continuous free slot of duration_minutes starting at or after now_dt, accounting for turnaround buffer."""
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
    buf_dur = timedelta(minutes=buffer_minutes)
    candidate_start = curr
    for s, e in intervals:
        if candidate_start < s:
            if candidate_start + req_dur + buf_dur <= s:
                return {'start_at': candidate_start.isoformat(), 'end_at': (candidate_start + req_dur).isoformat()}
            candidate_start = max(candidate_start, e)
        elif candidate_start < e:
            candidate_start = e
    return {'start_at': candidate_start.isoformat(), 'end_at': (candidate_start + req_dur).isoformat()}

MIN_BOOKING_DURATION = timedelta(minutes=30)
MAX_BOOKING_DURATION = timedelta(days=2)

def validate_booking_interval(start_at, end_at, now=None):
    """
    Validates booking time window:
    - Past Date Validation: start_at cannot be before now
    - End Before Start Validation: end_at must be strictly after start_at (end_at > start_at)
    - Booking Duration Validation: duration must be at least 30 minutes and <= 48 hours
    """
    from datetime import datetime, timezone
    if now is None:
        now = datetime.now(timezone.utc)
    if start_at < now:
        raise ValueError("Booking start time cannot be in the past.")
    if end_at <= start_at:
        raise ValueError("Booking end time must be after start time.")
    duration = end_at - start_at
    if duration < MIN_BOOKING_DURATION:
        raise ValueError("Booking duration must be at least 30 minutes.")
    if duration > MAX_BOOKING_DURATION:
        raise ValueError("Booking duration cannot exceed 48 hours.")


