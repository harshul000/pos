import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import AdminLayout from '@/components/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Download } from 'lucide-react';
import { toast } from 'sonner';

const TableManagement = () => {
  const [tables, setTables] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [outletId, setOutletId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const outletsRes = await api.get('/admin/outlets');
      if (outletsRes.data.length > 0) {
        const firstOutlet = outletsRes.data[0].id;
        setOutletId(firstOutlet);
        
        const [tablesRes, qrRes] = await Promise.all([
          api.get(`/admin/tables/${firstOutlet}`),
          api.get(`/admin/tables/${firstOutlet}/qr-codes`)
        ]);
        
        setTables(tablesRes.data);
        setQrCodes(qrRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateQR = async (tableId) => {
    try {
      await api.post(`/admin/tables/${tableId}/regenerate-qr`);
      toast.success('QR code regenerated');
      fetchData();
    } catch (error) {
      toast.error('Failed to regenerate QR code');
    }
  };

  const downloadQR = (qrImage, tableNumber) => {
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `table-${tableNumber}-qr.png`;
    link.click();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-xl">Loading tables...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div data-testid="table-management-page">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Table & QR Management</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map(table => {
            const qrData = qrCodes.find(qr => qr.table_id === table.id);
            
            return (
              <Card key={table.id} className="p-6" data-testid={`table-card-${table.table_number}`}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#1A2E05] mb-2">{table.table_number}</div>
                  <Badge className="mb-4">{table.status}</Badge>
                  <div className="text-sm text-slate-600 mb-4">Capacity: {table.capacity}</div>
                  
                  {showQR === table.id && qrData && (
                    <div className="mb-4">
                      <img
                        src={qrData.qr_image}
                        alt={`QR ${table.table_number}`}
                        className="w-full max-w-xs mx-auto border-4 border-slate-200 rounded-lg"
                      />
                      <div className="text-xs text-slate-500 mt-2 break-all">{qrData.qr_url}</div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => setShowQR(showQR === table.id ? null : table.id)}
                      variant="outline"
                      size="sm"
                      data-testid={`show-qr-${table.id}`}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {showQR === table.id ? 'Hide' : 'Show'} QR
                    </Button>
                    
                    {qrData && (
                      <>
                        <Button
                          onClick={() => downloadQR(qrData.qr_image, table.table_number)}
                          size="sm"
                          data-testid={`download-qr-${table.id}`}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download QR
                        </Button>
                        
                        <Button
                          onClick={() => regenerateQR(table.id)}
                          variant="outline"
                          size="sm"
                          data-testid={`regenerate-qr-${table.id}`}
                        >
                          Regenerate QR
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {tables.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-slate-600">No tables found</p>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default TableManagement;
