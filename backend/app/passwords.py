"""Salted password hashes; credentials are stored separately from public profiles."""
import hashlib
import hmac
import secrets

ITERATIONS = 600_000


def hash_password(password):
    salt = secrets.token_hex(16)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERATIONS)
    return f'pbkdf2_sha256${ITERATIONS}${salt}${value.hex()}'


def check_password(password, encoded):
    algorithm, rounds, salt, expected = encoded.split('$')
    if algorithm != 'pbkdf2_sha256':
        return False
    actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds))
    return hmac.compare_digest(actual.hex(), expected)


# Unknown accounts still perform password hashing to avoid a quick timing signal.
DUMMY_HASH = hash_password(secrets.token_urlsafe(32))
