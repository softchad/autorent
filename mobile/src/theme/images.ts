import { ImageSourcePropType } from 'react-native';

export const brandImages = {
  logoFull: require('../../assets/brand/logo-full.png') as ImageSourcePropType,
  logoMark: require('../../assets/brand/logo-mark.png') as ImageSourcePropType,
  onboarding: require('../../assets/brand/onboarding.jpg') as ImageSourcePropType,
};

// Iliustracinės nuotraukos pagal markę, ne konkretaus automobilio nuotraukos.
const BRAND_PHOTOS: Record<string, ImageSourcePropType> = {
  audi: require('../../assets/cars/audi.jpg'),
  bmw: require('../../assets/cars/bmw.jpg'),
  ford: require('../../assets/cars/ford.jpg'),
  honda: require('../../assets/cars/honda.jpg'),
  mercedes: require('../../assets/cars/mercedes.jpg'),
  nissan: require('../../assets/cars/nissan.jpg'),
  skoda: require('../../assets/cars/skoda.jpg'),
  tesla: require('../../assets/cars/tesla.jpg'),
  toyota: require('../../assets/cars/toyota.jpg'),
  volkswagen: require('../../assets/cars/volkswagen.jpg'),
};

const FALLBACK_PHOTO: ImageSourcePropType =
  require('../../assets/cars/fallback.jpg');

const PLAIN_LETTERS: Record<string, string> = {
  ą: 'a',
  č: 'c',
  ę: 'e',
  ė: 'e',
  į: 'i',
  š: 's',
  ų: 'u',
  ū: 'u',
  ž: 'z',
};

// „Škoda“ → „skoda“, „Mercedes-Benz“ → „mercedes“.
export function brandKey(brand: string): string {
  const plain = [...brand.trim().toLowerCase()]
    .map((letter) => PLAIN_LETTERS[letter] ?? letter)
    .join('');

  return plain.split(/[\s-]/)[0];
}

export function getCarPhoto(brand: string): ImageSourcePropType {
  return BRAND_PHOTOS[brandKey(brand)] ?? FALLBACK_PHOTO;
}

export function hasOwnCarPhoto(brand: string): boolean {
  return brandKey(brand) in BRAND_PHOTOS;
}