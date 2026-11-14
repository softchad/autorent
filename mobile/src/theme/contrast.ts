// Paverčia vieną RGB kanalą į tiesinę šviesumo reikšmę.
function channelToLinear(channel: number): number {
  const value = channel / 255;

  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

// Priima #RRGGBB ir grąžina šviesumą nuo 0 iki 1.
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);

  if (!match) {
    throw new Error(`Netinkama spalva: ${hex}`);
  }

  const red = parseInt(match[1].slice(0, 2), 16);
  const green = parseInt(match[1].slice(2, 4), 16);
  const blue = parseInt(match[1].slice(4, 6), 16);

  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

// Apskaičiuoja dviejų spalvų kontrasto santykį.
export function contrastRatio(
  foreground: string,
  background: string,
): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

// Teksto AA kontrasto ribos: įprastam 4.5:1, dideliam 3:1.
export function meetsAA(
  foreground: string,
  background: string,
  isLargeText = false,
): boolean {
  const required = isLargeText ? 3 : 4.5;

  return contrastRatio(foreground, background) >= required;
}