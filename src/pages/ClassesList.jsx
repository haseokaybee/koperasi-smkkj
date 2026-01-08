import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { generateClassPDF } from '../utils/ExportPDF';
import './ClassesList.css'; 

export default function ClassesList() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [classStats, setClassStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState(null)

  useEffect(() => {
    fetchClasses()
  }, [])

  async function fetchClasses() {
    try {
      const { data: classData } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true })
      
      const { data: studentData } = await supabase.from('students').select('*')
      
      const stats = studentData.reduce((acc, student) => {
        if (!acc[student.class_id]) {
          acc[student.class_id] = { count: 0, totalSavings: 0 }
        }
        acc[student.class_id].count += 1
        acc[student.class_id].totalSavings += (Number(student.savings) || 0)
        return acc
      }, {})

      setClasses(classData || [])
      setAllStudents(studentData || [])
      setClassStats(stats)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const filtered = allStudents.filter(s => s.class_id === selectedClass.id);
    const stats = classStats[selectedClass.id] || { totalSavings: 0 };
    
    if (filtered.length === 0) {
      alert("Tiada pelajar dalam kelas ini untuk dieksport.");
      return;
    }

    generateClassPDF(selectedClass, filtered, stats);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const filteredStudents = allStudents.filter(s => s.class_id === selectedClass?.id)

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{ color: 'white', padding: '100px', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <h2 style={{marginTop: '20px'}}>Memuatkan data kelas...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-brand"><h2>Koperasi SMK Khir Johari</h2></div>
        <div className="nav-controls">
          <button onClick={() => navigate('/dashboard')} className="tab-btn">Senarai Pelajar</button>
          <button onClick={() => { setSelectedClass(null); navigate('/classes'); }} className="tab-btn active">Lihat Kelas</button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="content-wrapper">
        {!selectedClass ? (
          <div className="class-grid">
            {classes.map(cls => {
              const stats = classStats[cls.id] || { count: 0, totalSavings: 0 };
              return (
                <div key={cls.id} className="class-card clickable" onClick={() => setSelectedClass(cls)}>
                  <p className="class-id-label">SESI 2026</p>
                  <h3>{cls.name}</h3>
                  <div className="class-info-stack">
                    <div className="student-count-badge">{stats.count} Pelajar</div>
                    <div className="class-savings-box" style={{ marginTop: '15px' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block' }}>Jumlah Simpanan</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>
                        RM {stats.totalSavings.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="click-hint">Klik untuk lihat senarai →</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="class-details-view" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <button className="back-btn" onClick={() => setSelectedClass(null)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer' }}>
                  ← Kembali
                </button>
                <h2 style={{ color: 'white', margin: 0 }}>{selectedClass.name}</h2>
              </div>
              
              <button onClick={handleExport} className="export-btn" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export PDF
              </button>
            </div>

            <div className="table-card">
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>NAMA</th>
                      <th>NO. IC / AHLI</th>
                      <th>JANTINA</th>
                      <th>SIMPANAN (RM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length > 0 ? filteredStudents.map(student => (
                      <tr key={student.id}>
                        <td style={{ fontWeight: '500' }}>{student.name}</td>
                        <td>
                          <div style={{display: 'flex', flexDirection: 'column'}}>
                            <span>{student.ic_number || 'N/A'}</span>
                            <small style={{opacity: 0.5, fontSize: '0.7rem'}}>AHLI: {student.member_number}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${student.gender?.toUpperCase() === 'LELAKI' ? 'badge-Lelaki' : 'badge-Perempuan'}`}>
                            {student.gender}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700', color: '#10b981' }}>
                          {Number(student.savings || 0).toFixed(2)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Tiada pelajar dalam kelas ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <footer className="dashboard-footer">
          <p>Hak Cipta Terpelihara &copy; 2026 Koperasi SMK Khir Johari</p>
        </footer>
      </div>
    </div>
  )
}