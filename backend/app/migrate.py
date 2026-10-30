from pathlib import Path
import os
from app.db import db, one
with db() as c:
    c.execute("SELECT pg_advisory_xact_lock(827163)")
    exists=one(c,"SELECT to_regclass('public.schema_versions') AS name")['name']
    if not exists:
        c.execute((Path(os.getenv('MIGRATIONS_DIR',str(Path(__file__).parents[2]/'db')))/'001_initial.sql').read_text())
        print('Applied migration 001')
    else:
        print('Schema already initialized')
