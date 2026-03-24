const G = '#1B5E20';

export default function PlaceholderPage({ titulo }) {
  return (
    <div style={{ padding: '64px 32px', textAlign: 'center', color: '#aaa' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: G, marginBottom: 8 }}>
        {titulo}
      </div>
      <div style={{ fontSize: '.85rem' }}>Próximamente</div>
    </div>
  );
}
