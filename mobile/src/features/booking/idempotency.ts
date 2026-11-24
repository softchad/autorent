// Idempotencijos raktas – atsitiktinis tekstas, kuriuo serveris atpažįsta pakartotą tą patį prašymą.
// Tai ne slaptažodis: serveris raktą sieja su prisijungusiu klientu, todėl svetimas raktas nieko neduoda.
// Rakto užduotis – būti unikaliam, tad kriptografinio atsitiktinumo nereikia.

const HEX = '0123456789abcdef';

function randomHex(length: number, random: () => number): string {
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += HEX[Math.floor(random() * 16)];
  }
  return output;
}

// UUID formos raktas, pvz. 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' (36 simboliai – telpa į serverio 16–64 ribą).
export function generateIdempotencyKey(random: () => number = Math.random, nowMs: number = Date.now()): string {
  // Laiko dalis papildomai sumažina sutapimo tikimybę tarp skirtingų bandymų.
  const timePart = nowMs.toString(16).padStart(12, '0').slice(-12);
  return [randomHex(8, random), randomHex(4, random), `4${randomHex(3, random)}`, randomHex(4, random), timePart].join('-');
}

export function isValidIdempotencyKey(key: string): boolean {
  return /^[A-Za-z0-9-]{16,64}$/.test(key);
}
