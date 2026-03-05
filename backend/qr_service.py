import qrcode
from io import BytesIO
import base64
from typing import Optional

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

def get_qr_url(qr_token: str, base_url: Optional[str] = None) -> str:
    if not base_url:
        base_url = "https://dhpos.com"
    return f"{base_url}/qr/{qr_token}"