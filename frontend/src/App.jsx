import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import LaunchDetail from './pages/LaunchDetail'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#111827',
              color: '#f0f4ff',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <Navbar />
        <main>
          <Routes>
            <Route path="/"            element={<Home />} />
            <Route path="/login"       element={<Login />} />
            <Route path="/register"    element={<Register />} />
            <Route path="/launch/:api_id" element={<LaunchDetail />} />
            <Route path="/dashboard"   element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}
