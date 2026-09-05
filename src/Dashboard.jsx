import React, { useState, useMemo, useEffect } from 'react';
import { Sun, Cloud, CloudRain, MapPin, Info, AlertTriangle, ArrowUp } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS } from './theme.js';

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const NUM_DAYS = 7;
const CHART_MIN_SCALE_MPH = 30;
const BAR_AREA_HEIGHT = 210;
const AXIS_WIDTH = 26;
const TICK_STEP = 5;

function mulberry32(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inSector(dir, sectors) {
  return sectors.some(([a, b]) => (a <= b ? dir >= a && dir <= b : dir >= a || dir <= b));
}

// Global sustained-wind (mph) thresholds, same across every spot:
//   12-28 mph sustained -> good
//   9-11 mph, or 29+ mph sustained -> marginal
//   under 9 mph sustained, but gusts over 20 mph -> marginal
//   under 9 mph sustained with calmer gusts -> none
// Wind direction is the gating condition: wrong direction is always 'none'
// regardless of speed.
function scoreHour(spot, hour) {
  const inDir = inSector(hour.dir, spot.sectors);
  if (!inDir) return 'none';
  if (hour.rain > 60) return 'none';

  const speed = hour.speed;
  if (speed >= 12 && speed <= 28) return 'good';
  if (speed >= 9 && speed <= 11) return 'marginal';
  if (speed >= 29) return 'marginal';
  if (hour.gust > 20) return 'marginal';
  return 'none';
}

function dayMeta(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  return { weekday, monthDay, isToday: offset === 0 };
}

function generateForecast() {
  const rand = mulberry32(42);
  return Array.from({ length: NUM_DAYS }).map((_, di) => {
    const baseDir = Math.floor(rand() * 360);
    const baseSpeed = 5 + rand() * 26;
    const baseTemp = 62 + rand() * 20;
    const hours = HOURS.map((h) => {
      const dir = Math.round((baseDir + (rand() - 0.5) * 60 + 360) % 360);
      const speed = Math.max(4, Math.round(baseSpeed + (rand() - 0.5) * 10 + Math.sin((h / 24) * Math.PI) * 4));
      const gust = Math.round(speed * (1.15 + rand() * 0.35));
      const rain = rand() < 0.15 ? Math.floor(rand() * 100) : 0;
      const sky = rain > 40 ? 'rain' : rand() < 0.35 ? 'cloud' : 'sun';
      const temp = Math.round(baseTemp + Math.sin(((h - 6) / 14) * Math.PI) * 8 + (rand() - 0.5) * 3);
      return { hour: h, dir, speed, gust, rain, sky, temp };
    });
    return { ...dayMeta(di), hours };
  });
}

// Finds the longest unbroken run of 'good' hours, so a fluctuating on/off
// stretch of wind doesn't get reported as one long (misleading) window.
function longestGoodStreak(scored) {
  let best = null;
  let curStart = null;
  for (let i = 0; i <= scored.length; i++) {
    const isGood = i < scored.length && scored[i].score === 'good';
    if (isGood) {
      if (curStart === null) curStart = i;
    } else if (curStart !== null) {
      const len = i - curStart;
      if (!best || len > best.len) best = { startIdx: curStart, endIdx: i - 1, len };
      curStart = null;
    }
  }
  return best;
}

function dayScoreForSpot(spot, day) {
  const rank = { good: 2, marginal: 1, none: 0 };
  const scored = day.hours.map((h) => ({ ...h, score: scoreHour(spot, h) }));
  const overall = scored.some((h) => h.score === 'good')
    ? 'good'
    : scored.some((h) => h.score === 'marginal')
    ? 'marginal'
    : 'none';
  const goodHourCount = scored.filter((h) => h.score === 'good').length;
  const streak = longestGoodStreak(scored);
  const window = streak
    ? `${scored[streak.startIdx].hour}:00\u2013${scored[streak.endIdx].hour + 1}:00`
    : null;
  const bestHour = scored.reduce((acc, h) => (rank[h.score] > rank[acc.score] ? h : acc), scored[0]);
  return { overall, scored, window, goodHourCount, bestHour };
}

// --- Live forecast loading (Open-Meteo, free, no API key) ---

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// WMO weather codes, collapsed down to the three sky states this UI shows.
function weatherCodeToSky(code) {
  if (code === 0) return 'sun';
  if ([1, 2, 3, 45, 48].includes(code)) return 'cloud';
  return 'rain';
}

// Only heavy rain / thunderstorms count as a hard no-go via the existing rain gate.
function weatherCodeToRainFlag(code) {
  return [65, 67, 82, 95, 96, 99].includes(code);
}

function buildDaysFromHourly(hourly) {
  const byDate = {};
  hourly.time.forEach((t, i) => {
    const [datePart, timePart] = t.split('T');
    const hourNum = parseInt(timePart.slice(0, 2), 10);
    if (!HOURS.includes(hourNum)) return;
    if (!byDate[datePart]) byDate[datePart] = [];
    byDate[datePart].push({
      hour: hourNum,
      dir: Math.round(hourly.winddirection_10m[i]),
      speed: Math.round(hourly.windspeed_10m[i]),
      gust: Math.round(hourly.windgusts_10m[i]),
      temp: Math.round(hourly.temperature_2m[i]),
      sky: weatherCodeToSky(hourly.weathercode[i]),
      rain: weatherCodeToRainFlag(hourly.weathercode[i]) ? 100 : 0,
    });
  });

  return Array.from({ length: NUM_DAYS }).map((_, offset) => {
    const meta = dayMeta(offset);
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const hours = (byDate[localDateKey(d)] || []).sort((a, b) => a.hour - b.hour);
    return { ...meta, hours };
  });
}

// Selectable forecast sources. 'best_match' omits the models param entirely
// (Open-Meteo's own auto-selection). For Minnesota/Wisconsin coordinates this
// is very likely equivalent to gfs_seamless, since Open-Meteo's NOAA endpoint
// already blends HRRR into GFS for any US location - icon_seamless and
// ecmwf_ifs025 are included because they're independent global models (German
// and European respectively) and give a genuinely different second opinion.
const MODEL_OPTIONS = [
  { key: 'best_match', label: 'Best match (auto)' },
  { key: 'gfs_seamless', label: 'NOAA GFS + HRRR' },
  { key: 'ncep_hrrr_conus', label: 'NOAA HRRR only (~2 day range)' },
  { key: 'icon_seamless', label: 'DWD ICON (Germany)' },
  { key: 'ecmwf_ifs025', label: 'ECMWF IFS' },
];

async function fetchSpotForecast(spot, modelKey) {
  const modelParam = modelKey && modelKey !== 'best_match' ? `&models=${modelKey}` : '';
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=temperature_2m,windspeed_10m,winddirection_10m,windgusts_10m,weathercode` +
    `&windspeed_unit=mph&temperature_unit=fahrenheit&timezone=auto&forecast_days=9${modelParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast request failed (${res.status})`);
  const data = await res.json();
  return buildDaysFromHourly(data.hourly);
}

const scoreColor = (s) => (s === 'good' ? COLORS.go : s === 'marginal' ? COLORS.caution : COLORS.no);
const scoreLabel = (s) => (s === 'good' ? 'Go' : s === 'marginal' ? 'Marginal' : 'No go');
const directionColor = (dir, sectors) => (inSector(dir, sectors) ? COLORS.go : COLORS.caution);

function SkyIcon({ sky, size = 14 }) {
  if (sky === 'rain') return <CloudRain size={size} color={COLORS.teal} />;
  if (sky === 'cloud') return <Cloud size={size} color={COLORS.inkSoft} />;
  return <Sun size={size} color="#C98A3B" />;
}

// Fits the map view to show every spot on first render; user's own pan/zoom
// afterward is left alone since this only runs once (empty effect deps beyond points).
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      map.fitBounds(points, { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function Dashboard({ spots }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [selected, setSelected] = useState(spots[0]?.id);
  const [forecastBySpot, setForecastBySpot] = useState({});
  const [loading, setLoading] = useState(true);
  const [fallbackIds, setFallbackIds] = useState(new Set());
  const [modelPref, setModelPref] = useState({});

  // If the spot list grows (community spot approved) after mount and nothing
  // is selected yet, default to the first one.
  useEffect(() => {
    if (!selected && spots.length) setSelected(spots[0].id);
  }, [spots, selected]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      const fallback = new Set();
      const entries = await Promise.all(
        spots.map(async (s) => {
          try {
            return [s.id, await fetchSpotForecast(s, modelPref[s.id] || 'best_match')];
          } catch (err) {
            fallback.add(s.id);
            return [s.id, generateForecast()];
          }
        })
      );
      if (cancelled) return;
      setForecastBySpot(Object.fromEntries(entries));
      setFallbackIds(fallback);
      setLoading(false);
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [spots, modelPref]);

  const dayMetaList = useMemo(() => Array.from({ length: NUM_DAYS }, (_, i) => dayMeta(i)), []);

  const spotScores = useMemo(() => {
    const out = {};
    spots.forEach((s) => {
      const days = forecastBySpot[s.id];
      out[s.id] = days && days[dayIdx] ? dayScoreForSpot(s, days[dayIdx]) : null;
    });
    return out;
  }, [spots, forecastBySpot, dayIdx]);

  const activeSpot = spots.find((s) => s.id === selected);
  const activeScore = activeSpot ? spotScores[selected] : null;
  const activeIsFallback = fallbackIds.has(selected);

  if (!activeSpot) {
    return <div style={{ padding: 40, color: COLORS.inkSoft }}>No spots yet.</div>;
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 40px' }}>
      <style>{`
        .leaflet-container { font-family: 'IBM Plex Mono', monospace; background: ${COLORS.paper}; }
        .spotTooltip {
          background: ${COLORS.paper} !important;
          border: 1px solid ${COLORS.paperLine} !important;
          border-radius: 0 !important;
          color: ${COLORS.ink} !important;
          font-size: 10px !important;
          font-family: 'IBM Plex Mono', monospace !important;
          padding: 1px 4px !important;
          box-shadow: none !important;
        }
        .spotTooltip::before { display: none !important; }
        .leaflet-popup-content-wrapper.spotPopup {
          background: ${COLORS.paper};
          border: 1px solid ${COLORS.paperLine};
          border-radius: 4px;
          color: ${COLORS.ink};
          font-family: 'IBM Plex Sans', sans-serif;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .leaflet-popup-content { margin: 10px 12px; }
        .leaflet-popup-tip { background: ${COLORS.paper}; }
        .dayTab { cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, borderBottom: `2px solid ${COLORS.ink}`, paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <h1 className="sg" style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Launch Conditions
          </h1>
          <p style={{ margin: '6px 0 0', color: COLORS.inkSoft, fontSize: 14 }}>
            Wing foiling forecast across your spots, five days out.
          </p>
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, border: `1px solid ${COLORS.paperLine}`, padding: '5px 10px', color: COLORS.inkSoft, whiteSpace: 'nowrap' }}
        >
          {loading ? 'loading live forecast' : fallbackIds.size > 0 ? 'live forecast, sample fallback for some spots' : 'live forecast, Open-Meteo'}
        </div>
      </div>

      {/* Day tabs: horizontal row with dates, plus which spots look good that day */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${COLORS.paperLine}` }}>
        {dayMetaList.map((d, i) => {
          const goodSpots = spots.map((s) => {
            const days = forecastBySpot[s.id];
            if (!days || !days[i]) return null;
            const sc = dayScoreForSpot(s, days[i]);
            return sc.goodHourCount >= 2 ? { name: s.name, window: sc.window, count: sc.goodHourCount } : null;
          })
            .filter(Boolean)
            .sort((a, b) => b.count - a.count);
          const active = i === dayIdx;
          return (
            <button
              key={i}
              className="dayTab sg"
              onClick={() => setDayIdx(i)}
              style={{
                flex: 1,
                background: active ? COLORS.ink : 'transparent',
                color: active ? '#fff' : COLORS.inkSoft,
                border: 'none',
                borderBottom: `3px solid ${active ? COLORS.teal : 'transparent'}`,
                padding: '10px 6px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.isToday ? 'Today' : d.weekday}</span>
              <span className="mono" style={{ fontSize: 11, opacity: 0.85 }}>{d.monthDay}</span>
              {i >= 3 && (
                <span className="mono" style={{ fontSize: 8, color: active ? 'rgba(255,255,255,0.6)' : COLORS.caution }} title="Forecast skill drops off past a few days out">
                  lower confidence
                </span>
              )}
              <div className="mono" style={{ fontSize: 9.5, lineHeight: 1.45, textAlign: 'center' }}>
                {goodSpots.length ? (
                  goodSpots.map((g) => (
                    <div key={g.name} style={{ color: active ? '#fff' : COLORS.go, fontWeight: 600 }}>
                      {g.name} <span style={{ opacity: 0.75, fontWeight: 400 }}>({g.window})</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: active ? 'rgba(255,255,255,0.5)' : COLORS.paperLine }}>{'\u2014'}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected spot summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="sg" style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={17} color={COLORS.teal} />
            {activeSpot.name}
          </h2>
          {activeScore && (
            <span
              style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: scoreColor(activeScore.overall), padding: '3px 9px' }}
            >
              {scoreLabel(activeScore.overall)}
            </span>
          )}
          {activeScore && activeScore.window && (
            <span style={{ fontSize: 13, color: COLORS.inkSoft }}>
              best window <strong className="mono" style={{ color: COLORS.ink }}>{activeScore.window}</strong>
            </span>
          )}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: COLORS.inkSoft }}>
          Forecast source
          <select
            className="mono uiInput"
            value={modelPref[selected] || 'best_match'}
            onChange={(e) => setModelPref((prev) => ({ ...prev, [selected]: e.target.value }))}
            style={{ fontSize: 11, padding: '5px 6px', border: `1px solid ${COLORS.paperLine}`, background: COLORS.paper, color: COLORS.ink }}
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>
      {activeSpot.description && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 }}>
          <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0, color: COLORS.caution }} />
          <span>{activeSpot.description}</span>
        </div>
      )}
      {activeIsFallback && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: COLORS.inkSoft, marginBottom: 18 }}>
          <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0, color: COLORS.caution }} />
          <span>Live forecast wasn't reachable for this spot — showing sample data instead.</span>
        </div>
      )}

      {/* Map (moved above the chart) */}
      <div
        style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', border: `1px solid ${COLORS.paperLine}`, background: COLORS.paper, overflow: 'hidden', marginTop: activeSpot.description || activeIsFallback ? 0 : 18, marginBottom: 24 }}
      >
        <MapContainer center={[45.6, -93]} zoom={7} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={spots.map((s) => [s.lat, s.lon])} />
          {[...spots]
            .sort((a, b) => {
              const rank = { good: 2, marginal: 1, none: 0 };
              const ra = spotScores[a.id] ? rank[spotScores[a.id].overall] : -1;
              const rb = spotScores[b.id] ? rank[spotScores[b.id].overall] : -1;
              return ra - rb; // ascending: best status rendered last (on top)
            })
            .map((s) => {
            const sc = spotScores[s.id];
            const isActive = s.id === selected;
            const dotColor = sc ? scoreColor(sc.overall) : COLORS.paperLine;
            return (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lon]}
                radius={isActive ? 11 : 9}
                pathOptions={{
                  color: isActive ? COLORS.ink : COLORS.paper,
                  weight: isActive ? 3 : 2,
                  fillColor: dotColor,
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => setSelected(s.id) }}
              >
                <Tooltip permanent direction="top" offset={[0, -10]} className="spotTooltip">
                  {s.name}
                </Tooltip>
                <Popup className="spotPopup">
                  <div className="sg" style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.name}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 220 }}>
                    {s.description || 'No launch description yet.'}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Hourly wind chart: mph scale, speed + gust bars, direction arrows, sky + temp below */}
      <div style={{ border: `1px solid ${COLORS.paperLine}`, borderRadius: 6, padding: '16px 14px 14px', marginBottom: 24, overflowX: 'auto', overflowY: 'visible' }}>
        {!activeScore ? (
          <div style={{ height: BAR_AREA_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.inkSoft, fontSize: 13 }}>
            Loading live forecast…
          </div>
        ) : (
          (() => {
            const rawMax = Math.max(...activeScore.scored.flatMap((h) => [h.speed, h.gust]));
            const scaleMax = Math.max(CHART_MIN_SCALE_MPH, Math.ceil(rawMax / TICK_STEP) * TICK_STEP);
            const ticks = Array.from({ length: scaleMax / TICK_STEP + 1 }, (_, i) => i * TICK_STEP);
            return (
              <>
                <div style={{ display: 'flex', gap: 2, minWidth: 620 }}>
                  <div style={{ width: AXIS_WIDTH, flexShrink: 0 }} />
                  {activeScore.scored.map((h) => (
                    <div key={h.hour} style={{ flex: 1, textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: 10, color: COLORS.inkSoft }}>{h.hour}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 2, minWidth: 620, marginTop: 4 }}>
                  <div style={{ width: AXIS_WIDTH, flexShrink: 0 }} />
                  {activeScore.scored.map((h) => (
                    <div key={h.hour} style={{ flex: 1, display: 'flex', justifyContent: 'center' }} title={`from ${h.dir}\u00b0`}>
                      <ArrowUp size={13} color={directionColor(h.dir, activeSpot.sectors)} style={{ transform: `rotate(${(h.dir + 180) % 360}deg)` }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, minWidth: 620, marginTop: 8 }}>
                  <div style={{ position: 'relative', width: AXIS_WIDTH, flexShrink: 0, height: BAR_AREA_HEIGHT }}>
                    {ticks.map((v) => (
                      <span key={v} className="mono" style={{ position: 'absolute', right: 4, bottom: `${(v / scaleMax) * 100}%`, transform: 'translateY(50%)', fontSize: 9, color: COLORS.inkSoft }}>
                        {v}
                      </span>
                    ))}
                  </div>
                  <div style={{ position: 'relative', flex: 1, height: BAR_AREA_HEIGHT }}>
                    {ticks.map((v) => (
                      <div key={v} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(v / scaleMax) * 100}%`, borderTop: `1px dotted ${COLORS.paperLine}` }} />
                    ))}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 2 }}>
                      {activeScore.scored.map((h) => (
                        <div key={h.hour} style={{ flex: 1, height: '100%', display: 'flex', justifyContent: 'center' }}>
                          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                              <span className="mono" style={{ fontSize: 8, color: COLORS.ink, marginBottom: 1 }}>{h.speed}</span>
                              <div title={`sustained ${h.speed} mph`} style={{ width: 10, height: `${Math.min(100, (h.speed / scaleMax) * 100)}%`, background: scoreColor(h.score) }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                              <span className="mono" style={{ fontSize: 8, color: COLORS.inkSoft, marginBottom: 1 }}>{h.gust}</span>
                              <div title={`gust ${h.gust} mph`} style={{ width: 10, height: `${Math.min(100, (h.gust / scaleMax) * 100)}%`, background: scoreColor(h.score), opacity: 0.4 }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 2, minWidth: 620, marginTop: 10 }}>
                  <div style={{ width: AXIS_WIDTH, flexShrink: 0 }} />
                  {activeScore.scored.map((h) => (
                    <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <SkyIcon sky={h.sky} />
                      <span className="mono" style={{ fontSize: 10, color: COLORS.inkSoft }}>{h.temp}°</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: COLORS.inkSoft, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 10, background: COLORS.inkSoft, display: 'inline-block' }} /> sustained (mph)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 10, background: COLORS.inkSoft, opacity: 0.4, display: 'inline-block' }} /> gust (mph)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowUp size={11} color={COLORS.go} /> aligned direction
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowUp size={11} color={COLORS.caution} /> off direction
                  </div>
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 13, color: COLORS.inkSoft }}>
        {['good', 'marginal', 'none'].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: scoreColor(s), display: 'inline-block' }} />
            {scoreLabel(s)}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, fontSize: 12, color: COLORS.inkSoft, alignItems: 'flex-start' }}>
        <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Good: 12–28 mph sustained in a working direction. Marginal: 9–11 mph, 29+ mph, or under 9 mph with gusts over 20.
          Click a dot on the map to load that spot's hourly chart above.
        </span>
      </div>
    </div>
  );
}
