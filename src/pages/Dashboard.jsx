import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import './Dashboard.css';
import CounterMoney from './CounterMoney'; // Add this near your other imports


export default function Dashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [newStudent, setNewStudent] = useState({ 
    name: '', 
    gender: 'Lelaki', 
    class_id: '', 
    member_number: '', 
    ic_number: '', 
    savings: 0 
  })

  // Filters
  const [filterGender, setFilterGender] = useState('All')
  const [filterClass, setFilterClass] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const checkUserAndFetch = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        navigate('/')
        return
      }
      fetchData()
    }
    checkUserAndFetch()
  }, [navigate])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: studentData, error: sError } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true })
      
      if (sError) throw sError
      setStudents(studentData || [])

      const { data: classData, error: cError } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true })

      if (cError) throw cError
      setClasses(classData || [])
    } catch (error) {
      console.error('Error:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const getClassName = (classId) => {
    if (!classId) return 'N/A';
    const foundClass = classes.find(c => c.id.toString() === classId.toString());
    return foundClass ? foundClass.name : 'N/A';
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const onFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
    setSelectedFile(null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const cleanedData = rawData.map(row => ({
          name: row.name || 'Unknown',
          gender: row.gender === 'PEREMPUAN' ? 'PEREMPUAN' : 'LELAKI',
          ic_number: row.ic_number ? row.ic_number.toString().replace(/[- ]/g, '') : null,
          member_number: row.member_number ? row.member_number.toString() : null,
          class_id: row.class_id,
          savings: row.savings ? parseFloat(row.savings) : 0
        }));

        const { error } = await supabase.from('students').insert(cleanedData);
        if (error) {
          alert("Ralat Muat Naik: " + error.message);
        } else {
          alert("Data Berjaya Dimuat Naik!");
          clearFile();
          fetchData();
        }
      } catch (err) {
        alert("Ralat memproses fail Excel.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('students').insert([newStudent])
    if (error) {
      alert("Ralat: " + error.message)
    } else {
      setShowModal(false)
      setNewStudent({ name: '', gender: 'Lelaki', class_id: '', member_number: '', ic_number: '', savings: 0 })
      fetchData()
    }
    setLoading(false)
  }

  // --- FILTER & SEARCH (Core Logic) ---
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesGender = filterGender === 'All' ? true : s.gender === filterGender
      const matchesClass = filterClass === 'All' ? true : s.class_id?.toString() === filterClass
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        s.name?.toLowerCase().includes(query) || 
        s.ic_number?.includes(query) || 
        s.member_number?.toLowerCase().includes(query)
      return matchesGender && matchesClass && matchesSearch
    })
  }, [students, filterGender, filterClass, searchQuery])

  // --- PAGINATION LOGIC ---
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10; // Change this number to show more or fewer rows

  // Reset to page 1 whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterGender, filterClass]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredStudents.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);

  // --- DYNAMIC PIE CHART & STATS (Uses Filtered Data) ---
  const totalFiltered = filteredStudents.length
  const maleCount = filteredStudents.filter(s => s.gender?.toLowerCase() === 'lelaki').length
  const femaleCount = filteredStudents.filter(s => s.gender?.toLowerCase() === 'perempuan').length
  const totalSavings = filteredStudents.reduce((acc, s) => acc + (Number(s.savings) || 0), 0)

  // Calculate percentage for CSS conic-gradient
  const malePercentage = totalFiltered > 0 ? (maleCount / totalFiltered) * 100 : 0

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-brand"><h2>Koperasi SMK Khir Johari</h2></div>
        <div className="nav-controls">
          <button onClick={() => navigate('/dashboard')} className="tab-btn active">Senarai Pelajar</button>
          <button onClick={() => navigate('/classes')} className="tab-btn">Lihat Kelas</button>
          <button onClick={() => setShowModal(true)} className="add-btn">+ Tambah Pelajar</button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="content-wrapper">
        <div className="stats-grid">
          {/* UPDATED PIE CHART CARD */}
          <div className="stat-card centered-card">
            <p>Ringkasan Keahlian (Filtered)</p>
            <div className="total-main">
              <h4><CounterMoney value={totalFiltered} prefix="" /></h4>
              <span>Jumlah Pelajar</span>
            </div>
            <div className="chart-container-centered">
              <div 
                className="modern-pie" 
                style={{ 
                  background: totalFiltered > 0 
                    ? `conic-gradient(#3b82f6 0% ${malePercentage}%, #f472b6 ${malePercentage}% 100%)`
                    : 'rgba(255,255,255,0.1)' 
                }}
              >
                <div className="pie-hole">
                   <span style={{fontSize: '0.75rem', fontWeight: '800'}}>
                     {totalFiltered > 0 ? `${Math.round(malePercentage)}%` : '0%'}
                   </span>
                </div>
              </div>
            </div>
            <div className="gender-row-centered">
              <div className="gender-item">
                <span className="dot male"></span>
                <p>Lelaki: <strong style={{color: '#60a5fa'}}>{maleCount}</strong></p>
              </div>
              <div className="gender-divider"></div>
              <div className="gender-item">
                <span className="dot female"></span>
                <p>Perempuan: <strong style={{color: '#f472b6'}}>{femaleCount}</strong></p>
              </div>
            </div>
          </div>

          <div className="stat-card centered-card">
            <p>Jumlah Syer Saham</p>
            <div className="total-main">
             <h3 style={{ color: 'var(--success)'  }}>
  <CounterMoney value={totalSavings} />
