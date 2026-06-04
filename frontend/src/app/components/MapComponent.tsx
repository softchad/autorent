"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import { useGeoCodeMutation } from "@/store/carRentalApi";

// Koordinačių talpykla — neleidžia to paties adreso geokuoduoti kelis kartus
const coordCache = new Map<string, LatLngExpression>();

// Leaflet nesugebą rasti ikonų pats, kai naudojamas Next.js — nurodome rankiniu būdu
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type Automobilis = {
  automobilio_id: number;
  marke: string;
  modelis: string;
  numeris: string;
  lokacija: {
    pavadinimas: string;
    adresas: string;
    miestas?: string;
    latitude?: number;
    longitude?: number;
  } | null;
};

type AutoWithCoords = Automobilis & { coords: LatLngExpression | null };

type MapComponentProps = { cars: Automobilis[] };

// Rodo automobilių žymenis žemėlapyje — naudoja koordinates iš DB arba geokuduoja adresą
export default function MapComponent({ cars }: MapComponentProps) {
  const LOADING_MESSAGES = [
    "Gaunami automobilių adresai...",
    "Siunčiama užklausa į geocoding servisą...",
    "Konvertuojami adresai į koordinates...",
    "Tikrinamas koordinačių tikslumas...",
    "Paruošiami žymekliai žemėlapiui...",
    "Apskaičiuojamos žymeklių pozicijos...",
    "Įkeliami žemėlapio sluoksniai...",
    "Sinchronizuojami duomenys su žemėlapiu...",
    "Baigiamas žymeklių kėlimas...",
  ];

  const [carsWithCoords, setCarsWithCoords] = useState<AutoWithCoords[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const msgIndexRef = useRef(0);
  const [geoCode] = useGeoCodeMutation();

  useEffect(() => {
    if (!cars.length) {
      setCarsWithCoords([]);
      return;
    }

    const needGeocode: Automobilis[] = [];
    const withCoords: AutoWithCoords[] = [];

    cars.forEach((car) => {
      const loc = car.lokacija;
      if (loc?.latitude && loc?.longitude) {
        withCoords.push({ ...car, coords: [loc.latitude, loc.longitude] });
      } else if (loc?.adresas) {
        const cached = coordCache.get(loc.adresas);
        if (cached) {
          withCoords.push({ ...car, coords: cached });
        } else {
          needGeocode.push(car);
        }
      }
    });

    setCarsWithCoords(withCoords);

    if (!needGeocode.length) {
      return;
    }

    setIsLoading(true);
    msgIndexRef.current = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndexRef.current]);
    }, 2000);

    let completed = 0;
    let cancelled = false;

    // Kiekvienas automobilis pridedamas prie žemėlapio iškart, kai jam atsako
    // geokodavimas — nereikia laukti, kol atsakys visi
    needGeocode.forEach(async (car) => {
      const adresas = car.lokacija!.adresas;
      let coords: LatLngExpression | null = null;
      try {
        const { lat, lng } = await geoCode({
          geocodeRequest: { adresas },
        }).unwrap();
        coords = lat && lng ? [lat, lng] : null;
        if (coords) coordCache.set(adresas, coords);
      } catch (e) {
        console.warn("Geocode failed:", adresas, e);
      }

      if (cancelled) return;
      setCarsWithCoords((prev) => [...prev, { ...car, coords }]);

      completed++;
      if (completed === needGeocode.length) {
        clearInterval(interval);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cars]); // geoCode mutation reference kinta kiekviename render'e — jos nereikia čia

  return (
    <div className="relative z-0 p-4 mt-6 h-[500px]">
      {isLoading && (
        <div className="absolute inset-4 z-[1000] flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-white/80">{loadingMsg}</span>
          </div>
        </div>
      )}
      <MapContainer
        center={[55.1694, 23.8813]}
        zoom={7}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='© <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {carsWithCoords
          .filter((c) => c.coords)
          .map((c) => (
            <Marker key={c.automobilio_id} position={c.coords!}>
              <Popup>
                <strong>
                  {c.marke} {c.modelis}
                </strong>
                <br />
                <b>Numeris:</b> {c.numeris}
                <br />
                <b>Adresas:</b> {c.lokacija?.adresas}
                <br />
                {c.lokacija?.miestas && (
                  <>
                    <b>Miestas:</b> {c.lokacija.miestas}
                    <br />
                  </>
                )}
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
