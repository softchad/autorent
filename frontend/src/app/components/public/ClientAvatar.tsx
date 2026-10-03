// Kliento avataras - PATIES vardo raidė ant spalvoto fono, NE įmonės logotipas
// ir NE įkelta nuotrauka (saugumo/moderavimo apimties vengimas). Spalva parenkama
// deterministiškai iš kliento_id, kad ta pati paskyra visada atrodytų vienodai.
const PALETTE = [
  "#0F597B", "#B4780A", "#1F8A5F", "#2D7DD2", "#C23B3B",
  "#1E9E8C", "#A8762F", "#3F9B6B", "#4A6FA5", "#C2753B",
];

export default function ClientAvatar({
  name,
  seed,
  size = 28,
}: {
  name: string;
  seed: number;
  size?: number;
}) {
  const color = PALETTE[((seed % PALETTE.length) + PALETTE.length) % PALETTE.length];
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
