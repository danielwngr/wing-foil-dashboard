import React, { useState } from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

export default function AdminPage({ onSpotReviewed }) {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pending', { headers: { 'x-admin-pass': pass } });
      if (res.status === 401) {
        setError('Wrong passphrase.');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setPending(Array.isArray(data) ? data : []);
      setAuthed(true);
    } catch (err) {
      setError("Couldn't reach the admin API right now.");
    }
    setLoading(false);
  }

  async function review(id, action) {
    setError('');
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error('failed');
      setPending((p) => p.filter((s) => s.id !== id));
      if (onSpotReviewed) onSpotReviewed();
    } catch (err) {
      setError("That action didn't go through — try again.");
    }
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
        <h1 className="sg" style={{ fontSize: 20, marginBottom: 16 }}>Admin</h1>
        <form onSubmit={login}>
          <input
            type="password"
            className="uiInput"
            placeholder="Passphrase"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{ ...ui.input, marginBottom: 12 }}
          />
          <button type="submit" disabled={loading} className="sg btnPrimary" style={ui.buttonPrimary}>
            {loading ? 'Checking\u2026' : 'Enter'}
          </button>
          {error && <p style={{ ...ui.errorText, marginTop: 10, marginBottom: 0 }}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <h1 className="sg" style={{ fontSize: 22, marginBottom: 16 }}>Pending spot submissions</h1>
      {pending.length === 0 && <p style={{ color: COLORS.inkSoft }}>Nothing waiting on review.</p>}
      {pending.map((s) => (
        <div key={s.id} style={{ border: `1px solid ${COLORS.paperLine}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
          <div className="mono" style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 4 }}>{s.lat}, {s.lon}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Directions: {JSON.stringify(s.sectors)}</div>
          {s.description && <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>{s.description}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => review(s.id, 'approve')}
              style={{ background: COLORS.go, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Approve
            </button>
            <button
              onClick={() => review(s.id, 'reject')}
              style={{ background: 'none', color: COLORS.inkSoft, border: `1px solid ${COLORS.paperLine}`, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
      {error && <p style={{ ...ui.errorText, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
