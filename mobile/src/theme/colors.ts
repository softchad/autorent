// AutoRent spalvos: tamsūs fonai, mėlyna ir oranžiniai akcentai.
export const colors = {
  background: '#0B121F',
  surfaceAlt: '#101827',
  surface: '#1A2238',
  surfaceRaised: '#19243A',
  neutralSoft: '#232E47',

  // Skiriamosios linijos ir ryškesni kontūrai.
  border: '#1C2B3A',
  borderStrong: '#3B4D6B',

  text: '#F7F7F7',
  textMuted: '#8FA2BF',

  // Prekės ženklo mėlyna.
  brand: '#0F597B',
  brandPressed: '#0C4863',
  textOnBrand: '#F7F7F7',

  // Žydra tekstui, piktogramoms ir pasirinkimui.
  primary: '#5CC8F0',
  primaryPressed: '#8AD8F5',
  primarySoft: '#123A52',
  textOnPrimary: '#0B121F',

  // Oranžinė pagrindiniams veiksmams.
  accent: '#FF7A1A',
  accentPressed: '#FF8C3D',
  textOnAccent: '#0B121F',

  success: '#4ADE80',
  successSoft: '#11362A',
  warning: '#FBBF24',
  warningSoft: '#3A2D0E',
  danger: '#FF8080',
  dangerSoft: '#3F1B24',
} as const;

export type ColorName = keyof typeof colors;

// Permatomi sluoksniai. Jų kontrastas priklausys ir nuo turinio po jais.
export const overlays = {
  scrim: 'rgba(7, 11, 20, 0.72)',
  glass: 'rgba(16, 24, 39, 0.82)',
  glassLight: 'rgba(247, 247, 247, 0.10)',
  glassBorder: 'rgba(247, 247, 247, 0.16)',
  gridLine: 'rgba(143, 162, 191, 0.07)',
} as const;

// Numatomos teksto ir fono poros, kurių kontrastą tikrina testas.
export const textPairs: {
  text: ColorName;
  background: ColorName;
}[] = [
  { text: 'text', background: 'background' },
  { text: 'text', background: 'surfaceAlt' },
  { text: 'text', background: 'surface' },
  { text: 'text', background: 'surfaceRaised' },
  { text: 'text', background: 'neutralSoft' },

  { text: 'textMuted', background: 'background' },
  { text: 'textMuted', background: 'surfaceAlt' },
  { text: 'textMuted', background: 'surface' },
  { text: 'textMuted', background: 'surfaceRaised' },
  { text: 'textMuted', background: 'neutralSoft' },

  { text: 'textOnBrand', background: 'brand' },
  { text: 'textOnBrand', background: 'brandPressed' },

  { text: 'textOnPrimary', background: 'primary' },
  { text: 'textOnPrimary', background: 'primaryPressed' },
  { text: 'textOnPrimary', background: 'danger' },

  { text: 'textOnAccent', background: 'accent' },
  { text: 'textOnAccent', background: 'accentPressed' },

  { text: 'primary', background: 'background' },
  { text: 'primary', background: 'surface' },
  { text: 'primary', background: 'primarySoft' },

  { text: 'accent', background: 'background' },
  { text: 'accent', background: 'surface' },

  { text: 'success', background: 'successSoft' },
  { text: 'success', background: 'surface' },

  { text: 'warning', background: 'warningSoft' },

  { text: 'danger', background: 'dangerSoft' },
  { text: 'danger', background: 'surface' },
];