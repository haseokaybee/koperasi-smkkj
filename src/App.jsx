import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClassesList from './pages/ClassesList' // New Component
import Statistik from './pages/Statistik'

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Route */}
        <Route path="/" element={<Login />} />
        
        {/* Main Administrative Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/classes" element={<ClassesList />} />
        <Route path="/statistik" element={<Statistik />} />
        
        {/* Catch-all route to redirect back to Login if path doesn't exist */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  )
}

export default App