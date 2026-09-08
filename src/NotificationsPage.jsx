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
  const [phone, setPhone] = useState('');
  const [methods, setMethods] = useState(['email']);
  const [spotIds, setSpotIds] = useState([]);
  const [threshold, setThreshold] = useState('good');
  const [lookahead, setLookahead] = useState(3);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function toggleMethod(m) {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

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
    if (!methods.length) {
      setError('Pick at least one notification method.');
      return;
    }
    if (methods.includes('text') && !phone.trim()) {
      setError('Enter a phone number for text alerts, or uncheck that method.');
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
          phone: phone.trim() || null,
          methods,
          spot_ids: spotIds,
          threshold,
          lookahead_days: lookahead,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError("Couldn't save your preferences right now \u2014 try again in a moment.");
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
        Get told when conditions are lining up, instead of checking the dashboard yourself. Sending isn't wired up
        yet — this saves your preferences now so it's ready the moment it is.
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

        <span style={sectionLabel}>Method</span>
        <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
          {['email', 'text'].map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
              {m === 'email' ? 'Email' : 'Text'}
            </label>
          ))}
        </div>
        {methods.includes('text') && (
          <input
            type="tel"
            className="uiInput"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            style={{ ...ui.input, marginTop: 8, marginBottom: 8 }}
          />
        )}

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
