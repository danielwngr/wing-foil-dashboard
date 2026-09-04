import React, { useState, useMemo, useEffect } from 'react';
import { Sun, Cloud, CloudRain, MapPin, Info, AlertTriangle, ArrowUp } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const COLORS = {
  paper: '#EDE6D6',
  paperLine: '#CBBFA4',
  ink: '#1B2A3A',
  inkSoft: '#5A6B7A',
  teal: '#2C6E7F',
  go: '#3F8F5F',
  caution: '#C98A3B',
  no: '#B9AF9A',
  noText: '#8A7F68',
};

// Real launch spots. Wind sectors/speed ranges sourced where available from local
// wind-sport references; a few are provisional best-guesses flagged in `note`.
const SPOTS = [
  {
    id: 'se-bdemakaska',
    name: 'SE Bde Maka Ska',
    lat: 44.934344,
    lon: -93.308645,
    sectors: [[245, 360], [0, 25]],
    note: 'Works N, NW, or W',
  },
  {
    id: 'n-bdemakaska',
    name: 'North Bde Maka Ska',
    lat: 44.9490395,
    lon: -93.3139819,
    sectors: [[110, 250]],
    note: 'Works SW, S, or SE',
  },
  {
    id: 'waconia',
    name: 'Waconia',
    lat: 44.872499,
    lon: -93.759354,
    sectors: [[300, 360], [0, 30]],
    note: 'Beginner-friendly \u2014 best with west component',
  },
  {
    id: 'wisconsin-point',
    name: 'Point Wisconsin',
    lat: 46.7051173,
    lon: -92.0099167,
    sectors: [[20, 70]],
    note: 'Bay side \u2014 works with NE wind',
  },
  {
    id: 'father-hennepin',
    name: 'Father Hennepin',
    lat: 46.14472,
    lon: -93.48806,
    sectors: [[290, 340]],
    note: 'Advanced only \u2014 little shallow water, best on strong NW',
  },
];

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const NUM_DAYS = 5;
const CHART_MAX_MPH = 45;
const BAR_AREA_HEIGHT = 210;
const AXIS_WIDTH = 26;
const TICK_STEP = 5;
const TICKS = Array.from({ length: Math.floor(CHART_MAX_MPH / TICK_STEP) + 1 }, (_, i) => i * TICK_STEP);

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
//   13-25 mph sustained -> good
//   9-12 mph, or 26+ mph sustained -> marginal
//   under 9 mph sustained, but gusts over 20 mph -> marginal
//   under 9 mph sustained with calmer gusts -> none
// Wind direction is the gating condition: wrong direction is always 'none'
// regardless of speed.
function scoreHour(spot, hour) {
  const inDir = inSector(hour.dir, spot.sectors);
  if (!inDir) return 'none';
  if (hour.rain > 60) return 'none';

  const speed = hour.speed;
  if (speed >= 13 && speed <= 25) return 'good';
  if (speed >= 9 && speed <= 12) return 'marginal';
  if (speed >= 26) return 'marginal';
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

function dayScoreForSpot(spot, day) {
  const rank = { good: 2, marginal: 1, none: 0 };
  const scored = day.hours.map((h) => ({ ...h, score: scoreHour(spot, h) }));
  const overall = scored.some((h) => h.score === 'good')
    ? 'good'
    : scored.some((h) => h.score === 'marginal')
    ? 'marginal'
    : 'none';
  const goodHours = scored.filter((h) => h.score === 'good');
  const window = goodHours.length
    ? `${goodHours[0].hour}:00\u2013${goodHours[goodHours.length - 1].hour + 1}:00`
    : null;
  const bestHour = scored.reduce((acc, h) => (rank[h.score] > rank[acc.score] ? h : acc), scored[0]);
  return { overall, scored, window, bestHour };
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

async function fetchSpotForecast(spot) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lon}` +
    `&hourly=temperature_2m,windspeed_10m,winddirection_10m,windgusts_10m,weathercode` +
    `&windspeed_unit=mph&temperature_unit=fahrenheit&timezone=auto&forecast_days=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast request failed (${res.status})`);
  const data = await res.json();
  return buildDaysFromHourly(data.hourly);
}

const scoreColor = (s) => (s === 'good' ? COLORS.go : s === 'marginal' ? COLORS.caution : COLORS.no);
const scoreLabel = (s) => (s === 'good' ? 'Go' : s === 'marginal' ? 'Marginal' : 'No go');

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

export default function App() {
  const [dayIdx, setDayIdx] = useState(0);
  const [selected, setSelected] = useState(SPOTS[0].id);
  const [forecastBySpot, setForecastBySpot] = useState({});
  const [loading, setLoading] = useState(true);
  const [fallbackIds, setFallbackIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      const fallback = new Set();
      const entries = await Promise.all(
        SPOTS.map(async (s) => {
          try {
            return [s.id, await fetchSpotForecast(s)];
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
  }, []);

  const dayMetaList = useMemo(() => Array.from({ length: NUM_DAYS }, (_, i) => dayMeta(i)), []);

  const spotScores = useMemo(() => {
    const out = {};
    SPOTS.forEach((s) => {
      const days = forecastBySpot[s.id];
      out[s.id] = days && days[dayIdx] ? dayScoreForSpot(s, days[dayIdx]) : null;
    });
    return out;
  }, [forecastBySpot, dayIdx]);

  const activeSpot = SPOTS.find((s) => s.id === selected);
  const activeScore = spotScores[selected];
  const activeIsFallback = fallbackIds.has(selected);

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: COLORS.paper,
        minHeight: '100vh',
        color: COLORS.ink,
        padding: '28px 24px 40px',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
        * { box-sizing: border-box; }
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .dayTab { cursor: pointer; }
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
      `}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, borderBottom: `2px solid ${COLORS.ink}`, paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h1 className="sg" style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Launch Conditions
            </h1>
            <p style={{ margin: '6px 0 0', color: COLORS.inkSoft, fontSize: 14 }}>
              Wing foiling forecast across your spots, five days out.
            </p>
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, border: `1px solid ${COLORS.inkSoft}`, padding: '5px 10px', color: COLORS.inkSoft, whiteSpace: 'nowrap' }}
          >
            {loading ? 'loading live forecast' : fallbackIds.size > 0 ? 'live forecast, sample fallback for some spots' : 'live forecast, Open-Meteo'}
          </div>
        </div>

        {/* Day tabs: horizontal row with dates, plus which spots look good that day */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${COLORS.paperLine}` }}>
          {dayMetaList.map((d, i) => {
            const goodNames = SPOTS.map((s) => {
              const days = forecastBySpot[s.id];
              if (!days || !days[i]) return null;
              return dayScoreForSpot(s, days[i]).overall === 'good' ? s.name : null;
            }).filter(Boolean);
            const active = i === dayIdx;
            return (
              <button
                key={i}
                className="dayTab sg"
                onClick={() => setDayIdx(i)}
                style={{
                  flex: 1,
                  background: active ? COLORS.ink : 'transparent',
                  color: active ? COLORS.paper : COLORS.inkSoft,
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
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    lineHeight: 1.35,
                    textAlign: 'center',
                    color: goodNames.length ? (active ? COLORS.paper : COLORS.go) : active ? 'rgba(237,230,214,0.5)' : COLORS.paperLine,
                    fontWeight: goodNames.length ? 600 : 400,
                  }}
                >
                  {goodNames.length ? goodNames.join(', ') : '\u2014'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected spot summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
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
        {activeSpot.note && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 }}>
            <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0, color: COLORS.caution }} />
            <span>{activeSpot.note}</span>
          </div>
        )}
        {activeIsFallback && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: COLORS.inkSoft, marginBottom: 18 }}>
            <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0, color: COLORS.caution }} />
            <span>Live forecast wasn't reachable for this spot — showing sample data instead.</span>
          </div>
        )}

        {/* Hourly wind chart: mph scale, speed + gust bars, direction arrows, sky + temp below */}
        <div style={{ border: `1px solid ${COLORS.ink}`, padding: '16px 14px 14px', marginBottom: 24, overflowX: 'auto', overflowY: 'visible', marginTop: activeSpot.note || activeIsFallback ? 0 : 18 }}>
          {!activeScore ? (
            <div style={{ height: BAR_AREA_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.inkSoft, fontSize: 13 }}>
              Loading live forecast…
            </div>
          ) : (
            <>
              {/* Hour labels */}
              <div style={{ display: 'flex', gap: 3, minWidth: 560 }}>
                <div style={{ width: AXIS_WIDTH, flexShrink: 0 }} />
                {activeScore.scored.map((h) => (
                  <div key={h.hour} style={{ flex: 1, textAlign: 'center' }}>
                    <span className="mono" style={{ fontSize: 10, color: COLORS.inkSoft }}>{h.hour}</span>
                  </div>
                ))}
              </div>

              {/* Wind direction arrows */}
              <div style={{ display: 'flex', gap: 3, minWidth: 560, marginTop: 4 }}>
                <div style={{ width: AXIS_WIDTH, flexShrink: 0 }} />
                {activeScore.scored.map((h) => (
                  <div key={h.hour} style={{ flex: 1, display: 'flex', justifyContent: 'center' }} title={`from ${h.dir}\u00b0`}>
                    <ArrowUp
                      size={12}
                      color={COLORS.teal}
                      style={{ transform: `rotate(${h.dir}deg)` }}
                    />
                  </div>
                ))}
              </div>

              {/* Scale + gridlines + bars */}
              <div style={{ display: 'flex', gap: 6, minWidth: 560, marginTop: 8 }}>
                <div style={{ position: 'relative', width: AXIS_WIDTH, flexShrink: 0, height: BAR_AREA_HEIGHT }}>
                  {TICKS.map((v) => (
                    <span
                      key={v}
                      className="mono"
                      style={{ position: 'absolute', right: 4, bottom: `${(v / CHART_MAX_MPH) * 100}%`, transform: 'translateY(50%)', fontSize: 9, color: COLORS.inkSoft }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <div style={{ position: 'relative', flex: 1, height: BAR_AREA_HEIGHT }}>
                  {TICKS.map((v) => (
                    <div
                      key={v}
                      style={{ position: 'absolute', left: 0, right: 0, bottom: `${(v / CHART_MAX_MPH) * 100}%`, borderTop: `1px dotted ${COLORS.paperLine}` }}
                    />
                  ))}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 3 }}>
                    {activeScore.scored.map((h) => (
                      <div key={h.hour} style={{ position: 'relative', flex: 1, height: '100%' }}>
                        <span
                          className="mono"
                          style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: `${Math.min(100, (h.speed / CHART_MAX_MPH) * 100)}%`,
                            transform: 'translate(-50%, -3px)',
                            fontSize: 9,
                            color: COLORS.ink,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.speed}
                        </span>
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                          <div
                            title={`sustained ${h.speed} mph`}
                            style={{ width: 7, height: `${Math.min(100, (h.speed / CHART_MAX_MPH) * 100)}%`, background: scoreColor(h.score) }}
                          />
                          <div
                            title={`gust ${h.gust} mph`}
                            style={{ width: 7, height: `${Math.min(100, (h.gust / CHART_MAX_MPH) * 100)}%`, background: scoreColor(h.score), opacity: 0.4 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sky + temp */}
              <div style={{ display: 'flex', gap: 3, minWidth: 560, marginTop: 10 }}>
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
                  <ArrowUp size={11} color={COLORS.teal} /> wind direction (points where it's blowing from)
                </div>
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div
          style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', border: `1px solid ${COLORS.ink}`, background: COLORS.paper, overflow: 'hidden' }}
        >
          <MapContainer
            center={[45.6, -93]}
            zoom={7}
            scrollWheelZoom
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={SPOTS.map((s) => [s.lat, s.lon])} />
            {SPOTS.map((s) => {
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
                </CircleMarker>
              );
            })}
          </MapContainer>
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
            Good: 13–25 mph sustained in a working direction. Marginal: 9–12 mph, 26+ mph, or under 9 mph with gusts over 20.
            Click a dot on the map to load that spot's hourly chart above.
          </span>
        </div>
      </div>
    </div>
  );
}
