"""Idempotent, explicit synthetic demo data. Never creates fake real listings."""
from uuid import UUID
from psycopg.types.json import Jsonb
from app.db import db

with db() as c:
    users = [
        ('00000000-0000-4000-8000-000000000001', '+919000000001', 'Akshay Kumar', ['farmer']),
        ('00000000-0000-4000-8000-000000000002', '+919000000002', 'Harpreet Singh (Owner)', ['owner', 'farmer', 'fpo']),
        ('00000000-0000-4000-8000-000000000003', '+919000000003', 'Gurdeep Singh (Driver)', ['operator']),
    ]
    for ident, phone, name, roles in users:
        c.execute('INSERT INTO users(id,phone,name,roles) VALUES(%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, roles=EXCLUDED.roles', (ident, phone, name, roles))
    
    machines = [
        (1, 'DEMO · Mahindra 575 DI (45 HP)', 'Tractor', 650, 'hour', 30.901, 75.857,
         [{'name': 'Rotavator', 'rate': 250}, {'name': 'Disc Harrow', 'rate': 200}, {'name': 'Trolley', 'rate': 150}],
         True, 180),
        (2, 'DEMO · Shaktiman 6-foot Rotavator', 'Rotavator', 1200, 'acre', 30.912, 75.865,
         [{'name': 'Laser Leveller', 'rate': 350}],
         False, 0),
        (3, 'DEMO · Preet 987 Self-Propelled Harvester', 'Harvester', 2200, 'acre', 30.889, 75.841,
         [{'name': 'Straw Reaper', 'rate': 400}, {'name': 'Baler Attachment', 'rate': 500}],
         True, 250),
    ]
    for i, name, category, rate, unit, lat, lon, atts, fuel_inc, fuel_extra in machines:
        ident = f'10000000-0000-4000-8000-{i:012d}'
        c.execute("""INSERT INTO machines(id, owner_id, name, category, description, village, location, rate, unit, mobilization, attachments, fuel_included, fuel_rate_extra)
                     SELECT %s, id, %s, %s, %s, 'Ludhiana Ag Hub', ST_SetSRID(ST_MakePoint(%s,%s),4326)::geography, %s, %s, 250, %s, %s, %s
                     FROM users WHERE phone='+919000000002'
                     ON CONFLICT (id) DO UPDATE SET
                       name=EXCLUDED.name, category=EXCLUDED.category, rate=EXCLUDED.rate, unit=EXCLUDED.unit,
                       attachments=EXCLUDED.attachments, fuel_included=EXCLUDED.fuel_included, fuel_rate_extra=EXCLUDED.fuel_rate_extra""",
                  (ident, name, category, 'Synthetic hackathon listing. Verified with attachments & fuel options.', lon, lat, rate, unit, Jsonb(atts), fuel_inc, fuel_extra))

    # Add a sample completed booking with ratings & review badges
    b_id = '20000000-0000-4000-8000-000000000001'
    m_id = '10000000-0000-4000-8000-000000000001'
    farmer_id = '00000000-0000-4000-8000-000000000001'
    owner_id = '00000000-0000-4000-8000-000000000002'
    op_id = '00000000-0000-4000-8000-000000000003'
    c.execute("""INSERT INTO bookings(id, machine_id, farmer_id, operator_id, start_at, end_at, reserved_until, quantity, latitude, longitude, status, rate, unit, mobilization, estimate, meter_start, meter_end, actual_quantity, final_total, payment_status, idempotency_key, request_hash, selected_attachments, fuel_included, fuel_extra)
                 VALUES(%s, %s, %s, %s, now() - interval '2 days', now() - interval '2 days' + interval '3 hours', now() - interval '2 days' + interval '3 hours 15 minutes', 3, 30.901, 75.857, 'COMPLETED', 650, 'hour', 250, 2200, 102.500, 105.500, 3.000, 3250.00, 'PAID_OUTSIDE_PLATFORM', '30000000-0000-4000-8000-000000000001', 'sample_hash', %s, true, 180)
                 ON CONFLICT (id) DO NOTHING""",
              (b_id, m_id, farmer_id, op_id, Jsonb([{'name': 'Rotavator', 'rate': 250}])))
    
    # Add a sample rating with 5 stars, punctuality 5, badges
    c.execute("""INSERT INTO ratings(booking_id, author_id, target_id, score, punctuality, badges, comment, created_at)
                 VALUES(%s, %s, %s, 5, 5, ARRAY['Clean Machine', 'Experienced Driver', 'Full Tank', 'On-Time Arrival'], 'Tractor arrived right on time with sharp rotavator blades. Excellent work in 5 acres.', now() - interval '1 day')
                 ON CONFLICT (booking_id, author_id) DO UPDATE SET score=EXCLUDED.score, punctuality=EXCLUDED.punctuality, badges=EXCLUDED.badges, comment=EXCLUDED.comment""",
              (b_id, farmer_id, owner_id))

print('Seeded enhanced machinery listings, attachments, fuel options, and verified review badges.')
