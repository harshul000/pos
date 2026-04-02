/**
 * Prints a POS-formatted thermal receipt for the given order.
 * Opens a small popup window with just the bill content.
 */
export function printBill(order) {
    const outletName = order.outlet_name || 'THE GRAND BISTRO';
    const itemsHtml = (order.items || []).map(item => `
        <div style="margin-bottom:3px;">
            <div>${item.menu_item_name || 'Item'}</div>
            <div style="display:flex;justify-content:space-between;padding-left:8px;">
                <span>${item.quantity} x &#8377;${(item.subtotal / item.quantity).toFixed(2)}</span>
                <span>&#8377;${Number(item.subtotal).toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    const discountRow = order.discount_amount > 0
        ? `<div style="display:flex;justify-content:space-between;"><span>Discount</span><span>-&#8377;${Number(order.discount_amount).toFixed(2)}</span></div>`
        : '';

    const paymentRow = order.payment_method
        ? `<div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Payment</span><span>${order.payment_method.replace('_', ' ').toUpperCase()}</span></div>`
        : '';

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Bill #${order.order_number}</title>
<style>
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    width: 280px;
    margin: 0 auto;
    padding: 8px;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  .total { font-size: 14px; font-weight: bold; }
</style>
</head>
<body>
<div class="center bold" style="font-size:14px;">${outletName}</div>
<div class="center" style="font-size:11px;">Restaurant &amp; Dining</div>
<div class="center" style="font-size:10px;margin-bottom:4px;">GST No: 27XXXXX1234Z</div>
<div class="divider"></div>
<div class="row"><span>Order#</span><span>${order.order_number}</span></div>
<div class="row"><span>Table</span><span>${order.table_number || 'Takeaway'}</span></div>
<div class="row"><span>Covers</span><span>${order.cover_count || 1}</span></div>
<div class="row"><span>Date</span><span>${new Date().toLocaleDateString('en-IN')}</span></div>
<div class="row"><span>Time</span><span>${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
<div class="divider"></div>
<div class="row bold"><span>Item</span><span>Amt</span></div>
<div class="divider"></div>
${itemsHtml}
<div class="divider"></div>
<div class="row"><span>Subtotal</span><span>&#8377;${Number(order.subtotal).toFixed(2)}</span></div>
<div class="row"><span>GST (5%)</span><span>&#8377;${Number(order.tax_amount).toFixed(2)}</span></div>
${discountRow}
<div class="divider"></div>
<div class="row total"><span>TOTAL</span><span>&#8377;${Number(order.total_amount).toFixed(2)}</span></div>
${paymentRow}
<div class="divider"></div>
<div class="center" style="font-size:11px;">Thank you for dining with us!</div>
<div class="center" style="font-size:10px;">Please visit again</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=350,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
}
