import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/platform', label: 'Platform' },
  { to: '/detect', label: 'Detect' },
  { to: '/studio', label: 'Studio' },
  { to: '/genomics', label: 'Genomics' },
  { to: '/method', label: 'Method' },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
      transition: 'background .35s, border-color .35s, backdrop-filter .35s',
      background: solid ? 'rgba(5,6,14,0.72)' : 'transparent',
      borderBottom: `1px solid ${solid ? 'var(--line)' : 'transparent'}`,
      backdropFilter: solid ? 'blur(16px)' : 'none',
      WebkitBackdropFilter: solid ? 'blur(16px)' : 'none',
    }}>
      <div className="wrap" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M11 5c0 6 10 6 10 11s-10 5-10 11" stroke="#7C5CFF"
                  strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M21 5c0 6-10 6-10 11s10 5 10 11" stroke="#22D3EE"
                  strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 21, letterSpacing: '-0.01em' }}>
            QGene
          </span>
        </NavLink>

        <nav className="nav-desktop" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              style={({ isActive }) => ({
                padding: '7px 14px', borderRadius: 999, fontSize: 13,
                color: isActive ? 'var(--ink)' : 'var(--ink-dim)',
                background: isActive ? 'var(--panel-strong)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--line)' : 'transparent'}`,
                transition: 'color .2s, background .2s',
              })}>
              {l.label}
            </NavLink>
          ))}
          <a className="btn" href="https://github.com/Arya-Patil686/QGene-Quantum"
             target="_blank" rel="noreferrer"
             style={{ marginLeft: 10, padding: '8px 16px' }}>
            GitHub
          </a>
        </nav>

        <button className="nav-toggle btn" onClick={() => setOpen((v) => !v)}
                aria-label="Toggle navigation" style={{ display: 'none', padding: '8px 14px' }}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="wrap" style={{ paddingBottom: 16 }}>
          <div className="panel" style={{ display: 'grid', gap: 4 }}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} style={{ padding: '10px 8px', fontSize: 15 }}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .nav-desktop { display: none !important; }
          .nav-toggle { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
