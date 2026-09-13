import type { PublicCar } from "@/hooks/usePublicCars";

// Kiekvienai markei, kurią turime DB, priskirta tikra to modelio nuotrauka
// (šaltiniai ir licencijos - žr. frontend/public/images/brands/CREDITS.md).
// Jeigu ateityje atsiras nauja markė, kurios neturime nuotraukos, naudojame
// bendrą iliustracinę nuotrauką pagal kėbulo/kuro tipą kaip atsarginį variantą.
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

// Atsarginės nuotraukos iš /images/fleet/ - jų šaltinis NEPATVIRTINTAS (žr.
// public/images/fleet/CREDITS.md). Dabartiniams seed duomenims (markės žemiau
// BRAND_PHOTOS sąraše) šis fallback'as realiai nekviečiamas, bet jei atsiras
// nauja markė be nuotraukos, ji pateks čia - reikia pakeisti patikrintomis prieš viešinant.
function fallbackPhoto(car: Pick<PublicCar, "kuro_tipas" | "kebulo_tipas">): string {
  if (car.kuro_tipas === "elektra") return "/images/fleet/ev-charging.jpg";
  if (car.kebulo_tipas === "Visureigis") return "/images/fleet/suv-studio.jpg";
  if (car.kuro_tipas === "hibridas") return "/images/fleet/black-sports-car.jpg";
  if (car.kebulo_tipas === "Hečbekas") return "/images/fleet/grey-sports-car.jpg";
  return "/images/fleet/sedan-highway.jpg";
}

export function getCarPhoto(car: Pick<PublicCar, "marke" | "kuro_tipas" | "kebulo_tipas">): string {
  return BRAND_PHOTOS[car.marke] ?? fallbackPhoto(car);
}
