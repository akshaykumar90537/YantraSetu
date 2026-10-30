"""Provider boundary. Development delivery is explicitly simulated."""
import os
from typing import Protocol
class SmsProvider(Protocol):
    def send(self,phone:str,message:str)->dict: ...
class DevelopmentSms:
    def send(self,phone,message):
        return {'delivery':'SIMULATED_NOT_SENT','message':'No SMS was sent. Development adapter.'}
def provider():
    if os.getenv('APP_ENV','development') != 'development' or os.getenv('SMS_PROVIDER','development')!='development':
        raise RuntimeError('Live SMS provider is not configured. Production authentication is disabled.')
    return DevelopmentSms()
