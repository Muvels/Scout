export type Space = {
  id: string;
  name: string;
  color: string;
  /** Second gradient stop; a space without one keeps a solid wash. */
  gradientTo?: string;
  /** Optional Arc-style glyph shown in the spaces strip. */
  icon?: SpaceIcon;
};

export type SpaceIcon = {
  kind: 'emoji' | 'symbol';
  value: string;
};

/** The Arc-style swatch row offered when creating or editing a space. */
export const SPACE_COLORS = [
  '#6f7f95',
  '#ead9b8',
  '#ef7d9e',
  '#8e5a9e',
  '#dd4b41',
  '#ef8a3c',
  '#f0c845',
  '#4cbf85',
  '#63b6d9',
  '#4a5878',
] as const;

export const DEFAULT_SPACE: Space = {
  id: 'default',
  name: 'Home',
  color: SPACE_COLORS[0],
  icon: { kind: 'symbol', value: 'home' },
};

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 0.2;
  return (
    0.2126 * channel(hex, 0)
    + 0.7152 * channel(hex, 2)
    + 0.0722 * channel(hex, 4)
  );
}

/** The midpoint of two hex colors — the anchor a gradient theme derives from. */
export function mixHex(a: string, b: string): string {
  const ha = a.replace('#', '');
  const hb = b.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(ha) || !/^[0-9a-f]{6}$/i.test(hb)) return a;
  let result = '#';
  for (const offset of [0, 2, 4]) {
    const mixed = Math.round(
      (parseInt(ha.slice(offset, offset + 2), 16)
        + parseInt(hb.slice(offset, offset + 2), 16)) / 2,
    );
    result += mixed.toString(16).padStart(2, '0');
  }
  return result;
}

/** What a space's picker dot shows: its color, or its gradient. */
export function spaceSwatch(space: Pick<Space, 'color' | 'gradientTo'>): string {
  return space.gradientTo
    ? `linear-gradient(135deg, ${space.color}, ${space.gradientTo})`
    : space.color;
}

/**
 * Derives the whole chrome palette from one space color, mirroring how the
 * ocean and sunrise mockups relate to their base colors: light chromes get
 * dark warm text and darkened surfaces, dark chromes get whitened ones.
 *
 * A gradient space anchors the palette on the gradient's midpoint, so text
 * contrast and surfaces suit both ends, and paints the wash as the two
 * colors under the shared luminosity ramp.
 */
export function themeVariables(
  base: string,
  gradientTo?: string,
): Record<string, string> {
  const color = gradientTo ? mixHex(base, gradientTo) : base;
  const light = relativeLuminance(color) > 0.55;
  const foreground = light
    ? `color-mix(in srgb, black 72%, ${color})`
    : `color-mix(in srgb, white 92%, ${color})`;
  return {
    '--sidebar': color,
    '--sidebar-foreground': foreground,
    '--chrome-gradient': gradientTo
      ? 'var(--chrome-ramp), linear-gradient(160deg, '
        + `color-mix(in srgb, ${base} 82%, transparent) 0%, `
        + `color-mix(in srgb, ${gradientTo} 82%, transparent) 100%)`
      : 'var(--chrome-ramp)',
    // Surfaces are translucent neutral gray, not an opaque mix of the anchor
    // color: on gradient spaces the anchor is the midpoint, which paints a
    // muddy solid unrelated to the wash actually behind the pill. Translucency
    // samples the local backdrop, so the space color shimmers through.
    '--surface': light
      ? 'color-mix(in srgb, #3d3a45 16%, transparent)'
      : 'color-mix(in srgb, white 16%, transparent)',
    '--surface-hover': light
      ? 'color-mix(in srgb, #3d3a45 24%, transparent)'
      : 'color-mix(in srgb, white 24%, transparent)',
    // Same translucent treatment, but denser than --surface: the active tab
    // reads as a solid-feeling pill while still letting the wash tint it.
    '--tab-active': light
      ? 'color-mix(in srgb, white 62%, transparent)'
      : 'color-mix(in srgb, white 42%, transparent)',
    '--content-empty': `color-mix(in srgb, white 88%, ${color})`,
    '--accent': light
      ? `color-mix(in srgb, black 10%, ${color})`
      : `color-mix(in srgb, white 25%, ${color})`,
    '--accent-foreground': light ? foreground : 'white',
  };
}
