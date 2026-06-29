import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import Login from './Login'
import Dashboard from './Dashboard'
import UploadData from './UploadData'
import UserManagement from './UserManagement'
import AdvancedAnalytics from './AdvancedAnalytics'

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    const username = localStorage.getItem('username')
    const permissions = JSON.parse(localStorage.getItem('permissions') || '[]')
    const department = localStorage.getItem('department')
    const clearance_level = localStorage.getItem('clearance_level')
    return token ? { token, role, username, permissions, department, clearance_level } : null
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    const username = localStorage.getItem('username')
    const permissions = JSON.parse(localStorage.getItem('permissions') || '[]')
    const department = localStorage.getItem('department')
    const clearance_level = localStorage.getItem('clearance_level')
    if (token) {
      setUser({ token, role, username, permissions, department, clearance_level })
    }
  }, [])

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} />
          <Route path="/analyze/:id" element={user ? <AdvancedAnalytics user={user} setUser={setUser} /> : <Navigate to="/login" />} />
          <Route path="/upload" element={user && user.permissions.includes('can_upload_data') ? <UploadData user={user} setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/users" element={user && user.permissions.includes('can_manage_users') ? <UserManagement user={user} setUser={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
