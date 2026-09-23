
import type React from 'react';

export const navItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
  color: active ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)', textDecoration: 'none', borderRadius: '8px',
  backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'var(--transition-smooth)', cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  border: 'none',
});
