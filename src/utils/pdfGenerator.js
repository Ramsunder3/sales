import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendWhatsAppBill, isMobileDevice } from './whatsapp';

export const buildBillPDFDoc = (bill, stallInfo) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // 80mm roll width
  });

  const primaryColor = [15, 118, 110]; // #0f766e teal
  let yPos = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('KRL CONSLOIDATES - MADIPAKKAM', 40, yPos, { align: 'center' });
  yPos += 4.5;

  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text('(Chetpet Stall)', 40, yPos, { align: 'center' });
  yPos += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('STALL SALES RECEIPT', 40, yPos, { align: 'center' });
  yPos += 4;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(4, yPos, 76, yPos);
  yPos += 4;

  // Bill Metadata
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bill No: ${bill.billNo}`, 5, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date(bill.dateTime).toLocaleDateString('en-IN')}`, 45, yPos);
  yPos += 3.5;

  doc.text(`Time: ${new Date(bill.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, 5, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(`Mode: ${bill.paymentMode}`, 45, yPos);
  yPos += 3.5;

  if (bill.customerName) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Cust: ${bill.customerName} ${bill.customerPhone ? '(' + bill.customerPhone + ')' : ''}`, 5, yPos);
    yPos += 3.5;
  }

  yPos += 1;

  // Items Table
  const tableData = bill.items.map(item => [
    `${item.name}\n(${item.weight})`,
    item.qty.toString(),
    `₹${item.rate}`,
    `₹${item.amount}`
  ]);

  autoTable(doc, {
    startY: yPos,
    margin: { left: 4, right: 4 },
    head: [['Item', 'Qty', 'Rate', 'Amt']],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 12, halign: 'right' },
      3: { cellWidth: 12, halign: 'right' }
    },
    theme: 'plain'
  });

  const finalY = doc.lastAutoTable.finalY + 3;

  doc.line(4, finalY, 76, finalY);
  let summaryY = finalY + 4;

  const calcSubtotal = bill.subtotal || bill.items.reduce((sum, i) => sum + (i.rate * i.qty), 0);
  const roundingAmount = bill.discount !== undefined ? bill.discount : (calcSubtotal - bill.grandTotal);

  if (calcSubtotal !== bill.grandTotal) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Subtotal:', 45, summaryY);
    doc.text(`₹${calcSubtotal}`, 74, summaryY, { align: 'right' });
    summaryY += 3.5;

    doc.text('Discount:', 45, summaryY);
    doc.text(`-₹${roundingAmount}`, 74, summaryY, { align: 'right' });
    summaryY += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('GRAND TOTAL:', 4, summaryY);
  doc.text(`₹${bill.grandTotal}`, 74, summaryY, { align: 'right' });

  summaryY += 5;
  doc.setLineWidth(0.3);
  doc.line(4, summaryY, 76, summaryY);
  summaryY += 4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you! Visit again.', 40, summaryY, { align: 'center' });

  return doc;
};

export const generateBillPDF = (bill, stallInfo) => {
  const doc = buildBillPDFDoc(bill, stallInfo);
  doc.save(`${bill.billNo}_KRLConsloidates_Receipt.pdf`);
};

export const shareBillPDFToCustomer = async (bill, stallInfo, customPhone) => {
  const doc = buildBillPDFDoc(bill, stallInfo);
  const pdfBlob = doc.output('blob');
  const fileName = `${bill.billNo}_KRLConsloidates_Receipt.pdf`;
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  // Use Native Web Share API if supported on mobile devices (allows direct PDF file attachment to WhatsApp app)
  if (isMobileDevice() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `KRL Consloidates Bill ${bill.billNo}`,
        text: `Here is your receipt for Bill #${bill.billNo} from KRL Consloidates - Madipakkam (MKMS Onam Celebrations  02/10/2026). Total: ₹${bill.grandTotal}`,
        files: [file]
      });
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Web Share failed:', err);
      } else {
        return;
      }
    }
  }

  // PC / WhatsApp Web Flow: Automatically download PDF receipt + open WhatsApp Web chat
  doc.save(fileName);
  sendWhatsAppBill(bill, stallInfo, customPhone);
};
