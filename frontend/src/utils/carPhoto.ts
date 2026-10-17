import type { PublicCar } from "@/hooks/usePublicCars";

// Kiekvienai markei, kurią realiai turime DB, priskirta tikra to modelio nuotrauka; "marke" yra laisvas tekstinis laukas (žr. useCarsData.ts), tad "Skoda" IR "Škoda" abu įrašyti sąmoningai - darbuotojas gali surašyti bet kurį variantą.
const BRAND_PHOTOS: Record<string, string> = {
  "Toyota": "/images/brands/toyota-corolla.jpg",
  "Volkswagen": "/images/brands/vw-golf.jpg",
  "BMW": "/images/brands/bmw-x5.jpg",
  "Mercedes-Benz": "/images/brands/mercedes-e-class.jpg",
  "Audi": "/images/brands/audi-a4.jpg",
  "Ford": "/images/brands/ford-focus.jpg",
  "Tesla": "/images/brands/tesla-model-3.jpg",
  "Honda": "/images/brands/honda-civic.jpg",
  "Nissan": "/images/brands/nissan-qashqai.jpg",
  "Skoda": "/images/brands/skoda-superb.jpg",
  "Škoda": "/images/brands/skoda-superb.jpg",
};

// Bendra iliustracinė nuotrauka pagal kėbulo/kuro tipą - naudojama TIK jei markės BRAND_PHOTOS sąraše nėra (šiuo metu visos realios seed duomenų markės JAU yra, tad šis kelias realiai nekviečiamas, bet pasiruošęs naujai markei be savo nuotraukos).
function fallbackPhoto(car: Partial<Pick<PublicCar, "kuro_tipas" | "kebulo_tipas">>): string {
  if (car.kuro_tipas === "elektra") return "/images/fleet/ev-charging.jpg";
  if (car.kebulo_tipas === "Visureigis") return "/images/fleet/suv-studio.jpg";
  if (car.kuro_tipas === "hibridas") return "/images/fleet/black-sports-car.jpg";
  if (car.kebulo_tipas === "Hečbekas") return "/images/fleet/grey-sports-car.jpg";
  return "/images/fleet/sedan-highway.jpg";
}

// Vieša įvesties riba - priima TIK tiek lauko, kiek realiai reikia (marke + kuro/kebulo tipas), ne visą PublicCar, kad funkciją būtų lengva naudoti IR su nepilnais objektais (pvz. formos peržiūra prieš išsaugojimą).
export function getCarPhoto(car: Partial<Pick<PublicCar, "kuro_tipas" | "kebulo_tipas">> & Pick<PublicCar, "marke">): string {
  return BRAND_PHOTOS[car.marke] ?? fallbackPhoto(car);
}
