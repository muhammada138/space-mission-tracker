import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import LaunchDetail from './pages/LaunchDetail'
import Dashboard from './pages/Dashboard'
import Spaceports from './pages/Spaceports'
import Timeline from './pages/Timeline'
import Rockets from './pages/Rockets'
import Stats from './pages/Stats'
import ISS from './pages/ISS'
import Astronauts from './pages/Astronauts'
import LiveMission from './pages/LiveMission'
import LaunchMap from './pages/LaunchMap'

// Scroll to top on route change
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])
  return null
}

// Animated page wrapper using CSS View Transitions API
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <main key={location.pathname}>
      <ScrollReset />
      <Routes location={location}>
        <Route path="/"                   element={<Home tab="upcoming" />} />
        <Route path="/launches"           element={<Home tab="upcoming" />} />
        <Route path="/launches/upcoming"  element={<Home tab="upcoming" />} />
        <Route path="/launches/active"    element={<Home tab="active" />} />
        <Route path="/launches/past"      element={<Home tab="past" />} />
        <Route path="/login"              element={<Login />} />
        <Route path="/register"           element={<Register />} />
        <Route path="/launch/:api_id"     element={<LaunchDetail />} />
        <Route path="/map"                element={<LaunchMap />} />
        <Route path="/spaceports"         element={<Spaceports />} />
        <Route path="/timeline"           element={<Timeline />} />
        <Route path="/rockets"            element={<Rockets />} />
        <Route path="/stats"              element={<Stats />} />
        <Route path="/iss"                element={<ISS />} />
        <Route path="/astronauts"         element={<Astronauts />} />
        <Route path="/live/:id"           element={<LiveMission />} />
        <Route path="/dashboard"          element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
      </Routes>
    </main>
  )
}

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
        <AnimatedRoutes />
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  )
}
