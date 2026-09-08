import React, { useState } from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

const LOOKAHEAD_OPTIONS = [
  { value: 1, label: '1 day out' },
  { value: 3, label: '3 days out' },
  { value: 5, label: '5 days out' },
  { value: 7, label: '7 days out' },
];

export default function NotificationsPage({ spots }) {
  const [email, setEmail] = useState('');
  const [spotIds, setSpotIds] = useState([]);
  const [threshold, setThreshold] = useState('good');
  const [lookahead, setLookahead] = useState(3);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function toggleSpot(id) {
    setSpotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllSpots() {
    setSpotIds(spots.map((s) => s.id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!spotIds.length) {
      setError('Select at least one spot to get notified about.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          methods: ['email'],
          spot_ids: spotIds,
          threshold,
          lookahead_days: lookahead,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Submit failed (server said: ${res.status}).`);
      }
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err.message || "Couldn't save your preferences right now \u2014 try again in a moment.");
    }
  }

  const sectionLabel = { fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 8, display: 'block' };

  if (status === 'done') {
    return (
      <div style={ui.page}>
        <h1 className="sg" style={ui.h1}>You're set</h1>
        <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, fontSize: 15 }}>
          You'll hear from us when conditions line up for the spots you picked.
        </p>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <h1 className="sg" style={ui.h1}>Notifications</h1>
      <p style={ui.subtitle}>
        Get told when conditions are lining up, instead of checking the dashboard yourself. We check once a day and
        only email you about genuinely new matches — every notification includes a link to change your spots,
        threshold, or unsubscribe any time.
      </p>

      <form onSubmit={handleSubmit}>
        <label style={ui.label}>
          Email
          <input
            type="email"
            className="uiInput"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={ui.input}
          />
        </label>

        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabel}>Spots</span>
            <button type="button" onClick={selectAllSpots} className="mono" style={{ background: 'none', border: 'none', color: COLORS.teal, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
              select all
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
            {spots.map((s) => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={spotIds.includes(s.id)} onChange={() => toggleSpot(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <span style={sectionLabel}>Notify me for</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name="threshold" checked={threshold === 'good'} onChange={() => setThreshold('good')} />
              Good only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name="threshold" checked={threshold === 'good_and_marginal'} onChange={() => setThreshold('good_and_marginal')} />
              Good & Marginal
            </label>
          </div>
        </div>

        <div style={{ marginTop: 22, marginBottom: 24 }}>
          <span style={sectionLabel}>How far out</span>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {LOOKAHEAD_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" name="lookahead" checked={lookahead === opt.value} onChange={() => setLookahead(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p style={ui.errorText}>{error}</p>}

        <button type="submit" disabled={status === 'submitting'} className="sg btnPrimary" style={ui.buttonPrimary}>
          {status === 'submitting' ? 'Saving\u2026' : 'Save preferences'}
        </button>
      </form>
    </div>
  );
}
