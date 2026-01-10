import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CounterMoney from './CounterMoney';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable'; 
import './Statistik.css';

export default function Statistik() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalStudents: 0, maleCount: 0, femaleCount: 0, totalSavings: 0 });
  const [allStudents, setAllStudents] = useState([]); // Store raw data for PDF table
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data) {
        const total = data.length;
        const male = data.filter(s => s.gender === 'LELAKI').length;
        const savings = data.reduce((sum, s) => sum + (Number(s.savings) || 0), 0);

        setStats({
          totalStudents: total,
          maleCount: male,
          femaleCount: total - male,
          totalSavings: savings
        });
        setAllStudents(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FULL WORKING PDF GENERATION ---
  const generatePDF = () => {
    try {
      // 1. Initialize doc
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('ms-MY');
      const time = new Date().toLocaleTimeString('ms-MY');

      // 1. Header & Title
      doc.setFontSize(20);
      doc.setTextColor(44, 62, 80);
      doc.text('LAPORAN STATISTIK KOPERASI SMK KHIR JOHARI', 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(`Tarikh Cetakan: ${date} | Masa: ${time}`, 105, 28, { align: 'center' });
      doc.line(20, 32, 190, 32);

      // 2. Summary Table
      doc.setFontSize(14);
      doc.text('Ringkasan Eksekutif', 20, 42);
      
      // FIX: Call autoTable(doc, {...}) instead of doc.autoTable({...})
      autoTable(doc, {
        startY: 45,
        head: [['Kategori', 'Butiran Statistik']],
        body: [
          ['Jumlah Ahli Berdaftar', `${stats.totalStudents} Orang`],
          ['Jumlah Modal Syer Terkumpul', `RM ${stats.totalSavings.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`],
          ['Bilangan Ahli Lelaki', `${stats.maleCount} Orang`],
          ['Bilangan Ahli Perempuan', `${stats.femaleCount} Orang`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 11 }
      });

      // 3. Detailed Student List
      const tableRows = allStudents.map((s, index) => [
        index + 1,
        (s.name || '').toUpperCase(),
        s.class_name || 'N/A',
        s.gender || 'N/A',
        `RM ${(Number(s.savings) || 0).toFixed(2)}`
      ]);

      // Access the Y position from the previous table
      const finalY = doc.lastAutoTable.finalY;

      doc.setFontSize(14);
      doc.text('Senarai Ahli Lengkap', 20, finalY + 15);

      // FIX: Call autoTable(doc, {...}) again
      autoTable(doc, {
        startY: finalY + 20,
        head: [['No', 'Nama Pelajar', 'Kelas', 'Jantina', 'Syer']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 10 },
          4: { halign: 'right' }
        }
      });

      // 4. Download
      doc.save(`Laporan_Koperasi_${date.replace(/\//g, '-')}.pdf`);
      
    } catch (error) {
      console.error("PDF Error Detailed:", error);
      alert("Ralat teknikal: " + error.message);
    }
  };

  if (loading) return <div className="loading-screen">Memuatkan...</div>;

  return (
    <div className="statistik-page">
      <div className="stat-content-wrapper">
        
        {/* Top Action Bar */}
        <div className="stat-actions">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <span>←</span> Kembali ke Dashboard
          </button>

          <button className="download-btn" onClick={generatePDF}>
            📥 Generate PDF Report
          </button>
        </div>

        <header className="stat-header">
          <h1>Analisis Data Koperasi</h1>
          <p>Sesi Persekolahan 2026</p>
        </header>

        {/* Hero Stats */}
        <div className="big-stats-grid">
          <div className="stat-hero-card money">
            <span>Jumlah Modal Syer Terkumpul</span>
            <h2>
              <CounterMoney value={stats.totalSavings} decimals={2} />
            </h2>
            <p>Ringgit Malaysia</p>
          </div>

          <div className="stat-hero-card students">
            <span>Jumlah Ahli Berdaftar</span>
            <h2>
              <CounterMoney value={stats.totalStudents} prefix="" decimals={0} />
            </h2>
            <p>Orang Pelajar</p>
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="gender-comparison">
          <div className="gender-box male">
            <div className="icon">♂</div>
            <h3>Ahli Lelaki</h3>
            <div className="number">{stats.maleCount}</div>
            <div className="percent">
              {stats.totalStudents > 0 ? ((stats.maleCount / stats.totalStudents) * 100).toFixed(1) : 0}%
            </div>
          </div>

          <div className="gender-box female">
            <div className="icon">♀</div>
            <h3>Ahli Perempuan</h3>
            <div className="number">{stats.femaleCount}</div>
            <div className="percent">
              {stats.totalStudents > 0 ? ((stats.femaleCount / stats.totalStudents) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}