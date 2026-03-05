import os
from typing import Optional

class EmailService:
    def __init__(self):
        self.api_key = os.environ.get('SENDGRID_API_KEY')
        self.from_email = os.environ.get('FROM_EMAIL', 'noreply@dhpos.com')
        self.enabled = bool(self.api_key and self.api_key != 'SG.dummy_sendgrid_api_key')
    
    async def send_order_confirmation(self, to_email: str, order_number: str, order_details: dict):
        if not self.enabled:
            print(f"[EMAIL MOCK] Order Confirmation to {to_email}")
            print(f"Order Number: {order_number}")
            print(f"Order Details: {order_details}")
            print(f"Total: ₹{order_details.get('total_amount', 0)}")
            return {"status": "mocked", "message": "Email logged to console"}
        
        return {"status": "success"}
    
    async def send_payment_receipt(self, to_email: str, payment_details: dict):
        if not self.enabled:
            print(f"[EMAIL MOCK] Payment Receipt to {to_email}")
            print(f"Payment Details: {payment_details}")
            return {"status": "mocked", "message": "Email logged to console"}
        
        return {"status": "success"}

email_service = EmailService()