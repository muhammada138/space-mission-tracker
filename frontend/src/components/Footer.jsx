import { Rocket, Github, ExternalLink } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="page-container">
        <div className="footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Rocket size={14} style={{ color: 'var(--accent)' }} />
            <span>Space Mission Tracker</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Built with React + Django</span>
          </div>
          <div className="footer-links">
            <a href="https://thespacedevs.com/llapi" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={12} /> Launch Library 2
            </a>
            <a href="https://github.com/r-spacex/SpaceX-API" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={12} /> SpaceX API
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Github size={12} /> Source
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
