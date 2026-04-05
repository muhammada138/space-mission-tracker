export default function SkeletonCard() {
  return (
    <div className="skeleton-card fade-up">
      <div className="skeleton skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line-sm" />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <div className="skeleton" style={{ width: 46, height: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 46, height: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 46, height: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 46, height: 36, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}
