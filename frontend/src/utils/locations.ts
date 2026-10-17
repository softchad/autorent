// Realūs AutoRent padalinių adresai, sutampantys su Pristatymo_Vietos lentele ("vietos_id" eilės tvarka TURI atitikti seed.sql INSERT tvarką, nes tai AUTO_INCREMENT) - koordinatės gautos vieną kartą per OpenStreetMap Nominatim ir įrašytos statiškai, kad žemėlapiui nereikėtų gyvos geokodavimo užklausos kiekvieną kartą atidarant puslapį.
export type LocationWithCoords = {
  vietos_id: number;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
};

// Haversine atstumas kilometrais tarp dviejų koordinačių - naudojama LocationSearch, kad surikiuotume tikrus padalinius nuo artimiausio iki tolimiausio.
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const LOCATIONS: LocationWithCoords[] = [
  { vietos_id: 1, name: "Vilnius Centras", address: "Gedimino pr. 1, Vilnius", city: "Vilnius", lat: 54.6862361, lng: 25.2859942 },
  { vietos_id: 2, name: "Kaunas Centras", address: "Laisvės al. 10, Kaunas", city: "Kaunas", lat: 54.8970211, lng: 23.9261916 },
  { vietos_id: 3, name: "Klaipėda", address: "Taikos pr. 20, Klaipėda", city: "Klaipėda", lat: 55.7014265, lng: 21.1444417 },
  { vietos_id: 4, name: "Šiauliai", address: "Tilžės g. 5, Šiauliai", city: "Šiauliai", lat: 55.9086583, lng: 23.2640584 },
  { vietos_id: 5, name: "Panevėžys", address: "Respublikos g. 15, Panevėžys", city: "Panevėžys", lat: 55.7292425, lng: 24.3593274 },
  { vietos_id: 6, name: "Alytus", address: "Naujoji g. 30, Alytus", city: "Alytus", lat: 54.3995681, lng: 24.0267544 },
  { vietos_id: 7, name: "Marijampolė", address: "Gedimino g. 5, Marijampolė", city: "Marijampolė", lat: 54.5567751, lng: 23.3520949 },
  { vietos_id: 8, name: "Utena", address: "J. Basanavičiaus g. 3, Utena", city: "Utena", lat: 55.4957334, lng: 25.5839148 },
  { vietos_id: 9, name: "Mažeikiai", address: "Laisvės g. 25, Mažeikiai", city: "Mažeikiai", lat: 56.3135676, lng: 22.3439903 },
  // Tiksliu adresu Nominatim nerado - naudojamas Telšių miesto centro taškas.
  { vietos_id: 10, name: "Telšiai", address: "Žemaitijos g. 7, Telšiai", city: "Telšiai", lat: 55.9846135, lng: 22.2490753 },
];
