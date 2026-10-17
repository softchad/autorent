// Bendras "token"/"session" slapukų skaitymo/rašymo/trynimo būdas - visos vietos, dirbančios su jais, turi naudoti ŠIUOS, kad "path" atributas rašant/skaitant/trinant VISADA sutaptų (kitaip naršyklė slapuko tiesiog "nerastų" trynimo/skaitymo metu).
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  // "name" PABĖGAMAS nuo regex specialiųjų simbolių - šiuo metu visada paduodama tik "token"/"session" (jų nėra), bet tai bendras pagalbininkas, o ne vien jiems, tad nesaugu tyliai pasitikėti, kad ateities pavadinimas jų neturės.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // "encodeURIComponent" PRIVALO sutapti su "decodeURIComponent" readCookie aukščiau - JWT tokenas šiandien niekada neturi ";"/"=" ir be šito veiktų, bet be kodavimo bet kuri BŪSIMA reikšmė su tokiais simboliais tyliai sugadintų slapuką (naršyklė palaikytų ";" kaip NAUJO atributo pradžią).
  // "; Secure" PRIDEDAMA TIK kai puslapis pats pasiektas per HTTPS - ne visada, kad VIETINĖ kūrimo aplinka (http://localhost) nenustotų veikti (naršyklė Secure slapukus VISIŠKAI atmeta per plain HTTP). Produkcijoje (HTTPS) šis slapukas - DARBUOTOJO JWT - niekada neturėtų keliauti atviru tekstu per tinklą.
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax${secure}`;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/`;
}
