from pathlib import Path
import os
import re
from app.db import db, one, many

migrations_dir = Path(os.getenv('MIGRATIONS_DIR', str(Path(__file__).parents[2] / 'db')))
with db() as c:
    c.execute("SELECT pg_advisory_xact_lock(827163)")
    exists = one(c, "SELECT to_regclass('public.schema_versions') AS name")['name']
    applied_versions = set()
    if exists:
        applied_versions = {row['version'] for row in many(c, "SELECT version FROM schema_versions")}
    
    sql_files = sorted(migrations_dir.glob('*.sql'))
    for sql_file in sql_files:
        match = re.match(r'^(\d+)_', sql_file.name)
        if not match:
            continue
        v = int(match.group(1))
        if v not in applied_versions:
            c.execute(sql_file.read_text(encoding='utf-8'))
            c.execute("INSERT INTO schema_versions(version) VALUES (%s) ON CONFLICT (version) DO NOTHING", (v,))
            print(f"Applied migration {v:03d} ({sql_file.name})")
            applied_versions.add(v)
    print("Database migrations up to date.")
