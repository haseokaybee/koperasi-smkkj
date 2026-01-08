import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Use "export function" directly
export function generateClassPDF(selectedClass, students, stats) {
  try {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('ms-MY');

    doc.setFontSize(18);
    doc.text('KOPERASI SMK KHIR JOHARI', 14, 20);
    doc.setFontSize(11);
    doc.text(`SENARAI PELAJAR KELAS: ${selectedClass.name.toUpperCase()}`, 14, 30);
    doc.text(`Tarikh: ${date} | Bil. Pelajar: ${students.length}`, 14, 35);

    const tableRows = students.map((s, index) => [
      index + 1,
      (s.name || '').toUpperCase(),
      s.ic_number || '-',
      s.member_number || '-',
      s.gender || '-',
      `RM ${Number(s.savings || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['NO', 'NAMA PELAJAR', 'NO. IC', 'NO. AHLI', 'JANTINA', 'MODAL SYER']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 }
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 45;
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