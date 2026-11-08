"""Request-time maintenance also callable by a scheduled command; no fake delivery."""
from app.db import many

def expire_pending(c):
    rows=many(c,"""UPDATE bookings SET status='CANCELLED',closure_reason='Request expired before owner acceptance'
        WHERE status='PENDING' AND LEAST(response_due_at,start_at)<=now()
        RETURNING id,farmer_id,machine_id""")
    for row in rows:
        c.execute("INSERT INTO audit_log(booking_id,action) VALUES(%s,'REQUEST_EXPIRED')",(row['id'],))
        c.execute("""INSERT INTO notifications(user_id,message,delivery)
          SELECT id,%s,'IN_APP' FROM users WHERE id=%s OR id=(SELECT owner_id FROM machines WHERE id=%s)""",
          (f"Booking {row['id']}: request expired; its reserved slot has been released.",row['farmer_id'],row['machine_id']))
    return len(rows)

def reminders(c,user_id):
    c.execute("""WITH recipients AS (
      SELECT b.id FROM bookings b JOIN machines m ON m.id=b.machine_id
      WHERE b.status='APPROVED' AND b.start_at>now() AND b.start_at<=now()+interval '24 hours'
      AND (%s IN (b.farmer_id,m.owner_id,b.operator_id))
      AND COALESCE((SELECT reminders FROM notification_preferences WHERE user_id=%s),true)
    ), sent AS (
      INSERT INTO reminder_receipts(booking_id,user_id) SELECT id,%s FROM recipients
      ON CONFLICT DO NOTHING RETURNING booking_id
    ) INSERT INTO notifications(user_id,message,delivery)
      SELECT %s,'Upcoming rental '||booking_id::text||': starts within 24 hours. Check your booking details.','IN_APP' FROM sent""",
      (user_id,user_id,user_id,user_id))
