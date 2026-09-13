export const formatWhatsAppPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
};

export const generateWhatsAppBillMessage = (bill, stallInfo) => {
  const dateStr = new Date(bill.dateTime).toLocaleDateString('en-IN');
  const timeStr = new Date(bill.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  let text = `🧾 *KRL CONSLOIDATES - MADIPAKKAM (Chetpet Stall)*\n`;
  text += `*Stall Sales Receipt*\n`;
  text += `------------------------------------\n`;
  text += `*Bill No:* ${bill.billNo}\n`;
  text += `*Date:* ${dateStr} ${timeStr}\n`;
  text += `*Payment Mode:* ${bill.paymentMode}\n`;

  if (bill.customerName) {
    text += `*Customer:* ${bill.customerName}\n`;
  }

  text += `------------------------------------\n`;
  text += `*ITEMS PURCHASED:*\n`;

  bill.items.forEach((item) => {
    text += `• ${item.name} (${item.weight}) x${item.qty} = ₹${item.amount}\n`;
  });

  text += `------------------------------------\n`;

  if (bill.subtotal && bill.subtotal !== bill.grandTotal) {
    text += `Subtotal: ₹${bill.subtotal}\n`;
    text += `Discount: -₹${bill.subtotal - bill.grandTotal}\n`;
  }

  text += `*GRAND TOTAL: ₹${bill.grandTotal}*\n`;
  text += `------------------------------------\n`;
  text += `Thank you! Visit again. 🙏`;

  return text;
};

export const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || navigator.vendor || window.opera
  );
};

export const sendWhatsAppBill = (bill, stallInfo, customPhone) => {
  const rawPhone = customPhone || bill.customerPhone;
  const formattedPhone = formatWhatsAppPhone(rawPhone);
  const message = generateWhatsAppBillMessage(bill, stallInfo);
  const encodedText = encodeURIComponent(message);

  let url = '';
  if (isMobileDevice()) {
    // Mobile devices open the native WhatsApp mobile app smoothly
    url = formattedPhone
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
  } else {
    // Desktop PCs open WhatsApp Web directly in the browser (bypasses Windows desktop app issues)
    url = formattedPhone
      ? `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?text=${encodedText}`;
  }

  window.open(url, '_blank');
};
