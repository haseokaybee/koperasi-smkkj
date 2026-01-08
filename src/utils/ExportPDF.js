import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { schoolLogo } from '../assets/logoBase64'; // Import your logo string

export function generateClassPDF(selectedClass, students, stats) {
  try {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('ms-MY');

    // --- ADD LOGO HERE ---
    // doc.addImage(imageData, format, x, y, width, height)
    doc.addImage(schoolLogo, 'PNG', 14, 10, 20, 20); 

    // Adjust text positions to the right of the logo
    doc.setFontSize(16);
    doc.text('KOPERASI SMK KHIR JOHARI', 38, 18);
    doc.setFontSize(10);
    doc.text('SUNGAI PETANI BERHAD', 38, 24);
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    doc.text(`SENARAI PELAJAR KELAS: ${selectedClass.name.toUpperCase()}`, 14, 40);
    doc.text(`Tarikh: ${date} | Bil. Pelajar: ${students.length}`, 14, 45);

    const tableRows = students.map((s, index) => [
      index + 1,
      (s.name || '').toUpperCase(),
      s.ic_number || '-',
      s.member_number || '-',
      s.gender || '-',
      `RM ${Number(s.savings || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 50, // Moved down to accommodate logo/header
      head: [['NO', 'NAMA PELAJAR', 'NO. IC', 'NO. AHLI', 'JANTINA', 'MODAL SYER']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 50;
    doc.setFontSize(10);
    doc.text(
      `Jumlah Keseluruhan Simpanan: RM ${stats.totalSavings.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, 
      14, 
      finalY + 10
    );

    doc.save(`Senarai_${selectedClass.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);

  } catch (error) {
    console.error("PDF Error:", error);
    alert("Gagal menjana PDF.");
  }
}