"""Delivery and token verification boundaries; credentials only come from environment."""
import os
import ssl
import smtplib
from email.message import EmailMessage
from fastapi import HTTPException


def email_mode():
    mode = os.getenv('EMAIL_PROVIDER', 'disabled')
    if mode == 'development' and os.getenv('APP_ENV', 'development') != 'development':
        return 'disabled'
    if mode == 'smtp' and not all(os.getenv(k) for k in ('SMTP_HOST', 'SMTP_FROM')):
        return 'disabled'
    return mode if mode in ('smtp', 'development') else 'disabled'


def send_email(address, code):
    mode = email_mode()
    if mode == 'development':
        return {'delivery': 'SIMULATED_NOT_SENT', 'development_code': code}
    if mode != 'smtp':
        raise HTTPException(503, 'Email sign-in is not configured. Contact the administrator.')
    msg = EmailMessage()
    msg['From'] = os.environ['SMTP_FROM']
    msg['To'] = address
    msg['Subject'] = 'Your YantraSetu verification code'
    msg.set_content(f'Your YantraSetu code is {code}. It expires in 5 minutes. Do not share this code. If you did not request it, ignore this email.')
    try:
        context = ssl.create_default_context()
        implicit_tls = os.getenv('SMTP_SECURITY', 'starttls') == 'ssl'
        cls = smtplib.SMTP_SSL if implicit_tls else smtplib.SMTP
        kwargs = {'context': context} if implicit_tls else {}
        with cls(os.environ['SMTP_HOST'], int(os.getenv('SMTP_PORT', '465' if implicit_tls else '587')), timeout=15, **kwargs) as smtp:
            if not implicit_tls:
                smtp.starttls(context=context)
            if os.getenv('SMTP_USERNAME'):
                smtp.login(os.environ['SMTP_USERNAME'], os.environ['SMTP_PASSWORD'])
            smtp.send_message(msg)
    except (OSError, smtplib.SMTPException, KeyError, ValueError) as exc:
        raise HTTPException(503, 'Email could not be sent. Please try again later.') from exc
    # SMTP acceptance does not guarantee inbox delivery.
    return {'delivery': 'EMAIL_ACCEPTED'}


def verify_google(credential):
    from google.oauth2 import id_token
    from google.auth.transport.requests import Request
    from google.auth.exceptions import GoogleAuthError
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    if not client_id:
        raise HTTPException(503, 'Google sign-in is not configured.')
    try:
        claims = id_token.verify_oauth2_token(credential, Request(), client_id)
    except ValueError as exc:
        raise HTTPException(401, 'Invalid or expired Google credential.') from exc
    except (GoogleAuthError, OSError) as exc:
        raise HTTPException(503, 'Google verification is temporarily unavailable.') from exc
    if claims.get('email_verified') is not True or not claims.get('sub') or not claims.get('email'):
        raise HTTPException(401, 'A verified Google email is required.')
    return claims
