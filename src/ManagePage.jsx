import React, { useState, useEffect } from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

const LOOKAHEAD_OPTIONS = [
  { value: 1, label: '1 day out' },
  { value: 3, label: '3 days out' },
  { value: 5, label: '5 days out' },
  { value: 7, label: '7 days out' },
];

export default function ManagePage({ token, spots }) {
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound | error
  const [loadError, setLoadError] = useState('');

  const [spotIds, setSpotIds] = useState([]);
  const [threshold, setThreshold] = useState('good');
  const [lookahead, setLookahead] = useState(3);
  const [email, setEmail] = useState('');

  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | unsubscribed | error
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoadState('error');
      setLoadError('No management link token found.');
      return;
    }
    let cancelled = false;
    fetch(`/api/manage?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setLoadState('notfound');
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Could not load subscription.');
        setEmail(data.email || '');
        setSpotIds(Array.isArray(data.spot_ids) ? data.spot_ids : []);
        setThreshold(data.threshold === 'good_and_marginal' ? 'good_and_marginal' : 'good');
        setLookahead([1, 3, 5, 7].includes(data.lookahead_days) ? data.lookahead_days : 3);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState('error');
        setLoadError(err.message || "Couldn't load your subscription.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function toggleSpot(id) {
    setSpotIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllSpots() {
    setSpotIds(spots.map((s) => s.id));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError('');

    if (!spotIds.length) {
      setSaveError('Select at least one spot to get notified about.');
      return;
    }

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          methods: ['email'],
          spot_ids: spotIds,
          threshold,
          lookahead_days: lookahead,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save changes.');
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err.message || "Couldn't save your changes right now.");
    }
  }

  async function handleUnsubscribe() {
    setSaveError('');
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'unsubscribe' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not unsubscribe.');
      setSaveStatus('unsubscribed');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err.message || "Couldn't unsubscribe right now.");
    }
  }

  const sectionLabel = { fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 8, display: 'block' };

  if (loadState === 'loading') {
    return (
      <div style={ui.page}>
        <p style={{ color: COLORS.inkSoft }}>Loading your subscription…</p>
      </div>
    );
  }

  if (loadState === 'notfound') {
    return (
      <div style={ui.page}>
        <h1 className="sg" style={ui.h1}>Link not found</h1>
        <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, fontSize: 15 }}>
          This management link doesn't match an active subscription — it may already be unsubscribed, or the link may be out of date. Head to the Notifications tab to sign up again.
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={ui.page}>
        <h1 className="sg" style={ui.h1}>Something went wrong</h1>
        <p style={{ color: COLORS.danger, fontSize: 14 }}>{loadError}</p>
      </div>
    );
  }

  if (saveStatus === 'unsubscribed') {
    return (
      <div style={ui.page}>
        <h1 className="sg" style={ui.h1}>You're unsubscribed</h1>
        <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, fontSize: 15 }}>
          {email} won't get any more notifications. Changed your mind? Just sign up again from the Notifications tab any time.
        </p>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <h1 className="sg" style={ui.h1}>Manage your notifications</h1>
      <p style={ui.subtitle}>
        Editing preferences for <strong style={{ color: COLORS.ink }}>{email}</strong>.
      </p>

      <form onSubmit={handleSave}>
        <div style={{ marginTop: 4 }}>
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

        {saveStatus === 'saved' && <p style={{ color: COLORS.go, fontSize: 14, marginBottom: 14 }}>Saved.</p>}
        {saveError && <p style={ui.errorText}>{saveError}</p>}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saveStatus === 'saving'} className="sg btnPrimary" style={ui.buttonPrimary}>
            {saveStatus === 'saving' ? 'Saving\u2026' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={handleUnsubscribe}
            disabled={saveStatus === 'saving'}
            className="mono"
            style={{ background: 'none', border: `1px solid ${COLORS.paperLine}`, color: COLORS.inkSoft, padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Unsubscribe entirely
          </button>
        </div>
      </form>
    </div>
  );
}
