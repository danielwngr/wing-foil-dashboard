import React, { useState } from 'react';
import { COLORS } from './theme.js';

export default function AboutPage() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleSubscribe(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), phone: phone.trim() || null }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError("Couldn't sign up right now — try again in a moment.");
    }
  }

  const h2Style = { fontSize: 18, marginTop: 32, marginBottom: 8 };
  const pStyle = { color: COLORS.inkSoft, fontSize: 15 };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 80px', lineHeight: 1.7 }}>
      <h1 className="sg" style={{ fontSize: 26, marginBottom: 8 }}>About this dashboard</h1>
      <p style={pStyle}>
        This tool scores wing foiling launch spots by matching live wind forecasts against the wind directions and speeds each spot actually needs.
      </p>

      <h2 className="sg" style={h2Style}>How to use it</h2>
      <p style={pStyle}>
        Pick a day from the tabs at the top — each one lists which spots have at least two hours of reliably good conditions that day, sorted by how many hours qualify, with the most reliable window shown in parentheses. Click a spot on the map to see its full hourly breakdown: wind speed and gusts, direction, sky, and temperature.
      </p>

      <h2 className="sg" style={h2Style}>What counts as "good"</h2>
      <ul style={{ ...pStyle, paddingLeft: 20 }}>
        <li>Wind direction has to be within the spot's working range — this is a hard requirement, not a preference. Wrong direction always means no-go, regardless of speed.</li>
        <li>13–25 mph sustained wind, in a working direction, counts as Go.</li>
        <li>9–12 mph, 26+ mph, or under 9 mph with gusts over 20 mph counts as Marginal.</li>
        <li>Heavy rain or thunderstorms override everything to No-go.</li>
      </ul>

      <h2 className="sg" style={h2Style}>Data sources</h2>
      <p style={pStyle}>
        Forecasts come from Open-Meteo, a free weather API that blends models from national weather services (NOAA GFS/HRRR, DWD ICON, ECMWF, and others). You can pick a specific forecast source per spot from the dropdown on the dashboard. Wind-direction rules for each launch were sourced from local wind-sport community knowledge where available, and otherwise reflect direct input from spot submitters.
      </p>

      <h2 className="sg" style={h2Style}>Get notified</h2>
      <p style={{ ...pStyle, marginBottom: 16 }}>
        Sign up to get an email when good conditions are coming up. (Text alerts are on the way — leave your number and we'll follow up once that's live.)
      </p>
      {status === 'done' ? (
        <p style={{ color: COLORS.go, fontWeight: 600 }}>You're signed up — thanks!</p>
      ) : (
        <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: '1 1 220px', padding: '9px 10px', border: `1px solid ${COLORS.paperLine}`, borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ flex: '1 1 160px', padding: '9px 10px', border: `1px solid ${COLORS.paperLine}`, borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="sg"
            style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
          >
            {status === 'submitting' ? 'Signing up…' : 'Sign up'}
          </button>
        </form>
      )}
      {error && <p style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
