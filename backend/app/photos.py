"""Bounded pilot photo storage; re-encoding removes metadata, including GPS."""
import base64
import binascii
from io import BytesIO
from uuid import uuid4
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException

def normalize_photo(encoded):
    try:
        if len(encoded)>1_400_000:
            raise ValueError('Photo exceeds 1 MB')
        raw=base64.b64decode(encoded,validate=True)
        if len(raw)>1_000_000:
            raise ValueError('Photo exceeds 1 MB')
        with Image.open(BytesIO(raw),formats=['JPEG','PNG','WEBP']) as source:
            if source.width*source.height>16_000_000:
                raise ValueError('Photo exceeds 16 megapixels')
            source.load()
            photo=ImageOps.exif_transpose(source).convert('RGB')
            photo.thumbnail((1200,1200))
            output=BytesIO()
            photo.save(output,format='JPEG',quality=75,optimize=True)
            if len(output.getvalue())>300_000:
                raise ValueError('Choose a smaller photo')
            return output.getvalue()
    except (ValueError,binascii.Error,OSError,UnidentifiedImageError,Image.DecompressionBombError) as exc:
        raise HTTPException(422,'Use a valid JPEG, PNG or WebP under 1 MB and 16 megapixels.') from exc

def save_photos(c,machine_id,photos):
    if photos is None:
        return
    images=[normalize_photo(photo) for photo in photos]
    c.execute('DELETE FROM machine_photos WHERE machine_id=%s',(machine_id,))
    for position,image in enumerate(images):
        c.execute('INSERT INTO machine_photos(id,machine_id,image,position) VALUES(%s,%s,%s,%s)',(uuid4(),machine_id,image,position))
