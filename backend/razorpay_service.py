import razorpay
import os
from fastapi import HTTPException
import hmac
import hashlib

class RazorpayService:
    def __init__(self):
        self.key_id = os.environ.get('RAZORPAY_KEY_ID', '')
        self.key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
        self.webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
        
        if self.key_id and self.key_secret:
            self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
        else:
            self.client = None
    
    def create_order(self, amount: float, currency: str = "INR", receipt: str = None) -> dict:
        if not self.client:
            return {
                "id": f"order_test_{receipt}",
                "amount": int(amount * 100),
                "currency": currency,
                "receipt": receipt,
                "status": "created"
            }
        
        try:
            order_data = {
                "amount": int(amount * 100),
                "currency": currency,
                "receipt": receipt[:40] if receipt else None,
                "payment_capture": 1
            }
            order = self.client.order.create(data=order_data)
            return order
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Razorpay order creation failed: {str(e)}")
    
    def verify_payment_signature(self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
        if not self.client:
            return True
        
        try:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            self.client.utility.verify_payment_signature(params_dict)
            return True
        except Exception as e:
            print(f"Payment verification failed: {e}")
            return False
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        if not self.webhook_secret:
            return True
        
        try:
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            print(f"Webhook verification failed: {e}")
            return False

razorpay_service = RazorpayService()