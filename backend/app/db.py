import os
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row

@contextmanager
def db():
    with psycopg.connect(os.environ.get('DATABASE_URL',''), row_factory=dict_row) as conn:
        yield conn

def one(conn,sql,args=()):
    return conn.execute(sql,args).fetchone()

def many(conn,sql,args=()):
    return conn.execute(sql,args).fetchall()
