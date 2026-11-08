"""One maintenance pass: python -m app.maintenance. Safe to run repeatedly."""
from app.main import db, many, expire_pending, reminders

def main():
    with db() as c:
        expired=expire_pending(c)
        for row in many(c,'SELECT id FROM users WHERE NOT suspended'):
            reminders(c,row['id'])
    print(f'Maintenance completed: {expired} expired requests. In-app reminders updated.')

if __name__=='__main__': main()
