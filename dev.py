"""Native local workflow: python dev.py check|init|seed|serve|test.
Uses the current Python environment, never installs software or creates databases.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parent

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['check','init','seed','serve','test'])
    args=parser.parse_args()
    try:
        from dotenv import load_dotenv
    except ImportError:
        parser.exit(1,'Install backend dependencies first: python -m pip install -r backend/requirements.txt\n')
    load_dotenv(ROOT/'.env',override=False)
    if args.command!='test':
        if not os.getenv('DATABASE_URL') and not all(os.getenv(k) for k in ['PGDATABASE','PGUSER']):
            parser.exit(1,'Copy .env.example to .env and configure the local database fields.\n')
        if args.command=='serve' and len(os.getenv('OTP_SECRET',''))<32:
            parser.exit(1,'Set a random OTP_SECRET of at least 32 characters in .env.\n')
    if args.command=='check':
        import psycopg
        try:
            with psycopg.connect(os.getenv('DATABASE_URL',''),connect_timeout=5) as conn:
                version=conn.execute('SHOW server_version').fetchone()[0]
                rows=conn.execute("SELECT name,installed_version FROM pg_available_extensions WHERE name IN ('postgis','btree_gist')").fetchall()
        except psycopg.Error:
            parser.exit(1,'Database connection failed. Check the PostgreSQL service, database, role and .env credentials locally.\n')
        print('Connected to PostgreSQL '+version)
        available=dict(rows)
        for name in ['postgis','btree_gist']:
            print(name+': '+('installed '+available[name] if available.get(name) else 'available; must be enabled by database admin' if name in available else 'not installed on server'))
        return 0 if all(available.get(name) for name in ['postgis','btree_gist']) else 1
    commands={
        'init':['-m','app.migrate'],
        'seed':['-m','app.seed'],
        'serve':['-m','uvicorn','app.main:app','--reload','--host','127.0.0.1','--port','8000'],
        'test':['-m','pytest','-q'],
    }
    try:
        return subprocess.run([sys.executable,*commands[args.command]],cwd=ROOT/'backend',check=False).returncode
    except KeyboardInterrupt:
        return 130

if __name__=='__main__':
    raise SystemExit(main())
