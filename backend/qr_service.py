import qrcode
from io import BytesIO
import base64
from typing import Optional
import os

def generate_qr_code(data: str, size: int = 10) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=size,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"

def get_qr_url(qr_token: str = None, base_url: Optional[str] = None) -> str:
    if not base_url:
        base_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://bistro-checkout-4.preview.emergentagent.com')
    return f"{base_url}/order"
