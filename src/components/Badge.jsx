export default function Badge({ label, bg, color, style }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 100,
      fontSize: '.72rem', fontWeight: 700, background: bg || '#E8F5E9',
      color: color || '#1B5E20', letterSpacing: '.03em', ...style,
    }}>
      {label}
    </span>
  );
}
