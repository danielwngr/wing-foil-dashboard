import React, { useState } from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';
import { sectorsToLabel } from './compass.js';

export default function AdminPage({ onSpotReviewed }) {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState([]);
  const [debugAllRows, setDebugAllRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState('idle'); // idle | sending | sent | error
  const [testError, setTestError] = useState('');

  async function sendTestEmail(e) {
    e.preventDefault();
    setTestError('');
    setTestStatus('sending');
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send test email.');
      setTestStatus('sent');
    } catch (err) {
      setTestStatus('error');
      setTestError(err.message || "Couldn't send the test email.");
    }
  }

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
      setPending(Array.isArray(data.pending) ? data.pending : []);
      setDebugAllRows(data.debugAllRows ?? null);
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
          <div style={{ fontSize: 13, marginTop: 6 }}>Directions: {sectorsToLabel(s.sectors)}</div>
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

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${COLORS.paperLine}` }}>
        <div className="sg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Send a test notification email</div>
        <p style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 12 }}>
          Sends a realistic sample email with fabricated conditions, subject prefixed with [TEST]. Doesn't touch real subscriber data.
        </p>
        <form onSubmit={sendTestEmail} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
            type="email"
            className="uiInput"
            placeholder="you@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            style={{ ...ui.input, maxWidth: 280 }}
          />
          <button type="submit" disabled={testStatus === 'sending' || !testEmail.trim()} className="sg btnPrimary" style={ui.buttonPrimary}>
            {testStatus === 'sending' ? 'Sending\u2026' : 'Send test email'}
          </button>
        </form>
        {testStatus === 'sent' && <p style={{ color: COLORS.go, fontSize: 13, marginTop: 8 }}>Sent — check your inbox.</p>}
        {testError && <p style={{ ...ui.errorText, marginTop: 8 }}>{testError}</p>}
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${COLORS.paperLine}` }}>
        <div className="sg" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: COLORS.inkSoft }}>
          Debug: last 20 rows our server sees (any status)
        </div>
        <pre
          className="mono"
          style={{
            fontSize: 11,
            background: COLORS.surface,
            border: `1px solid ${COLORS.paperLine}`,
            borderRadius: 6,
            padding: 12,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(debugAllRows, null, 2)}
        </pre>
      </div>
    </div>
  );
}
