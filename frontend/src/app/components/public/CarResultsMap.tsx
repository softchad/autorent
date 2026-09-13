"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LOCATIONS } from "@/utils/locations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Kainos "pin" ant žemėlapio - kaip booking.com/airbnb rodo kainą tiesiai ant žymeklio,
// ne tik pop-up'e. Automobilio ikona + kaina piliulėje, su smailiu apačioje, kuris
// tiksliai rodo į koordinatę (translate(-50%,-100%) kelia visą ženkliuką virš taško,
// o ne centruoja ant jo - taip pin'o "galiukas" atitinka realią vietą, profesionaliau
// nei vien centruota piliulė). Aktyvus (pasirinktas) taškas paryškintas oranžine spalva.
function priceIcon(minPrice: number, active: boolean) {
  const color = active ? "#FF7A1A" : "#0F597B";
  const carSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 11.5L6.3 7.6C6.6 6.6 7.6 6 8.6 6h6.8c1 0 2 .6 2.3 1.6L19 11.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="3.5" y="11.5" width="17" height="5.5" rx="2" stroke="white" stroke-width="1.8"/>
    <circle cx="7.5" cy="17.5" r="1.6" fill="white"/>
    <circle cx="16.5" cy="17.5" r="1.6" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: `
      <div style="transform:translate(-50%,-100%)" class="flex flex-col items-center">
        <div style="background:${color}" class="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 pl-2 pr-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.45)] transition-transform ${active ? "scale-110" : ""}">
          ${carSvg}
          <span>nuo ${minPrice} €</span>
        </div>
        <div style="background:${color}" class="h-2 w-2 -mt-[5px] rotate-45 rounded-[2px] border-r border-b border-white/15"></div>
      </div>`,
    className: "bg-transparent border-0 cursor-pointer",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export type LocationStat = { count: number; minPrice: number };

function CenterTracker({ onCenterChange }: { onCenterChange?: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange?.(c.lat, c.lng);
    },
  });
  return null;
}

export default function CarResultsMap({
  stats,
  activeVietosId,
  onSelectLocation,
  onCenterChange,
}: {
  stats: Record<number, LocationStat>;
  activeVietosId?: number | null;
  onSelectLocation: (vietosId: number) => void;
  onCenterChange?: (lat: number, lng: number) => void;
}) {
  const activeLocations = LOCATIONS.filter((l) => stats[l.vietos_id]);

  return (
    <MapContainer
      center={[55.2, 23.9]}
      zoom={7}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      {/*
        CARTO's free dark_all basemap dabar reikalauja API rakto (patikrinta realiu
        užklausimu - dabar grąžina "API KEY REQUIRED" vietoj tikro žemėlapio; ta pati
        problema veikia ir darbuotojų MapComponent.tsx). Naudojame standartinius,
        tikrai nemokamus OpenStreetMap plytelius su CSS invert filtru, kad atrodytų
        tamsūs ir atitiktų puslapio stilių.
      */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterTracker onCenterChange={onCenterChange} />
      {activeLocations.map((loc) => {
        const stat = stats[loc.vietos_id];
        const active = activeVietosId === loc.vietos_id;
        return (
          <Marker
            key={loc.vietos_id}
            position={[loc.lat, loc.lng]}
            icon={priceIcon(stat.minPrice, active)}
            eventHandlers={{
              // Paspaudus tašką IŠ KARTO pritaikomas filtras - nebereikia papildomai
              // spausti mygtuko pop-up'e. Toggle (atšaukimas pakartotinai paspaudus) logika
              // sąmoningai NEsprendžiama čia pagal "active" closure reikšmę - react-leaflet
              // eventHandlers persirišimas su kiekvienu render'u gali laikyti pasenusią
              // closure reikšmę, tad pats mygtuko paspaudimas visada siunčia tą patį
              // vietos_id, o toggle sprendžia tėvinis komponentas per setState funkcinę
              // formą (žr. AutomobiliaiClient.tsx) - tai garantuotai mato naujausią būseną.
              click: () => onSelectLocation(loc.vietos_id),
            }}
            // Paprastas naršyklės title (hover tooltip) vietoj Leaflet <Popup> - popup
            // fiziškai persidengdavo su pačiu žymekliu (custom iconAnchor neatitiko Leaflet
            // popup pozicionavimo matematikos), todėl antras paspaudimas pataikydavo į
            // popup, o ne į žymeklį, ir filtro atšaukimas pakartotinai spaudžiant neveikdavo.
            title={`${loc.name} - ${stat.count} ${stat.count === 1 ? "automobilis" : "automobiliai"} nuo ${stat.minPrice} € / parai`}
          />
        );
      })}
    </MapContainer>
  );
}
