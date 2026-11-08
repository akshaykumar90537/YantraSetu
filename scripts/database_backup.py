"""Native PostgreSQL backup and isolated restore check; never restores over an existing database.
python scripts/database_backup.py backup --output /private/path/backup.dump
python scripts/database_backup.py verify --archive /private/path/backup.dump
Requires pg_dump/pg_restore in PATH or PG_BIN. DATABASE_URL / PG* remain in process environment.
"""
import argparse,os,shutil,subprocess
from pathlib import Path
from uuid import uuid4
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from dotenv import load_dotenv

def environment():
    env=os.environ.copy()
    settings=conninfo_to_dict(env.get('DATABASE_URL',''))
    for key,value in settings.items():
        target={'dbname':'PGDATABASE','host':'PGHOST','port':'PGPORT','user':'PGUSER','password':'PGPASSWORD','sslmode':'PGSSLMODE','sslrootcert':'PGSSLROOTCERT','sslcert':'PGSSLCERT','sslkey':'PGSSLKEY','channel_binding':'PGCHANNELBINDING','options':'PGOPTIONS'}.get(key)
        if target:env[target]=str(value)
    return env

def command(name,args,env,output=None):
    executable=str(Path(env['PG_BIN'])/name) if env.get('PG_BIN') else shutil.which(name)
    if not executable:raise RuntimeError('Install PostgreSQL client tools or set PG_BIN.')
    result=subprocess.run([executable,*args],env=env,stdout=output or subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(name+' failed. Check database access, client version and available disk space. Credentials and raw errors are not printed.')
    return result.stdout

def backup(path,env):
    path=Path(path).resolve()
    if not path.parent.is_dir():raise ValueError('Create a private backup directory first.')
    # Exclusive creation refuses overwriting an existing backup.
    with path.open('xb') as out:
        command('pg_dump',['--format=custom','--no-owner','--no-acl'],env,out)
    command('pg_restore',['--list',str(path)],env)
    print('Backup archive created and its table of contents verified.')

def verify(path,env):
    path=Path(path).resolve(strict=True)
    target='ys_restore_check_'+uuid4().hex
    source=env.get('PGDATABASE')
    if not source:raise ValueError('Set PGDATABASE or DATABASE_URL.')
    kwargs={k:env[v] for k,v in {'host':'PGHOST','port':'PGPORT','user':'PGUSER','password':'PGPASSWORD','sslmode':'PGSSLMODE'}.items() if v in env}
    # Requires CREATEDB. The only dropped database is the new UUID-named target created here.
    with psycopg.connect(dbname=source,autocommit=True,**kwargs) as admin:
        admin.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(target)))
        try:
            restore_env={**env,'PGDATABASE':target}
            command('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname',target,str(path)],restore_env)
            with psycopg.connect(dbname=target,**kwargs) as c:
                version=c.execute('SELECT max(version) FROM schema_versions').fetchone()[0]
                for table in ['users','machines','bookings','machine_photos','support_cases']:
                    c.execute(sql.SQL('SELECT count(*) FROM {}').format(sql.Identifier(table))).fetchone()
            print(f'Isolated restore verified: schema version {version}; core tables readable.')
        finally:
            admin.execute(sql.SQL('DROP DATABASE {}').format(sql.Identifier(target)))

def main():
    load_dotenv(Path(__file__).resolve().parents[1]/'.env',override=False)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['backup','verify']);parser.add_argument('--output');parser.add_argument('--archive')
    args=parser.parse_args()
    try:
        if args.action=='backup':
            if not args.output:parser.error('--output is required')
            backup(args.output,environment())
        else:
            if not args.archive:parser.error('--archive is required')
            verify(args.archive,environment())
    except (RuntimeError,ValueError,OSError,psycopg.Error):
        parser.exit(1,'Backup/restore check failed. Check paths, database permissions, client tools and disk space. Existing databases were not overwritten.\n')
if __name__=='__main__':main()
