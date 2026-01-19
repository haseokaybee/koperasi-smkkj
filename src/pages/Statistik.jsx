import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import CounterMoney from './CounterMoney';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Statistik.css';

// Import Chart.js for advanced visualizations
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler,
  RadialLinearScale
} from 'chart.js';
import { Pie, Bar, Line, Doughnut, Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler,
  RadialLinearScale
);

export default function Statistik() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [timeRange, setTimeRange] = useState('all'); // 'all', 'month', 'year'
  const chartRef = useRef(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  
  // Enhanced stats state
  const [stats, setStats] = useState({
    totalStudents: 0,
    maleCount: 0,
    femaleCount: 0,
    totalSavings: 0,
    averageSavings: 0,
    maxSavings: 0,
    minSavings: 0,
    classDistribution: {},
    savingsByClass: {},
    savingsByGender: { male: 0, female: 0 },
    monthlyTrend: [],
    topStudents: [],
    recentAdditions: 0,
    genderPercentage: { male: 0, female: 0 }
  });

  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [activeChart, setActiveChart] = useState('pie'); // 'pie', 'bar', 'line', 'radar'

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch students and classes data
      const [{ data: studentsData, error: studentsError }, { data: classesData, error: classesError }] =
        await Promise.all([
          supabase.from('students').select('*').order('name', { ascending: true }),
          supabase.from('classes').select('*').order('name', { ascending: true })
        ]);

      if (studentsError) throw studentsError;
      if (classesError) throw classesError;

      const students = studentsData || [];
      const classesList = classesData || [];
      setAllStudents(students);
      setClasses(classesList);

      const now = new Date();
      const currentYear = now.getFullYear();
      const rangeStart = (() => {
        if (timeRange === 'month') {
          const start = new Date(now);
          start.setDate(start.getDate() - 30);
          return start;
        }
        if (timeRange === 'year') {
          return new Date(currentYear, 0, 1);
        }
        return null;
      })();

      const filteredStudents = students.filter((student) => {
        if (!rangeStart) return true;
        if (!student.created_at) return false;
        const createdDate = new Date(student.created_at);
        if (Number.isNaN(createdDate.getTime())) return false;
        return createdDate >= rangeStart && createdDate <= now;
      });
      setFilteredStudents(filteredStudents);

      // Calculate comprehensive statistics
      const totalStudents = filteredStudents.length;
      const maleStudents = filteredStudents.filter(s => s.gender === 'LELAKI');
      const femaleStudents = filteredStudents.filter(s => s.gender === 'PEREMPUAN');
      const maleCount = maleStudents.length;
      const femaleCount = femaleStudents.length;
      const savingsList = filteredStudents.map(s => Number(s.savings) || 0);
      const totalSavings = savingsList.reduce((sum, val) => sum + val, 0);
      const averageSavings = totalStudents > 0 ? totalSavings / totalStudents : 0;
      const maxSavings = savingsList.length > 0 ? Math.max(...savingsList) : 0;
      const minSavings = savingsList.length > 0 ? Math.min(...savingsList) : 0;
      
      // Class distribution
      const classDistribution = {};
      const savingsByClass = {};
      
      filteredStudents.forEach(student => {
        const className = classesList.find(c => c.id === student.class_id)?.name || 'Tidak Diketahui';
        classDistribution[className] = (classDistribution[className] || 0) + 1;
        savingsByClass[className] = (savingsByClass[className] || 0) + (Number(student.savings) || 0);
      });

      // Savings by gender
      const savingsByGender = {
        male: maleStudents.reduce((sum, s) => sum + (Number(s.savings) || 0), 0),
        female: femaleStudents.reduce((sum, s) => sum + (Number(s.savings) || 0), 0)
      };

      // Top students by savings
      const topStudents = [...filteredStudents]
        .sort((a, b) => (Number(b.savings) || 0) - (Number(a.savings) || 0))
        .slice(0, 5)
        .map(s => ({
          name: s.name,
          savings: Number(s.savings) || 0,
          class: classesList.find(c => c.id === s.class_id)?.name || 'N/A'
        }));

      // Recent additions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAdditions = filteredStudents.filter(s => {
        const createdDate = s.created_at ? new Date(s.created_at) : null;
        return createdDate && createdDate > thirtyDaysAgo;
      }).length;

      // Monthly trend (using actual data if available)
      const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(currentYear, i, 1);
        const monthStudents = filteredStudents.filter(s => {
          const createdDate = s.created_at ? new Date(s.created_at) : null;
          return createdDate && 
                 createdDate.getMonth() === monthDate.getMonth() && 
                 createdDate.getFullYear() === monthDate.getFullYear();
        });
        
        return {
          month: monthDate.toLocaleDateString('ms-MY', { month: 'short' }),
          count: monthStudents.length,
          savings: monthStudents.reduce((sum, s) => sum + (Number(s.savings) || 0), 0)
        };
      });

      // Calculate gender percentages
      const genderPercentage = {
        male: totalStudents > 0 ? (maleCount / totalStudents) * 100 : 0,
        female: totalStudents > 0 ? (femaleCount / totalStudents) * 100 : 0
      };

      setStats({
        totalStudents,
        maleCount,
        femaleCount,
        totalSavings,
        averageSavings,
        maxSavings,
        minSavings,
        classDistribution,
        savingsByClass,
        savingsByGender,
        monthlyTrend,
        topStudents,
        recentAdditions,
        genderPercentage
      });

    } catch (err) {
      console.error("Error fetching stats:", err.message);
      alert("Ralat memuatkan data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Chart Data Configurations
  const genderChartData = {
    labels: ['Lelaki', 'Perempuan'],
    datasets: [
      {
        data: [stats.maleCount, stats.femaleCount],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(244, 114, 182, 0.8)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(244, 114, 182)'
        ],
        borderWidth: 2,
        hoverOffset: 20
      }
    ]
  };

  const savingsByClassData = {
    labels: Object.keys(stats.classDistribution),
    datasets: [
      {
        label: 'Jumlah Simpanan (RM)',
        data: Object.values(stats.savingsByClass),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2
      },
      {
        label: 'Bilangan Ahli',
        data: Object.values(stats.classDistribution),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2
      }
    ]
  };

  const monthlyTrendData = {
    labels: stats.monthlyTrend.map(m => m.month),
    datasets: [
      {
        label: 'Simpanan (RM)',
        data: stats.monthlyTrend.map(m => m.savings),
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Ahli Baru',
        data: stats.monthlyTrend.map(m => m.count),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const radarChartData = {
    labels: ['Jumlah Ahli', 'Simpanan (RM)', 'Purata Simpanan', 'Ahli Lelaki', 'Ahli Perempuan'],
    datasets: [
      {
        label: 'Statistik Utama',
        data: [
          stats.totalStudents,
          stats.totalSavings / Math.max(1000, stats.totalSavings/10), // Dynamic scaling
          stats.averageSavings,
          stats.maleCount,
          stats.femaleCount
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)'
      }
    ]
  };

  // Chart Options
  const isLight = theme === 'light';
  const chartTextColor = isLight ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)';
  const chartGridColor = isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const chartTickColor = isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.7)';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: chartTextColor,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
      }
    }
  };

  // Enhanced PDF Generation with premium styling
  const generatePDF = async () => {
    setExportingPDF(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const date = new Date().toLocaleDateString('ms-MY');
      const time = new Date().toLocaleTimeString('ms-MY');
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Add header with gradient effect
      doc.setFillColor(2, 6, 23);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Title with school logo (text-based)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN STATISTIK KOPERASI', pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(16);
      doc.text('SMK KHIR JOHARI', pageWidth / 2, 28, { align: 'center' });
      
      // Subtitle
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text(`Dicetak pada: ${date} ${time}`, pageWidth / 2, 35, { align: 'center' });

      // Summary Section
      let yPos = 50;
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('RINGKASAN EKSEKUTIF', 20, yPos);
      yPos += 10;

      // Calculate percentages
      const malePercentage = stats.totalStudents > 0 ? (stats.maleCount / stats.totalStudents * 100).toFixed(1) : 0;
      const femalePercentage = stats.totalStudents > 0 ? (stats.femaleCount / stats.totalStudents * 100).toFixed(1) : 0;

      // Summary table with styling
      autoTable(doc, {
        startY: yPos,
        head: [['METRIK', 'NILAI', 'PERBANDINGAN']],
        body: [
          ['Jumlah Ahli', `${stats.totalStudents} Orang`, `${malePercentage}% Lelaki`],
          ['Modal Syer', `RM ${stats.totalSavings.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`, `RM ${stats.averageSavings.toFixed(2)} / Ahli`],
          ['Ahli Lelaki', `${stats.maleCount} Orang`, `${malePercentage}%`],
          ['Ahli Perempuan', `${stats.femaleCount} Orang`, `${femalePercentage}%`],
          ['Simpanan Tertinggi', `RM ${stats.maxSavings.toFixed(2)}`, 'Pelajar Terbaik'],
          ['Simpanan Terendah', `RM ${stats.minSavings.toFixed(2)}`, 'Minimum']
        ],
        theme: 'striped',
        headStyles: { 
          fillColor: [59, 130, 246],
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 10 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 10 }
      });

      // Top Performers Section
      yPos = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('5 AHLI TERATAS (MENGIKUT SIMPANAN)', 20, yPos);
      yPos += 10;

      const topPerformers = stats.topStudents.map((student, index) => [
        index + 1,
        (student.name || '').toUpperCase(),
        student.class || 'N/A',
        `RM ${(student.savings || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['KEDUDUKAN', 'NAMA PELAJAR', 'KELAS', 'JUMLAH SIMPANAN']],
        body: topPerformers,
        theme: 'grid',
        headStyles: { 
          fillColor: [34, 197, 94],
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          3: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // Detailed Student List (if space allows)
      if (filteredStudents.length <= 50 && filteredStudents.length > 0) {
        yPos = doc.lastAutoTable.finalY + 15;
        doc.addPage();
        doc.setFontSize(14);
        doc.text('SENARAI AHLI LENGKAP', 20, 20);

        const studentRows = filteredStudents.map((s, index) => [
          index + 1,
          (s.name || '').toUpperCase(),
          classes.find(c => c.id === s.class_id)?.name || 'N/A',
          s.gender || 'N/A',
          `RM ${(Number(s.savings) || 0).toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 25,
          head: [['NO', 'NAMA', 'KELAS', 'JANTINA', 'SYER (RM)']],
          body: studentRows,
          theme: 'striped',
          headStyles: { fillColor: [31, 41, 55], textColor: 255 },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 10 },
            4: { halign: 'right' }
          },
          margin: { left: 10, right: 10 }
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Halaman ${i} daripada ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text('Dikemaskini secara automatik - Sistem Koperasi SMK Khir Johari', pageWidth / 2, pageHeight - 5, { align: 'center' });
      }

      // Save PDF
      doc.save(`Laporan_Koperasi_SMKKJ_${date.replace(/\//g, '-')}.pdf`);
      
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Ralat menjana laporan PDF: " + error.message);
    } finally {
      setExportingPDF(false);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    setExportingExcel(true);
    try {
      // Dynamically import xlsx for code splitting
      const XLSX = await import('xlsx');
      
      // Check if there are students
      if (filteredStudents.length === 0) {
        alert("Tiada data pelajar untuk dieksport");
        setExportingExcel(false);
        return;
      }

      // Prepare data
      const studentData = filteredStudents.map((s, index) => ({
        'No': index + 1,
        'Nama': s.name || '',
        'No. IC': s.ic_number || '',
        'No. Ahli': s.member_number || '',
        'Kelas': classes.find(c => c.id === s.class_id)?.name || 'N/A',
        'Jantina': s.gender || '',
        'Simpanan (RM)': Number(s.savings) || 0,
        'Tarikh Daftar': s.created_at ? new Date(s.created_at).toLocaleDateString('ms-MY') : ''
      }));

      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const malePercentage = stats.totalStudents > 0 ? ((stats.maleCount / stats.totalStudents) * 100).toFixed(1) : 0;
      const femalePercentage = stats.totalStudents > 0 ? ((stats.femaleCount / stats.totalStudents) * 100).toFixed(1) : 0;
      
      const summaryData = [
        ['LAPORAN STATISTIK KOPERASI SMK KHIR JOHARI'],
        [`Dicetak pada: ${new Date().toLocaleString('ms-MY')}`],
        [],
        ['METRIK', 'NILAI', 'CATATAN'],
        ['Jumlah Ahli', stats.totalStudents, 'Orang'],
        ['Jumlah Simpanan', stats.totalSavings, 'Ringgit Malaysia'],
        ['Purata Simpanan', stats.averageSavings.toFixed(2), 'RM / Ahli'],
        ['Ahli Lelaki', stats.maleCount, `${malePercentage}%`],
        ['Ahli Perempuan', stats.femaleCount, `${femalePercentage}%`],
        ['Simpanan Tertinggi', stats.maxSavings.toFixed(2), 'RM'],
        ['Simpanan Terendah', stats.minSavings.toFixed(2), 'RM'],
        ['Ahli Baru (30 Hari)', stats.recentAdditions, 'Orang']
      ];
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

      // Students sheet
      const wsStudents = XLSX.utils.json_to_sheet(studentData);
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Senarai Ahli');

      // Class distribution sheet
      const classData = Object.entries(stats.classDistribution).map(([className, count]) => ({
        'Kelas': className,
        'Bilangan Ahli': count,
        'Jumlah Simpanan (RM)': stats.savingsByClass[className] || 0,
        'Purata Simpanan (RM)': count > 0 ? (stats.savingsByClass[className] || 0) / count : 0
      }));
      
      if (classData.length > 0) {
        const wsClasses = XLSX.utils.json_to_sheet(classData);
        XLSX.utils.book_append_sheet(wb, wsClasses, 'Taburan Kelas');
      }

      // Save file
      const fileName = `Data_Koperasi_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error("Excel Export Error:", error);
      alert("Ralat mengeksport ke Excel: " + error.message);
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner">
          <div className="double-bounce1"></div>
          <div className="double-bounce2"></div>
        </div>
        <p>Memuatkan analisis data...</p>
      </div>
    );
  }

  return (
    <div className="statistik-page">
      {/* Header with Navigation */}
      <header className="statistik-header">
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-arrow-left"></i>
            <span>Kembali ke Dashboard</span>
          </button>
          <div className="header-title">
            <h1>
              <i className="fas fa-chart-pie"></i>
              Analisis Data Koperasi
            </h1>
            <p className="subtitle">Statistik Lanjutan & Visualisasi Data Sesi {new Date().getFullYear()}</p>
          </div>
          <div className="header-actions">
            <select 
              className="time-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="all">Semua Data</option>
              <option value="month">30 Hari Terakhir</option>
              <option value="year">Tahun {new Date().getFullYear()}</option>
            </select>
          </div>
        </div>
      </header>

      <div className="statistik-content">
        {/* Export Controls */}
        <div className="export-controls">
          <div className="export-info">
            <i className="fas fa-database"></i>
            <span>{stats.totalStudents} Rekod - {Object.keys(stats.classDistribution).length} Kelas</span>
          </div>
          <div className="export-buttons">
            <button 
              className="export-btn excel-btn"
              onClick={exportToExcel}
              disabled={exportingExcel || filteredStudents.length === 0}
            >
              {exportingExcel ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Menyedia...
                </>
              ) : (
                <>
                  <i className="fas fa-file-excel"></i> Export Excel
                </>
              )}
            </button>
            <button 
              className="export-btn pdf-btn"
              onClick={generatePDF}
              disabled={exportingPDF || filteredStudents.length === 0}
            >
              {exportingPDF ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Menjana...
                </>
              ) : (
                <>
                  <i className="fas fa-file-pdf"></i> Generate PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Key Metrics Dashboard */}
        <div className="metrics-dashboard">
          <div className="metric-card primary">
            <div className="metric-icon">
              <i className="fas fa-users"></i>
            </div>
            <div className="metric-content">
              <h3>Jumlah Ahli</h3>
              <div className="metric-value">
                <CounterMoney value={stats.totalStudents} prefix="" decimals={0} />
              </div>
              <div className="metric-trend">
                <i className="fas fa-chart-line"></i>
                <span>{stats.recentAdditions} ahli baru (30 hari)</span>
              </div>
            </div>
          </div>

          <div className="metric-card success">
            <div className="metric-icon">
              <i className="fas fa-coins"></i>
            </div>
            <div className="metric-content">
              <h3>Modal Syer</h3>
              <div className="metric-value">
                <CounterMoney value={stats.totalSavings} />
              </div>
              <div className="metric-trend">
                <i className="fas fa-calculator"></i>
                <span>RM {stats.averageSavings.toFixed(2)} / ahli</span>
              </div>
            </div>
          </div>

          <div className="metric-card info">
            <div className="metric-icon">
              <i className="fas fa-venus-mars"></i>
            </div>
            <div className="metric-content">
              <h3>Taburan Jantina</h3>
              <div className="metric-value">
                Lelaki: {stats.maleCount} / Perempuan: {stats.femaleCount}
              </div>
              <div className="metric-trend">
                <i className="fas fa-percentage"></i>
                <span>{stats.totalStudents > 0 ? (stats.maleCount/stats.totalStudents*100).toFixed(1) : 0}% Lelaki</span>
              </div>
            </div>
          </div>

          <div className="metric-card warning">
            <div className="metric-icon">
              <i className="fas fa-trophy"></i>
            </div>
            <div className="metric-content">
              <h3>Simpanan Tertinggi</h3>
              <div className="metric-value">
                RM {stats.maxSavings.toFixed(2)}
              </div>
              <div className="metric-trend">
                <i className="fas fa-award"></i>
                <span>RM {stats.minSavings.toFixed(2)} terendah</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Visualization Section */}
        <div className="chart-section">
          <div className="section-header">
            <h2><i className="fas fa-chart-bar"></i> Visualisasi Data</h2>
            <div className="chart-controls">
              <button 
                className={`chart-btn ${activeChart === 'pie' ? 'active' : ''}`}
                onClick={() => setActiveChart('pie')}
              >
                <i className="fas fa-chart-pie"></i> Pie
              </button>
              <button 
                className={`chart-btn ${activeChart === 'bar' ? 'active' : ''}`}
                onClick={() => setActiveChart('bar')}
              >
                <i className="fas fa-chart-bar"></i> Bar
              </button>
              <button 
                className={`chart-btn ${activeChart === 'line' ? 'active' : ''}`}
                onClick={() => setActiveChart('line')}
              >
                <i className="fas fa-chart-line"></i> Line
              </button>
              <button 
                className={`chart-btn ${activeChart === 'radar' ? 'active' : ''}`}
                onClick={() => setActiveChart('radar')}
              >
                <i className="fas fa-bullseye"></i> Radar
              </button>
            </div>
          </div>

          <div className="chart-container">
            {activeChart === 'pie' && (
              <div className="chart-wrapper">
                <h3>Taburan Jantina Ahli</h3>
                <div className="chart-inner">
                  {stats.totalStudents > 0 ? (
                    <Pie data={genderChartData} options={chartOptions} />
                  ) : (
                    <div className="no-data-chart">
                      <i className="fas fa-chart-pie"></i>
                      <p>Tiada data untuk dipaparkan</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeChart === 'bar' && (
              <div className="chart-wrapper">
                <h3>Simpanan & Bilangan Ahli Mengikut Kelas</h3>
                <div className="chart-inner">
                  {Object.keys(stats.classDistribution).length > 0 ? (
                    <Bar data={savingsByClassData} options={{
                      ...chartOptions,
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: chartGridColor
                          },
                          ticks: {
                            color: chartTickColor
                          }
                        },
                        x: {
                          grid: {
                            color: chartGridColor
                          },
                          ticks: {
                            color: chartTickColor
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="no-data-chart">
                      <i className="fas fa-chart-bar"></i>
                      <p>Tiada data kelas untuk dipaparkan</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeChart === 'line' && (
              <div className="chart-wrapper">
                <h3>Trend Bulanan</h3>
                <div className="chart-inner">
                  {stats.monthlyTrend.length > 0 ? (
                    <Line data={monthlyTrendData} options={{
                      ...chartOptions,
                      scales: {
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: chartGridColor
                          },
                          ticks: {
                            color: chartTickColor
                          }
                        },
                        x: {
                          grid: {
                            color: chartGridColor
                          },
                          ticks: {
                            color: chartTickColor
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="no-data-chart">
                      <i className="fas fa-chart-line"></i>
                      <p>Tiada data trend untuk dipaparkan</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeChart === 'radar' && (
              <div className="chart-wrapper">
                <h3>Radar Statistik Utama</h3>
                <div className="chart-inner">
                  {stats.totalStudents > 0 ? (
                    <Radar data={radarChartData} options={{
                      ...chartOptions,
                      scales: {
                        r: {
                          angleLines: {
                            color: chartGridColor
                          },
                          grid: {
                            color: chartGridColor
                          },
                          pointLabels: {
                            color: chartTextColor
                          },
                          ticks: {
                            color: chartTickColor,
                            backdropColor: 'transparent'
                          }
                        }
                      }
                    }} />
                  ) : (
                    <div className="no-data-chart">
                      <i className="fas fa-bullseye"></i>
                      <p>Tiada data statistik untuk dipaparkan</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Statistics */}
        <div className="detailed-stats">
          <div className="stats-column">
            <div className="stat-box">
              <h3><i className="fas fa-chart-pie"></i> Taburan Kelas</h3>
              <div className="class-distribution">
                {Object.keys(stats.classDistribution).length > 0 ? (
                  Object.entries(stats.classDistribution).map(([className, count]) => (
                    <div key={className} className="class-item">
                      <span className="class-name">{className}</span>
                      <div className="class-bar">
                        <div 
                          className="bar-fill"
                          style={{ 
                            width: `${(count / stats.totalStudents) * 100}%`,
                            backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`
                          }}
                        ></div>
                      </div>
                      <span className="class-count">{count} ahli</span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    <i className="fas fa-info-circle"></i>
                    <p>Tiada data taburan kelas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="stats-column">
            <div className="stat-box">
              <h3><i className="fas fa-crown"></i> 5 Ahli Teratas</h3>
              <div className="top-students">
                {stats.topStudents.length > 0 ? (
                  stats.topStudents.map((student, index) => (
                    <div key={index} className="top-student">
                      <div className="student-rank">
                        <span className="rank-badge">{index + 1}</span>
                        <div className="student-info">
                          <strong>{student.name}</strong>
                          <small>{student.class}</small>
                        </div>
                      </div>
                      <div className="student-savings">
                        <span className="savings-amount">RM {student.savings.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
                        <div className="savings-percent">
                          {stats.totalSavings > 0 ? ((student.savings / stats.totalSavings) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    <i className="fas fa-info-circle"></i>
                    <p>Tiada data pelajar teratas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gender Comparison */}
        <div className="gender-comparison-enhanced">
          <h2><i className="fas fa-venus-mars"></i> Perbandingan Jantina</h2>
          <div className="gender-cards">
            <div className="gender-card male">
              <div className="gender-header">
                <div className="gender-icon">
                  <i className="fas fa-mars"></i>
                </div>
                <h3>Ahli Lelaki</h3>
              </div>
              <div className="gender-stats">
                <div className="stat-item">
                  <span className="stat-label">Bilangan</span>
                  <span className="stat-value">{stats.maleCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Peratusan</span>
                  <span className="stat-value">
                    {stats.genderPercentage.male.toFixed(1)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Simpanan</span>
                  <span className="stat-value">RM {stats.savingsByGender.male.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="gender-card female">
              <div className="gender-header">
                <div className="gender-icon">
                  <i className="fas fa-venus"></i>
                </div>
                <h3>Ahli Perempuan</h3>
              </div>
              <div className="gender-stats">
                <div className="stat-item">
                  <span className="stat-label">Bilangan</span>
                  <span className="stat-value">{stats.femaleCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Peratusan</span>
                  <span className="stat-value">
                    {stats.genderPercentage.female.toFixed(1)}%
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Simpanan</span>
                  <span className="stat-value">RM {stats.savingsByGender.female.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="statistik-footer">
        <div className="footer-content">
          <p>
            <i className="fas fa-info-circle"></i>
            Data dikemaskini secara automatik. Laporan rasmi hendaklah dirujuk kepada setiausaha koperasi.
          </p>
          <div className="footer-stats">
            <span className="stat-item">
              <i className="fas fa-sync-alt"></i>
              Terakhir dikemaskini: {new Date().toLocaleTimeString('ms-MY')}
            </span>
            <button className="refresh-btn" onClick={fetchStats}>
              <i className="fas fa-redo"></i>
              Muat Semula Data
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
