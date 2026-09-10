"use client";

// Abstraktus, nespecifinis "žemėlapio" fonas - stilizuotas gatvių tinklas + upės linija,
// primenantis tamsų žemėlapį (GTA IV/V minimap dvasia). Ne tikras geografinis žemėlapis,
// tik dekoratyvi tekstūra po visu turiniu.
//
// Svarbu: šis sluoksnis yra "absolute inset-0" ir todėl išsitempia per VISO puslapio
// aukštį (kelis ekranus), ne tik vieną langą. Jeigu gatvių tinklas būtų viename SVG su
// viewBox + preserveAspectRatio="slice", jis būtų ištemptas/priartintas, kad "padengtų"
// visą tą aukštį - todėl tinklelis atrodo milžiniškas ir permirkęs. Sprendimas: pats
// pasikartojantis tinklas piešiamas kaip CSS background-repeat (fiksuoto pikselių dydžio
// kafelis, nepriklausomas nuo konteinerio aukščio), o keliai/taškai - atskirame SVG su
// FIKSUOTU aukščiu (ne visu puslapiu), kad irgi nesiskaičiuotų iš naujo pagal puslapio ilgį.
const GRID_TILE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <path d="M0 25 H160 M0 70 H160 M0 95 H160 M0 135 H160" stroke="#4BAFD4" stroke-width="1" fill="none" />
    <path d="M30 0 V160 M65 0 V160 M110 0 V160 M140 0 V160" stroke="#4BAFD4" stroke-width="1" fill="none" />
  </svg>
`;
const GRID_TILE_URL = `url("data:image/svg+xml,${encodeURIComponent(GRID_TILE_SVG)}")`;

export default function MapTexture() {
  const blocks = [
    { x: 0, y: 30 },
    { x: 0, y: 140 },
    { x: 0, y: 260 },
    { x: 0, y: 400 },
    { x: 0, y: 520 },
    { x: 0, y: 660 },
  ];

  const blips = Array.from({ length: 24 }).map((_, i) => ({
    cx: (i * 173) % 1200,
    cy: (i * 281) % 1400,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.06]">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRID_TILE_URL, backgroundRepeat: "repeat" }}
      />

      <svg
        className="absolute inset-x-0 top-0 h-[1400px] w-full"
        viewBox="0 0 1440 1400"
        preserveAspectRatio="xMidYMin slice"
        aria-hidden="true"
      >
        {/* Pagrindiniai keliai - kelios ryškesnės linijos, primenančios magistrales */}
        {blocks.map((b, i) => (
          <path
            key={i}
            d={`M ${b.x} ${b.y} L 2000 ${b.y + (i % 2 === 0 ? 60 : -40)}`}
            stroke="#0F597B"
            strokeWidth="2.5"
            opacity="0.8"
          />
        ))}

        {/* Upė */}
        <path
          d="M -100 250 C 250 180, 350 420, 650 360 S 1050 150, 1400 340 S 1750 520, 2200 430"
          stroke="#0F597B"
          strokeWidth="14"
          fill="none"
          opacity="0.5"
        />

        {/* Taškai - kaip minimap žymekliai */}
        {blips.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r="2.5" fill="#4BAFD4" />
        ))}
      </svg>
    </div>
  );
}
