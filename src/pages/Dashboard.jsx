import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import './Dashboard.css'
import CounterMoney from './CounterMoney'

export default function Dashboard() {

const handleNavigation = (path) => {
    setMenuOpen(false); // Close mobile menu if open
    navigate(path);
  };


  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Data state
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])

  // Loading states
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)

  // File state
  const [selectedFile, setSelectedFile] = useState(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [newStudent, setNewStudent] = useState({
    name: '',
    gender: 'LELAKI',
    class_id: '',
    member_number: '',
    ic_number: '',
    savings: 0
  })

  // Filters
  const [filterGender, setFilterGender] = useState('All')
  const [filterClass, setFilterClass] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Theme toggle (dark <-> darker)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Mobile hamburger menu
  const [menuOpen, setMenuOpen] = useState(false)

  const isBusy = loadingFetch || loadingUpload || loadingSave

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Close menu when modal opens
  useEffect(() => {
    if (showModal) setMenuOpen(false)
  }, [showModal])

  // Close menu when switching to desktop width
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // --- Auth guard + initial fetch ---
  useEffect(() => {
    const boot = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        navigate('/')
        return
      }
      await fetchData()
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const fetchData = async () => {
    setLoadingFetch(true)
    try {
      const [{ data: studentData, error: sError }, { data: classData, error: cError }] =
        await Promise.all([
          supabase.from('students').select('*').order('name', { ascending: true }),
          supabase.from('classes').select('*').order('name', { ascending: true })
        ])

      if (sError) throw sError
      if (cError) throw cError

      setStudents(studentData || [])
      setClasses(classData || [])
    } catch (err) {
      console.error('Fetch error:', err?.message || err)
      alert('Ralat memuatkan data. Sila cuba lagi.')
    } finally {
      setLoadingFetch(false)
    }
  }

  // Fast class lookup
  const classNameById = useMemo(() => {
    const map = new Map()
    for (const c of classes) map.set(String(c.id), c.name)
    return map
  }, [classes])

  const getClassName = (classId) => {
    if (!classId) return 'N/A'
    return classNameById.get(String(classId)) || 'N/A'
  }

  // --- Logout ---
  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  // --- File handlers ---
  const onFileChange = (e) => {
    if (e.target.files?.length > 0) setSelectedFile(e.target.files[0])
  }

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSelectedFile(null)
  }

  // Helpers
  const normalizeIC = (val) => {
    const s = String(val ?? '').trim()
    if (!s) return null
    return s.replace(/[-\s]/g, '')
  }

  const normalizeMember = (val) => {
    const s = String(val ?? '').trim()
    return s ? s : null
  }

  const normalizeGender = (val) => {
    const g = String(val ?? '').trim().toLowerCase()
    if (g === 'perempuan' || g === 'p' || g === 'female' || g === 'f') return 'PEREMPUAN'
    return 'LELAKI'
  }

  const normalizeSavings = (val) => {
    const n = Number(val)
    return Number.isFinite(n) ? n : 0
  }

  // --- Excel upload ---
  const handleFileUpload = async () => {
    if (!selectedFile) return

    setLoadingUpload(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        const cleanedData = rawData.map((row) => ({
          name: String(row.name || row.NAMA || row.nama || 'Unknown').trim() || 'Unknown',
          gender: normalizeGender(row.gender || row.JANTINA || row.jantina),
          ic_number: normalizeIC(row.ic_number || row.IC || row.ic || row['NO IC']),
          member_number: normalizeMember(row.member_number || row.AHLI || row['NO AHLI']),
          class_id: row.class_id || row.KELAS || row.kelas || null,
          savings: normalizeSavings(row.savings || row.SIMPANAN || row['MODAL SYER'] || 0)
        }))

        // Recommended upsert (needs UNIQUE on ic_number)
        const { error } = await supabase
          .from('students')
          .upsert(cleanedData, { onConflict: 'ic_number' })

        if (error) {
          alert('Ralat Muat Naik: ' + error.message)
        } else {
          alert('Data Berjaya Dimuat Naik!')
          clearFile()
          await fetchData()
        }
      } catch (err) {
        console.error(err)
        alert('Ralat memproses fail Excel.')
      } finally {
        setLoadingUpload(false)
      }
    }

    reader.readAsArrayBuffer(selectedFile)
  }

  // --- Add student ---
  const handleAddStudent = async (e) => {
    e.preventDefault()
    setLoadingSave(true)

    try {
      const payload = {
        name: String(newStudent.name || '').trim(),
        gender: newStudent.gender === 'PEREMPUAN' ? 'PEREMPUAN' : 'LELAKI',
        class_id: newStudent.class_id || null,
        member_number: normalizeMember(newStudent.member_number),
        ic_number: normalizeIC(newStudent.ic_number),
        savings: normalizeSavings(newStudent.savings)
      }

      if (!payload.name) {
        alert('Sila masukkan nama pelajar.')
        return
      }
      if (!payload.class_id) {
        alert('Sila pilih kelas.')
        return
      }

      const { error } = await supabase.from('students').insert([payload])
      if (error) throw error

      setShowModal(false)
      setNewStudent({
        name: '',
        gender: 'LELAKI',
        class_id: '',
        member_number: '',
        ic_number: '',
        savings: 0
      })
      await fetchData()
    } catch (err) {
      console.error('Save error:', err?.message || err)
      alert('Ralat: ' + (err?.message || 'Gagal menyimpan data.'))
    } finally {
      setLoadingSave(false)
    }
  }

  // --- Filter + Search ---
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return students.filter((s) => {
      const matchesGender = filterGender === 'All' ? true : s.gender === filterGender
      const matchesClass = filterClass === 'All' ? true : String(s.class_id ?? '') === String(filterClass)

      if (!q) return matchesGender && matchesClass

      const name = String(s.name || '').toLowerCase()
      const ic = String(s.ic_number || '')
      const member = String(s.member_number || '').toLowerCase()

      const matchesSearch = name.includes(q) || ic.includes(q) || member.includes(q)
      return matchesGender && matchesClass && matchesSearch
    })
  }, [students, filterGender, filterClass, searchQuery])

  // Reset pagination when filters/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterGender, filterClass])

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const indexOfLastRow = safePage * rowsPerPage
  const indexOfFirstRow = indexOfLastRow - rowsPerPage
  const currentRows = filteredStudents.slice(indexOfFirstRow, indexOfLastRow)

  // Stats from filtered data
  const totalFiltered = filteredStudents.length
  const maleCount = filteredStudents.filter((s) => String(s.gender || '').toLowerCase() === 'lelaki').length
  const femaleCount = filteredStudents.filter((s) => String(s.gender || '').toLowerCase() === 'perempuan').length
  const totalSavings = filteredStudents.reduce((acc, s) => acc + (Number(s.savings) || 0), 0)
  const malePercentage = totalFiltered > 0 ? (maleCount / totalFiltered) * 100 : 0

  // Helpers for mobile menu actions (close menu after click)
  const go = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  const openAddStudent = () => {
    setMenuOpen(false)
    setShowModal(true)
  }

  const toggleTheme = () => {
    setTheme((t) => (t === 'darker' ? 'dark' : 'darker'))
  }

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Koperasi SMK Khir Johari</h2>
        </div>

     {/* --- DESKTOP CONTROLS --- */}
        <div className="nav-controls desktop-only">
          <button 
            type="button" 
            onClick={() => handleNavigation('/dashboard')} 
            className="tab-btn active"
          >
            Senarai Pelajar
          </button>

          <button 
            type="button" 
            onClick={() => handleNavigation('/classes')} 
            className="tab-btn"
          >
            Lihat Kelas
          </button>

          <button 
            type="button" 
            onClick={() => setShowModal(true)} 
            className="add-btn"
          >
            + Tambah Pelajar
          </button>

          <button type="button" className="tab-btn" onClick={toggleTheme}>
            {theme === 'darker' ? '🌙 Darker' : '🌑 Dark'}
          </button>

          {/* --- FIXED STATISTIK BUTTON --- */}
          {/* Added distinct style and type="button" */}
          <button 
            type="button" 
            className="tab-btn" 
            style={{ color: '#60a5fa', fontWeight: 'bold' }}
            onClick={(e) => {
              e.preventDefault(); // Prevents page refresh
              handleNavigation('/statistik');
            }}
          >
            📊 Statistik Penuh
          </button>

          <button 
            type="button" 
            onClick={handleLogout} 
            className="logout-btn"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="hamburger mobile-only"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* --- MOBILE DROPDOWN MENU --- */}
      {/* Added the missing Statistik button here */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleNavigation('/dashboard')}>Senarai Pelajar</button>
            <button onClick={() => handleNavigation('/classes')}>Lihat Kelas</button>
            
            {/* NEW BUTTON FOR MOBILE */}
            <button onClick={() => handleNavigation('/statistik')} style={{ color: '#60a5fa' }}>
              📊 Lihat Statistik
            </button>
            
            <button onClick={openAddStudent}>+ Tambah Pelajar</button>
            <button onClick={toggleTheme}>
              Theme: {theme === 'darker' ? 'Darker' : 'Dark'}
            </button>
            <button className="danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}


      

      <div className="content-wrapper">
        <div className="stats-grid">
          <div className="stat-card centered-card">
            <p>Ringkasan Keahlian (Filtered)</p>

            <div className="total-main">
              <h4>
                <CounterMoney value={totalFiltered} prefix="" decimals={0} />
              </h4>
              <span>Jumlah Pelajar</span>
            </div>

            <div className="chart-container-centered">
              <div
                className="modern-pie"
                style={{
                  background:
                    totalFiltered > 0
                      ? `conic-gradient(#3b82f6 0% ${malePercentage}%, #f472b6 ${malePercentage}% 100%)`
                      : 'rgba(255,255,255,0.1)'
                }}
              >
                <div className="pie-hole">
                  <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>
                    {totalFiltered > 0 ? `${Math.round(malePercentage)}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="gender-row-centered">
              <div className="gender-item">
                <span className="dot male"></span>
                <p>
                  Lelaki: <strong style={{ color: '#60a5fa' }}>{maleCount}</strong>
                </p>
              </div>
              <div className="gender-divider"></div>
              <div className="gender-item">
                <span className="dot female"></span>
                <p>
                  Perempuan: <strong style={{ color: '#f472b6' }}>{femaleCount}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card centered-card">
            <p>Jumlah Syer Saham</p>
            <div className="total-main">
              <h3 style={{ color: 'var(--success)' }}>
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
              <input
                type="file"
                accept=".xlsx, .xls"
                ref={fileInputRef}
                onChange={onFileChange}
                className="file-input"
                disabled={loadingUpload}
              />

              {selectedFile && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleFileUpload}
                    className="add-btn"
                    style={{ flex: 1, background: 'var(--success)' }}
                    disabled={loadingUpload}
                  >
                    {loadingUpload ? 'Uploading...' : 'Confirm'}
                  </button>

                  <button
                    onClick={clearFile}
                    className="logout-btn"
                    style={{ flex: 1 }}
                    disabled={loadingUpload}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h4>Tapisan & Carian</h4>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
              <input
                className="search-input"
                style={{ flex: '2' }}
                placeholder="Cari Nama / IC / No. Ahli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="filter-select"
                style={{ flex: '1' }}
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="All">Semua Jantina</option>
                <option value="LELAKI">Lelaki</option>
                <option value="PEREMPUAN">Perempuan</option>
              </select>

              <select
                className="filter-select"
                style={{ flex: '1' }}
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="All">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="table-card">
          {loadingFetch ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div className="loading-spinner"></div>
              <p style={{ marginTop: '10px', opacity: 0.5 }}>Memuatkan data...</p>
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
                      <th>MODAL SYER (RM)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map((student) => (
                        <tr key={student.id}>
                          <td style={{ fontWeight: '600' }}>{student.name}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{student.ic_number || 'N/A'}</span>
                              <small style={{ opacity: 0.5, fontSize: '0.7rem' }}>
                                AHLI: {student.member_number || 'N/A'}
                              </small>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                String(student.gender || '').toLowerCase() === 'lelaki'
                                  ? 'badge-blue'
                                  : 'badge-pink'
                              }`}
                            >
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

              {filteredStudents.length > rowsPerPage && (
                <div className="pagination-controls">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={safePage === 1}
                  >
                    Previous
                  </button>

                  <span className="page-info">
                    Muka Surat <strong>{safePage}</strong> daripada <strong>{totalPages}</strong>
                  </span>

                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={safePage === totalPages}
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
        <div className="modal-overlay" onClick={() => !loadingSave && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>
              Tambah Pelajar Baru
            </h3>

            <form onSubmit={handleAddStudent}>
              <div className="input-group">
                <label>Nama Penuh</label>
                <input
                  required
                  type="text"
                  className="search-input"
                  placeholder="Masukkan nama pelajar"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  disabled={loadingSave}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div className="input-group">
                  <label>No. IC (Tanpa -)</label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="010203040506"
                    value={newStudent.ic_number}
                    onChange={(e) => setNewStudent({ ...newStudent, ic_number: e.target.value })}
                    disabled={loadingSave}
                  />
                </div>

                <div className="input-group">
                  <label>No. Ahli</label>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="K001"
                    value={newStudent.member_number}
                    onChange={(e) => setNewStudent({ ...newStudent, member_number: e.target.value })}
                    disabled={loadingSave}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                <div className="input-group">
                  <label>Jantina</label>
                  <select
                    className="filter-select"
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    disabled={loadingSave}
                  >
                    <option value="LELAKI">Lelaki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Kelas</label>
                  <select
                    required
                    className="filter-select"
                    value={newStudent.class_id}
                    onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })}
                    disabled={loadingSave}
                  >
                    <option value="">Pilih Kelas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: '10px' }}>
                <label>Simpanan Awal (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  className="search-input"
                  placeholder="0.00"
                  value={newStudent.savings}
                  onChange={(e) => setNewStudent({ ...newStudent, savings: Number(e.target.value || 0) })}
                  disabled={loadingSave}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="logout-btn"
                  onClick={() => setShowModal(false)}
                  style={{ margin: 0 }}
                  disabled={loadingSave}
                >
                  Batal
                </button>

                <button type="submit" className="add-btn" style={{ margin: 0 }} disabled={loadingSave}>
                  {loadingSave ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        <p>Hak Cipta Terpelihara &copy; 2026 Koperasi SMK Khir Johari</p>
        {isBusy && <small style={{ opacity: 0.45 }}>Memproses...</small>}
      </footer>
    </div>
  )
}
