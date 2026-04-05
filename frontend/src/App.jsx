import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import LaunchDetail from './pages/LaunchDetail'
import Dashboard from './pages/Dashboard'
import LaunchMap from './pages/LaunchMap'
import Timeline from './pages/Timeline'
import Rockets from './pages/Rockets'
import Stats from './pages/Stats'
import ISS from './pages/ISS'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(10, 17, 40, 0.95)',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '13px',
              backdropFilter: 'blur(12px)',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#f87171', secondary: '#fff' } },
          }}
        />
        <Navbar />
        <main>
          <Routes>
            <Route path="/"               element={<Home />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/register"       element={<Register />} />
            <Route path="/launch/:api_id" element={<LaunchDetail />} />
            <Route path="/map"            element={<LaunchMap />} />
            <Route path="/timeline"       element={<Timeline />} />
            <Route path="/rockets"        element={<Rockets />} />
            <Route path="/stats"          element={<Stats />} />
            <Route path="/iss"            element={<ISS />} />
            <Route path="/dashboard"      element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
          </Routes>
        </main>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  )
}
