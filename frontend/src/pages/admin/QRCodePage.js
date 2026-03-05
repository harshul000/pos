import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode as QrCodeIcon } from 'lucide-react';
import { toast } from 'sonner';

const QRCodePage = () => {
  const [qrImage, setQrImage] = useState(null);
  const customerUrl = `${window.location.origin}/order`;

  useEffect(() => {
    generateQRCode();
  }, []);

  const generateQRCode = async () => {
    try {
      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(customerUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#1A2E05',
          light: '#FFFFFF'
        }
      });
      setQrImage(qrDataUrl);
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const downloadQRCode = () => {
    if (!qrImage) return;
    
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = 'dh-pos-customer-order-qr.png';
    link.click();
    toast.success('QR code downloaded');
  };

  const printQRCode = () => {
    if (!qrImage) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>DH POS - Customer Order QR Code</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
              padding: 40px;
            }
            h1 {
              font-family: 'Playfair Display', serif;
              color: #1A2E05;
              margin-bottom: 10px;
            }
            p {
              color: #64748B;
              margin-bottom: 30px;
            }
            img {
              max-width: 400px;
              border: 4px solid #1A2E05;
              border-radius: 12px;
              padding: 20px;
              background: white;
            }
            .url {
              margin-top: 20px;
              font-size: 14px;
              color: #64748B;
              word-break: break-all;
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>The Grand Bistro</h1>
          <p>Scan to Order</p>
          <img src="${qrImage}" alt="Customer Order QR Code" />
          <div class="url">${customerUrl}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <AdminLayout>
      <div data-testid="qr-code-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Customer QR Code</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-8">
            <div className="text-center">
              <div className="mb-6">
                <QrCodeIcon className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-[#1A2E05] mb-2">Single QR Code for All Tables</h2>
                <p className="text-slate-600">Customers scan this QR code and select their table number during checkout</p>
              </div>
              
              {qrImage ? (
                <div className="bg-white p-6 rounded-xl border-4 border-[#1A2E05] inline-block">
                  <img src={qrImage} alt="Customer Order QR Code" className="w-full max-w-sm" />
                </div>
              ) : (
                <div className="animate-pulse bg-slate-200 h-64 w-64 mx-auto rounded-lg" />
              )}
              
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  onClick={downloadQRCode}
                  disabled={!qrImage}
                  className="w-full bg-[#1A2E05] hover:bg-[#1A2E05]/90"
                  data-testid="download-qr-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
                
                <Button
                  onClick={printQRCode}
                  disabled={!qrImage}
                  variant="outline"
                  className="w-full"
                  data-testid="print-qr-button"
                >
                  Print QR Code
                </Button>
              </div>
            </div>
          </Card>
          
          <Card className="p-8">
            <h3 className="text-xl font-bold text-[#1A2E05] mb-4">How It Works</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37] text-[#0F172A] flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Print & Display</div>
                  <div className="text-sm text-slate-600">Print this QR code and display it at your restaurant entrance or on each table</div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37] text-[#0F172A] flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Customer Scans</div>
                  <div className="text-sm text-slate-600">Customers scan the QR code with their phone camera</div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37] text-[#0F172A] flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Browse & Order</div>
                  <div className="text-sm text-slate-600">They browse your menu, add items to cart, and proceed to checkout</div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37] text-[#0F172A] flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Select Table</div>
                  <div className="text-sm text-slate-600">During checkout, they enter their name and select their table number (T1, T2, etc.)</div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#D4AF37] text-[#0F172A] flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Order Sent to Kitchen</div>
                  <div className="text-sm text-slate-600">Order appears in your Live Orders / Kitchen Display immediately</div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <div className="text-sm font-semibold text-slate-700 mb-2">Customer Order URL:</div>
              <div className="text-sm text-slate-600 break-all font-mono bg-white p-2 rounded">
                {customerUrl}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default QRCodePage;
