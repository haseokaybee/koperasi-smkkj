import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'
import './Dashboard.css'
import CounterMoney from './CounterMoney'

export default function Dashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const searchInputRef = useRef(null)

  // Data state
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [stats, setStats] = useState({
    totalSavings: 0,
    totalStudents: 0,
    maleCount: 0,
    femaleCount: 0
  })

  // Loading states
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [exporting, setExporting] = useState(false)

  // File state
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
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

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })

  // Refresh indicator
  const [lastUpdated, setLastUpdated] = useState(null)

  // Student actions (edit/delete)
  const [actionStudent, setActionStudent] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isBusy = loadingFetch || loadingUpload || loadingSave

  // Show toast notification
  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }, [])

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

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // --- Auth guard + initial fetch ---
  useEffect(() => {
    const boot = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        showToast('Sila log masuk semula', 'error')
        navigate('/')
        return
      }
      await fetchData()
    }
    boot()
  }, [navigate, showToast])

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
      setLastUpdated(new Date())
      showToast('Data dimuatkan semula', 'success')
    } catch (err) {
      console.error('Fetch error:', err?.message || err)
      showToast('Ralat memuatkan data', 'error')
    } finally {
      setLoadingFetch(false)
    }
  }

  // Calculate statistics
  useEffect(() => {
    if (students.length > 0) {
      const totalSavings = students.reduce((acc, s) => acc + (Number(s.savings) || 0), 0)
      const maleCount = students.filter(s => s.gender === 'LELAKI').length
      const femaleCount = students.filter(s => s.gender === 'PEREMPUAN').length
      
      setStats({
        totalSavings,
        totalStudents: students.length,
        maleCount,
        femaleCount
      })
    }
  }, [students])

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
    try {
      await supabase.auth.signOut()
      showToast('Log keluar berjaya', 'success')
      navigate('/')
    } catch (error) {
      showToast('Ralat log keluar', 'error')
    }
  }

  // --- File handlers ---
  const onFileChange = (e) => {
    if (e.target.files?.length > 0) {
      const file = e.target.files[0]
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showToast('Fail terlalu besar. Sila pilih fail < 10MB', 'error')
        return
      }
      setSelectedFile(file)
    }
  }

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSelectedFile(null)
    setUploadProgress(0)
  }

  // Normalization helpers
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
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }

  // --- Excel upload ---
  const handleFileUpload = async () => {
    if (!selectedFile) return

    setLoadingUpload(true)
    setUploadProgress(0)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        setUploadProgress(30)

        const cleanedData = rawData.map((row, index) => {
          setUploadProgress(30 + (index / rawData.length) * 40)
          return {
            name: String(row.name || row.NAMA || row.nama || 'Unknown').trim() || 'Unknown',
            gender: normalizeGender(row.gender || row.JANTINA || row.jantina),
            ic_number: normalizeIC(row.ic_number || row.IC || row.ic || row['NO IC']),
            member_number: normalizeMember(row.member_number || row.AHLI || row['NO AHLI']),
            class_id: row.class_id || row.KELAS || row.kelas || null,
            savings: normalizeSavings(row.savings || row.SIMPANAN || row['MODAL SYER'] || 0)
          }
        })

        setUploadProgress(80)

        // Use upsert with conflict handling
        const { error } = await supabase
          .from('students')
          .upsert(cleanedData, { onConflict: 'ic_number', ignoreDuplicates: false })

        setUploadProgress(100)

        if (error) {
          throw new Error(error.message)
        } else {
          const importedCount = cleanedData.length
          showToast(`${importedCount} rekod berjaya diimport`, 'success')
          clearFile()
          await fetchData()
        }
      } catch (err) {
        console.error(err)
        showToast(`Ralat: ${err.message}`, 'error')
      } finally {
        setLoadingUpload(false)
        setTimeout(() => setUploadProgress(0), 1000)
      }
    }

    reader.readAsArrayBuffer(selectedFile)
  }

  // --- Add/Edit student ---
  const openEditModal = (student) => {
    setEditingStudent(student)
    setNewStudent({
      name: student.name,
      gender: student.gender,
      class_id: student.class_id,
      member_number: student.member_number || '',
      ic_number: student.ic_number || '',
      savings: student.savings || 0
    })
    setShowModal(true)
  }

  const handleSaveStudent = async (e) => {
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
        showToast('Sila masukkan nama pelajar', 'error')
        return
      }
      if (!payload.class_id) {
        showToast('Sila pilih kelas', 'error')
        return
      }

      let error
      if (editingStudent) {
        // Update existing student
        const { error: updateError } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id)
        error = updateError
      } else {
        // Insert new student
        const { error: insertError } = await supabase.from('students').insert([payload])
        error = insertError
      }

      if (error) throw error

      showToast(editingStudent ? 'Pelajar dikemaskini' : 'Pelajar berjaya ditambah', 'success')
      setShowModal(false)
      setNewStudent({
        name: '',
        gender: 'LELAKI',
        class_id: '',
        member_number: '',
        ic_number: '',
        savings: 0
      })
      setEditingStudent(null)
      await fetchData()
    } catch (err) {
      console.error('Save error:', err?.message || err)
      showToast(`Ralat: ${err.message || 'Gagal menyimpan data'}`, 'error')
    } finally {
      setLoadingSave(false)
    }
  }

  // --- Delete student ---
  const handleDeleteStudent = async () => {
    if (!actionStudent) return

    setLoadingSave(true)
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', actionStudent.id)

      if (error) throw error

      showToast('Pelajar berjaya dipadam', 'success')
      setShowDeleteConfirm(false)
      setActionStudent(null)
      await fetchData()
    } catch (err) {
      console.error('Delete error:', err?.message || err)
      showToast(`Ralat: ${err.message || 'Gagal memadam pelajar'}`, 'error')
    } finally {
      setLoadingSave(false)
    }
  }

  // --- Export to Excel ---
  const handleExport = async () => {
    setExporting(true)
    try {
      const ws = XLSX.utils.json_to_sheet(filteredStudents.map(s => ({
        'Nama': s.name,
        'No. IC': s.ic_number || '',
        'No. Ahli': s.member_number || '',
        'Jantina': s.gender,
        'Kelas': getClassName(s.class_id),
        'Simpanan (RM)': s.savings || 0,
        'Tarikh Daftar': new Date(s.created_at || Date.now()).toLocaleDateString('ms-MY')
      })))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Pelajar')
      XLSX.writeFile(wb, `pelajar-koperasi-${new Date().toISOString().split('T')[0]}.xlsx`)
      
      showToast('Data berjaya dieksport', 'success')
    } catch (err) {
      console.error('Export error:', err)
      showToast('Ralat mengeksport data', 'error')
    } finally {
      setExporting(false)
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
      const ic = String(s.ic_number || '').toLowerCase()
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
  const maleCount = filteredStudents.filter((s) => s.gender === 'LELAKI').length
  const femaleCount = filteredStudents.filter((s) => s.gender === 'PEREMPUAN').length
  const totalSavings = filteredStudents.reduce((acc, s) => acc + (Number(s.savings) || 0), 0)
  const malePercentage = totalFiltered > 0 ? (maleCount / totalFiltered) * 100 : 0

  // Navigation
  const handleNavigation = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  const openAddStudent = () => {
    setMenuOpen(false)
    setEditingStudent(null)
    setNewStudent({
      name: '',
      gender: 'LELAKI',
      class_id: '',
      member_number: '',
      ic_number: '',
      savings: 0
    })
    setShowModal(true)
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'darker' : 'light'
    setTheme(nextTheme)
    const label = nextTheme === 'light' ? 'Cerah' : nextTheme === 'dark' ? 'Gelap' : 'Lebih Gelap'
    showToast(`Tema ditukar kepada ${label}`)
  }

  // Format date
  const formatDate = (date) => {
    if (!date) return 'Belum dikemas kini'
    return new Date(date).toLocaleString('ms-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? 'OK' : toast.type === 'error' ? 'ERR' : 'i'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button 
              className="toast-close" 
              onClick={() => setToast(prev => ({ ...prev, show: false }))}
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !loadingSave && setShowDeleteConfirm(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon">!</div>
            <h3>Padam Pelajar</h3>
            <p>Adakah anda pasti mahu memadam pelajar ini?</p>
            <p className="delete-name">{actionStudent?.name}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="logout-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loadingSave}
              >
                Batal
              </button>
              <button
                type="button"
                className="delete-btn"
                onClick={handleDeleteStudent}
                disabled={loadingSave}
              >
                {loadingSave ? 'Memadam...' : 'Ya, Padam'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-title">
            <i className="fas fa-university" aria-hidden="true"></i>
            <div className="brand-text">
              <h2>Koperasi SMK Khir Johari</h2>
              {lastUpdated && (
                <small className="brand-updated">
                  Kemaskini: {formatDate(lastUpdated)}
                </small>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Controls */}
        <div className="nav-controls desktop-only">
          <button 
            type="button" 
            onClick={() => handleNavigation('/dashboard')} 
            className="tab-btn active"
          >
            <i className="fas fa-users" style={{ marginRight: '8px' }}></i>
            Senarai Pelajar
          </button>

          <button 
            type="button" 
            onClick={() => handleNavigation('/classes')} 
            className="tab-btn"
          >
            <i className="fas fa-chalkboard" style={{ marginRight: '8px' }}></i>
            Kelas
          </button>

          <button 
            type="button" 
            onClick={() => handleNavigation('/statistik')} 
            className="tab-btn statistik-btn"
          >
            <i className="fas fa-chart-pie" style={{ marginRight: '8px' }}></i>
            Statistik
          </button>

          <button 
            type="button" 
            onClick={openAddStudent} 
            className="add-btn"
          >
            <i className="fas fa-user-plus" style={{ marginRight: '8px' }}></i>
            Tambah Pelajar
          </button>

          <button type="button" className="tab-btn theme-btn" onClick={toggleTheme}>
            <i className={theme === 'light' ? 'fas fa-sun' : 'fas fa-moon'}></i>
            {theme === 'light' ? ' Cerah' : theme === 'dark' ? ' Gelap' : ' Lebih Gelap'}
          </button>

          <button 
            type="button" 
            onClick={handleLogout} 
            className="logout-btn"
          >
            <i className="fas fa-sign-out-alt" style={{ marginRight: '8px' }}></i>
            Logout
          </button>
        </div>

       {/* Mobile hamburger - FIXED VERSION */}
<button
  className={`hamburger mobile-only ${menuOpen ? 'active' : ''}`}
  onClick={() => setMenuOpen(!menuOpen)}
  aria-label="Toggle menu"
>
  <span></span>
  <span></span>
  <span></span>
</button>
      </nav>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => handleNavigation('/dashboard')}>
              <i className="fas fa-users"></i> Senarai Pelajar
            </button>
            <button onClick={() => handleNavigation('/classes')}>
              <i className="fas fa-chalkboard"></i> Kelas
            </button>
            <button onClick={() => handleNavigation('/statistik')} className="statistik-btn">
              <i className="fas fa-chart-pie"></i> Statistik
            </button>
            <button onClick={openAddStudent}>
              <i className="fas fa-user-plus"></i> Tambah Pelajar
            </button>
            <button onClick={toggleTheme}>
              <i className="fas fa-palette"></i> Tema: {theme === 'light' ? 'Cerah' : theme === 'dark' ? 'Gelap' : 'Lebih Gelap'}
            </button>
            <button className="danger" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      )}

      <div className="content-wrapper">
        {/* Quick Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <i className="fas fa-users" style={{ color: '#3b82f6' }}></i>
            </div>
            <div className="stat-content">
              <h3><CounterMoney value={stats.totalStudents} prefix="" decimals={0} /></h3>
              <p>Jumlah Ahli</p>
              <small>{stats.maleCount} Lelaki - {stats.femaleCount} Perempuan</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <i className="fas fa-coins" style={{ color: '#22c55e' }}></i>
            </div>
            <div className="stat-content">
              <h3><CounterMoney value={stats.totalSavings} /></h3>
              <p>Jumlah Simpanan</p>
              <small>RM {stats.totalSavings.toLocaleString('ms-MY')}</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
              <i className="fas fa-chart-line" style={{ color: '#f59e0b' }}></i>
            </div>
            <div className="stat-content">
              <h3>{filteredStudents.length}</h3>
              <p>Hasil Tapisan</p>
              <small>{filteredStudents.length} daripada {students.length}</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
              <i className="fas fa-graduation-cap" style={{ color: '#8b5cf6' }}></i>
            </div>
            <div className="stat-content">
              <h3>{classes.length}</h3>
              <p>Jumlah Kelas</p>
              <small>Aktif dalam sistem</small>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="action-grid">
          <div className="card">
            <div className="card-header">
              <h4><i className="fas fa-file-import"></i> Import Excel</h4>
              <button 
                type="button" 
                className="icon-btn"
                onClick={() => document.getElementById('fileInput')?.click()}
                title="Upload file"
              >
                <i className="fas fa-upload"></i>
              </button>
            </div>
            <input
              id="fileInput"
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              onChange={onFileChange}
              className="file-input-hidden"
              disabled={loadingUpload}
            />
            <div className="upload-area">
              {selectedFile ? (
                <>
                  <div className="file-info">
                    <i className="fas fa-file-excel"></i>
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <small>{(selectedFile.size / 1024).toFixed(1)} KB</small>
                    </div>
                  </div>
                  {uploadProgress > 0 && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                  <div className="upload-actions">
                    <button
                      onClick={handleFileUpload}
                      className="add-btn"
                      disabled={loadingUpload}
                    >
                      {loadingUpload ? 'Mengimport...' : 'Import Sekarang'}
                    </button>
                    <button
                      onClick={clearFile}
                      className="logout-btn"
                      disabled={loadingUpload}
                    >
                      Batal
                    </button>
                  </div>
                </>
              ) : (
                <div className="upload-placeholder" onClick={() => document.getElementById('fileInput')?.click()}>
                  <i className="fas fa-cloud-upload-alt"></i>
                  <p>Klik untuk muat naik fail Excel</p>
                  <small>Format: .xlsx, .xls (max 10MB)</small>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4><i className="fas fa-filter"></i> Tapisan & Carian</h4>
              <button 
                type="button" 
                className="icon-btn"
                onClick={() => {
                  setSearchQuery('')
                  setFilterGender('All')
                  setFilterClass('All')
                  showToast('Semua tapisan dibersihkan')
                }}
                title="Clear filters"
              >
                <i className="fas fa-redo"></i>
              </button>
            </div>
            <div className="filter-grid">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari Nama / IC / No. Ahli..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    type="button" 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                  >
                    x
                  </button>
                )}
              </div>
              <select
                className="filter-select"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="All">Semua Jantina</option>
                <option value="LELAKI">Lelaki</option>
                <option value="PEREMPUAN">Perempuan</option>
              </select>
              <select
                className="filter-select"
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
              <button
                type="button"
                className="export-btn"
                onClick={handleExport}
                disabled={exporting || filteredStudents.length === 0}
              >
                {exporting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Mengeksport...
                  </>
                ) : (
                  <>
                    <i className="fas fa-download"></i> Eksport ({filteredStudents.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="table-card">
          <div className="table-header">
            <h3>
              <i className="fas fa-table"></i> Senarai Pelajar
              <span className="record-count">({filteredStudents.length} rekod)</span>
            </h3>
            <button 
              type="button" 
              className="refresh-btn"
              onClick={fetchData}
              disabled={loadingFetch}
            >
              <i className={`fas fa-sync ${loadingFetch ? 'fa-spin' : ''}`}></i>
              {loadingFetch ? 'Memuatkan...' : 'Segarkan'}
            </button>
          </div>

          {loadingFetch ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Memuatkan data pelajar...</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>BIL</th>
                      <th>NAMA</th>
                      <th>IC / AHLI</th>
                      <th>JANTINA</th>
                      <th>KELAS</th>
                      <th>SYER (RM)</th>
                      <th>TINDAKAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map((student, index) => (
                        <tr key={student.id}>
                          <td className="text-muted">{indexOfFirstRow + index + 1}</td>
                          <td>
                            <div className="student-name">
                              <strong>{student.name}</strong>
                              {student.ic_number && (
                                <small>IC: {student.ic_number}</small>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="id-numbers">
                              <div className="ic-number">
                                <i className="fas fa-id-card"></i>
                                {student.ic_number || 'N/A'}
                              </div>
                              <div className="member-number">
                                <i className="fas fa-user-tag"></i>
                                {student.member_number || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`gender-badge gender-${student.gender.toLowerCase()}`}>
                              <i className={`fas fa-${student.gender === 'LELAKI' ? 'mars' : 'venus'}`}></i>
                              {student.gender}
                            </span>
                          </td>
                          <td>
                            <span className="class-tag">
                              <i className="fas fa-chalkboard-teacher"></i>
                              {getClassName(student.class_id)}
                            </span>
                          </td>
                          <td className="savings-cell">
                            <div className="savings-amount">
                              <i className="fas fa-coins"></i>
                              {Number(student.savings || 0).toLocaleString('ms-MY', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="action-btn edit-btn"
                                onClick={() => openEditModal(student)}
                                title="Kemaskini"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                type="button"
                                className="action-btn delete-btn"
                                onClick={() => {
                                  setActionStudent(student)
                                  setShowDeleteConfirm(true)
                                }}
                                title="Padam"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7">
                          <div className="empty-state">
                            <i className="fas fa-user-slash"></i>
                            <p>Tiada pelajar dijumpai</p>
                            <button 
                              type="button" 
                              className="add-btn"
                              onClick={openAddStudent}
                            >
                              <i className="fas fa-user-plus"></i> Tambah Pelajar Pertama
                            </button>
                          </div>
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
                    <i className="fas fa-chevron-left"></i> Sebelumnya
                  </button>

                  <div className="page-info">
                    <span>Muka Surat <strong>{safePage}</strong> daripada <strong>{totalPages}</strong></span>
                    <select
                      className="page-select"
                      value={safePage}
                      onChange={(e) => setCurrentPage(Number(e.target.value))}
                    >
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={safePage === totalPages}
                  >
                    Seterusnya <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !loadingSave && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-user-edit"></i>
                {editingStudent ? 'Kemaskini Pelajar' : 'Tambah Pelajar Baru'}
              </h3>
              <button 
                type="button" 
                className="modal-close"
                onClick={() => setShowModal(false)}
                disabled={loadingSave}
              >
                x
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="form-grid">
                <div className="input-group">
                  <label><i className="fas fa-user"></i> Nama Penuh *</label>
                  <input
                    required
                    type="text"
                    className="form-input"
                    placeholder="Masukkan nama pelajar"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    disabled={loadingSave}
                  />
                </div>

                <div className="input-group">
                  <label><i className="fas fa-id-card"></i> No. IC</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="010203040506"
                    value={newStudent.ic_number}
                    onChange={(e) => setNewStudent({ ...newStudent, ic_number: e.target.value })}
                    disabled={loadingSave}
                  />
                </div>

                <div className="input-group">
                  <label><i className="fas fa-tag"></i> No. Ahli</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="K001"
                    value={newStudent.member_number}
                    onChange={(e) => setNewStudent({ ...newStudent, member_number: e.target.value })}
                    disabled={loadingSave}
                  />
                </div>

                <div className="input-group">
                  <label><i className="fas fa-venus-mars"></i> Jantina</label>
                  <select
                    className="form-select"
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                    disabled={loadingSave}
                  >
                    <option value="LELAKI">Lelaki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </div>

                <div className="input-group">
                  <label><i className="fas fa-chalkboard"></i> Kelas *</label>
                  <select
                    required
                    className="form-select"
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

                <div className="input-group">
                  <label><i className="fas fa-coins"></i> Simpanan Awal (RM)</label>
                  <div className="money-input">
                    <span className="money-prefix">RM</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={newStudent.savings}
                      onChange={(e) => setNewStudent({ ...newStudent, savings: Number(e.target.value || 0) })}
                      disabled={loadingSave}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="logout-btn"
                  onClick={() => setShowModal(false)}
                  disabled={loadingSave}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="add-btn" 
                  disabled={loadingSave}
                >
                  {loadingSave ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Menyimpan...
                    </>
                  ) : editingStudent ? (
                    'Kemaskini'
                  ) : (
                    'Simpan Pelajar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        <div className="footer-content">
          <p>
            <i className="fas fa-copyright"></i> Hak Cipta Terpelihara &copy; {new Date().getFullYear()} Koperasi SMK Khir Johari
          </p>
          <div className="footer-stats">
            {isBusy && <span className="busy-indicator"><i className="fas fa-spinner fa-spin"></i> Memproses...</span>}
            <span className="version">v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
