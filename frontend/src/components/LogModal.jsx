import { useState } from 'react'
import { X } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function LogModal({ launch, existingLog = null, onClose, onSaved }) {
  const [title, setTitle] = useState(existingLog?.title || '')
  const [body, setBody] = useState(existingLog?.body || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return toast.error('Fill in both fields')
    setSaving(true)
    try {
      if (existingLog) {
        const { data } = await api.put(`/watchlist/logs/${existingLog.id}/`, { title, body, launch_api_id: launch.api_id })
        toast.success('Log updated!')
        onSaved(data)
      } else {
        const { data } = await api.post('/watchlist/logs/', { title, body, launch_api_id: launch.api_id })
        toast.success('Log saved!')
        onSaved(data)
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save log')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {existingLog ? 'Edit Log' : 'New Mission Log'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          {launch.name}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Watched the launch live!"
              maxLength={256}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>Notes</label>
            <textarea
              className="input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your thoughts, observations, or anything about this mission..."
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : existingLog ? 'Update Log' : 'Save Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
