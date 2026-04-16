import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Info, Globe as GlobeIcon, Calendar, Rocket, Users } from 'lucide-react'
import { getFlag } from '../utils/getFlag'

export default function CrewModal({ person, onClose }) {
  useEffect(() => {
    if (person) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [person])

  if (!person) return null

  const modalContent = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 10, 24, 0.9)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000, // High z-index to be above navbar
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass fade-up"
        style={{
          maxWidth: 900,
          width: '100%',
          margin: 'auto',
          position: 'relative',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(0,0,0,0.5)', border: 'none',
            color: '#fff', cursor: 'pointer',
            width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, backdropFilter: 'blur(8px)', transition: 'all 0.2s'
          }}
          className="hover-scale"
        >
          <X size={20} style={{ strokeWidth: 3 }} />
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap-reverse', width: '100%' }}>
            <div style={{ flex: '1 1 500px', padding: '48px', minWidth: 0 }}>
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ padding: '4px 10px', background: 'var(--accent-soft)', borderRadius: 6, border: '1px solid var(--accent-glow)' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>Astronaut Profile</span>
                  </div>
                  <span className="badge badge-go" style={{ padding: '4px 10px', fontSize: 11 }}>Active</span>
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: 48, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{person.name}</h2>
                <p style={{ margin: 0, fontSize: 20, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {person.agency?.name || 'Independent Astronaut'}
                </p>
              </div>

              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
                  <Info size={16} style={{ color: 'var(--accent)' }} /> Biography
                </h3>
                <div 
                  className="custom-scrollbar"
                  style={{ 
                    fontSize: 17, 
                    lineHeight: 1.85, 
                    color: 'var(--text-primary)', 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'Inter, system-ui, sans-serif', 
                    opacity: 0.95,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '12px'
                  }}
                >
                  {person.bio || 'No detailed biography available for this mission profile.'}
                </div>
              </div>

              {person.wiki_url && (
                <a 
                  href={person.wiki_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 12, textDecoration: 'none', fontSize: 15, fontWeight: 700, transition: 'all 0.3s ease' }}
                >
                  <GlobeIcon size={18} /> Official Wikipedia Page
                </a>
              )}
            </div>

            <div style={{ flex: '0 0 320px', background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
              {person.profile_image ? (
                <div style={{ width: '100%', height: 380, position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={person.profile_image} 
                    alt={person.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, rgba(5,10,24,1), transparent)' }} />
                </div>
              ) : (
                <div style={{ width: '100%', height: 320, background: 'rgba(0,212,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Users size={80} strokeWidth={1} />
                </div>
              )}
              
              <div style={{ padding: '32px' }}>
                <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>Personal Data</h4>
                {[
                  { label: 'Nationality', value: person.nationality, icon: getFlag(person.nationality) },
                  { label: 'Agency', value: person.agency?.abbrev || person.agency?.name, icon: '🏛️' },
                  { label: 'Craft', value: person.craft, icon: '🚀' },
                  { label: 'Born', value: person.date_of_birth, icon: <Calendar size={14} /> },
                  { label: 'Flights', value: person.flights_count, icon: <Rocket size={14} /> }
                ].map((item, idx) => item.value && (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>{item.icon} {item.label}</span>
                    <span style={{ fontWeight: 700, textAlign: 'right' }}>{item.value}</span>
                  </div>
                ))}
                
                <div style={{ marginTop: 20, padding: '16px', background: 'rgba(0,212,255,0.03)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  Data aggregated from Wikipedia & Launch Library 2 systems.
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
