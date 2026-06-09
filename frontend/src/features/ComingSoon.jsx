export default function ComingSoon({ feature }) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-icon">{feature.icon}</div>
      <div className="coming-soon-title">{feature.label}</div>
      <div className="coming-soon-sub">{feature.description} — coming in a future phase.</div>
      <div className="coming-soon-subs">
        {feature.subOptions.map(s => (
          <div key={s.id} className="coming-soon-pill">{s.icon} {s.label}</div>
        ))}
      </div>
    </div>
  )
}
