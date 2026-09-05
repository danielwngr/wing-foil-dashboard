import React, { useState, useEffect } from 'react';
import { COLORS } from './theme.js';
import { OFFICIAL_SPOTS } from './spotData.js';
import Dashboard from './Dashboard.jsx';
import AddSpotPage from './AddSpotPage.jsx';
import AboutPage from './AboutPage.jsx';
import AdminPage from './AdminPage.jsx';
import DirectoryPage from './DirectoryPage.jsx';
import NotificationsPage from './NotificationsPage.jsx';

const PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'add', label: 'Add a spot' },
  { key: 'directory', label: 'Directory' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'about', label: 'About' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [communitySpots, setCommunitySpots] = useState([]);

  async function loadCommunitySpots() {
    try {
      const res = await fetch('/api/spots');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setCommunitySpots(data);
    } catch (err) {
      // Quietly ignore -- the curated spots still render fine on their own.
    }
  }

  useEffect(() => {
    loadCommunitySpots();
  }, []);

  const allSpots = [...OFFICIAL_SPOTS, ...communitySpots];

  // Visiting the site with #admin shows the review page without it ever
  // appearing in the public nav.
  const isAdminRoute = typeof window !== 'undefined' && window.location.hash === '#admin';

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: COLORS.paper, minHeight: '100vh', color: COLORS.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .italicPlaceholder::placeholder { font-style: italic; color: #8A97A0; }
        .uiInput { transition: border-color 0.12s ease, box-shadow 0.12s ease; }
        .uiInput:focus {
          outline: none;
          border-color: ${COLORS.teal};
          box-shadow: 0 0 0 3px rgba(44, 110, 127, 0.15);
        }
        .btnPrimary { cursor: pointer; transition: background 0.12s ease; }
        .btnPrimary:hover:not(:disabled) { background: #0F1B27; }
        .btnPrimary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btnPrimary:focus-visible { outline: 2px solid ${COLORS.teal}; outline-offset: 2px; }
      `}</style>

      {!isAdminRoute && (
        <nav style={{ borderBottom: `1px solid ${COLORS.paperLine}`, padding: '16px 24px' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div className="sg" style={{ fontWeight: 700, fontSize: 17 }}>Launch Conditions</div>
            <div style={{ display: 'flex', gap: 24 }}>
              {PAGES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPage(p.key)}
                  className="sg"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: page === p.key ? 700 : 500,
                    color: page === p.key ? COLORS.ink : COLORS.inkSoft,
                    borderBottom: page === p.key ? `2px solid ${COLORS.teal}` : '2px solid transparent',
                    padding: '4px 2px',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {isAdminRoute ? (
        <AdminPage onSpotReviewed={loadCommunitySpots} />
      ) : page === 'dashboard' ? (
        <Dashboard spots={allSpots} />
      ) : page === 'add' ? (
        <AddSpotPage onSubmitted={loadCommunitySpots} />
      ) : page === 'directory' ? (
        <DirectoryPage spots={allSpots} />
      ) : page === 'notifications' ? (
        <NotificationsPage spots={allSpots} />
      ) : (
        <AboutPage />
      )}
    </div>
  );
}
