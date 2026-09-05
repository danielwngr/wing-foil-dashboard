import { COLORS } from './theme.js';

// Shared style tokens for content pages (About, Directory, Notifications, Add
// a spot). The Dashboard intentionally keeps its own denser layout -- it's
// the data-dense "hero" page, these are its quieter siblings, and they
// should all feel like the same product.

export const page = { maxWidth: 640, margin: '0 auto', padding: '56px 24px 80px' };
export const pageWide = { maxWidth: 900, margin: '0 auto', padding: '56px 24px 80px' };

export const h1 = { fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' };
export const subtitle = { color: COLORS.inkSoft, fontSize: 15, lineHeight: 1.6, marginBottom: 28 };
export const sectionHeading = { fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8 };

export const label = { display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 14 };

export const input = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${COLORS.paperLine}`,
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "'IBM Plex Sans', sans-serif",
  marginTop: 4,
  boxSizing: 'border-box',
};

export const buttonPrimary = {
  background: COLORS.ink,
  color: '#fff',
  border: 'none',
  padding: '10px 20px',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
};

export const errorText = { color: COLORS.danger, fontSize: 13, marginBottom: 14 };