</h3>
              <span>Terkumpul</span>
            </div>
            <div style={{ marginTop: '20px', opacity: 0.5, fontSize: '0.8rem' }}>
              Sesi Persekolahan 2026
            </div>
          </div>
        </div>

        <div className="action-grid">
          <div className="card">
            <h4>Import Data (Excel)</h4>
            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={onFileChange} className="file-input" />
              {selectedFile && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleFileUpload} className="add-btn" style={{ flex: 1, background: 'var(--success)' }}>Confirm</button>
                  <button onClick={clearFile} className="logout-btn" style={{ flex: 1 }}>Clear</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="card">
            <h4>Tapisan & Carian</h4>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
              <input
                className="search-input"
                style={{flex: '2'}}
                placeholder="Cari Nama / IC / No. Ahli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              <select className="filter-select" style={{flex: '1'}} value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                <option value="All">Semua Jantina</option>
                <option value="LELAKI">Lelaki</option>
                <option value="PEREMPUAN">Perempuan</option>
              </select>

              <select className="filter-select" style={{flex: '1'}} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                <option value="All">Semua Kelas</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="table-card">
          {loading ? (
            <div style={{padding: '60px', textAlign: 'center'}}>
               <div className="loading-spinner"></div>
               <p style={{marginTop: '10px', opacity: 0.5}}>Memuatkan data...</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>NAMA</th>
                      <th>IC / AHLI</th>
                      <th>JANTINA</th>
                      <th>KELAS</th>
                      <th>SIMPANAN (RM)</th>
                    </tr>
                  </thead>

                  {/* ✅ UPDATED TBODY to use currentRows */}
                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map(student => (
                        <tr key={student.id}>
                          <td style={{fontWeight: '600'}}>{student.name}</td>
                          <td>
                            <div style={{display: 'flex', flexDirection: 'column'}}>
                              <span>{student.ic_number || 'N/A'}</span>
                              <small style={{opacity: 0.5, fontSize: '0.7rem'}}>AHLI: {student.member_number}</small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${student.gender?.toLowerCase() === 'lelaki' ? 'badge-blue' : 'badge-pink'}`}>
                              {student.gender}
                            </span>
                          </td>
                          <td>{getClassName(student.class_id)}</td>
                          <td style={{ fontWeight: '700', color: 'var(--success)' }}>
                            {Number(student.savings || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
                          Tiada data pelajar dijumpai.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ✅ PAGINATION CONTROLS */}
              {filteredStudents.length > rowsPerPage && (
                <div className="pagination-controls">
                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  
                  <span className="page-info">
                    Muka Surat <strong>{currentPage}</strong> daripada <strong>{totalPages}</strong>
                  </span>

                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{fontFamily: 'var(--font-heading)', marginBottom: '20px'}}>Tambah Pelajar Baru</h3>
            <form onSubmit={handleAddStudent}>
              <div className="input-group">
                <label>Nama Penuh</label>
                <input required type="text" className="search-input" placeholder="Masukkan nama pelajar" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div className="input-group">
                  <label>No. IC (Tanpa -)</label>
                  <input type="text" className="search-input" placeholder="010203040506" value={newStudent.ic_number} onChange={(e) => setNewStudent({...newStudent, ic_number: e.target.value})} />
                </div>
                <div className="input-group">
                  <label>No. Ahli</label>
                  <input type="text" className="search-input" placeholder="K001" value={newStudent.member_number} onChange={(e) => setNewStudent({...newStudent, member_number: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div className="input-group">
                  <label>Jantina</label>
                  <select className="filter-select" value={newStudent.gender} onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}>
                    <option value="LELAKI">Lelaki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Kelas</label>
                  <select required className="filter-select" value={newStudent.class_id} onChange={(e) => setNewStudent({...newStudent, class_id: e.target.value})}>
                    <option value="">Pilih Kelas</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-group" style={{marginTop: '10px'}}>
                <label>Simpanan Awal (RM)</label>
                <input type="number" step="0.01" className="search-input" placeholder="0.00" value={newStudent.savings} onChange={(e) => setNewStudent({...newStudent, savings: e.target.value})} />
              </div>

              <div className="modal-actions">
                <button type="button" className="logout-btn" onClick={() => setShowModal(false)} style={{margin: 0}}>Batal</button>
                <button type="submit" className="add-btn" disabled={loading} style={{margin: 0}}>
                  {loading ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-container">
        {/* ... Semua konten Navbar, Stats, Action Grid, dan Table Card ada di sini ... */}

        <footer className="dashboard-footer">
          <p>Hak Cipta Terpelihara &copy; 2026 Koperasi SMK Khir Johari</p>
        </footer>
      </div>
    </div>
  )
}
