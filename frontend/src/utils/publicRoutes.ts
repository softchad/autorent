// Vieši keliai, pasiekiami be prisijungimo - naudojama middleware.ts, AuthGuard.tsx ir Layout.tsx, kad visos trys vietos sutartų dėl to paties sąrašo.
export const PUBLIC_ROUTES = [
  "/",
  "/apie-mus",
  "/karjera",
  "/nuomos-taisykles",
  "/privatumo-politika",
  "/automobiliai",
  "/paskyra",
  "/kontaktai",
  "/kelioniu-patarimai",
];

// Keliai, kurių bet koks tąsinys (pvz. /automobiliai/25) irgi turi likti viešas - automobilio ID dalis dinaminė, tad tikslus sąrašas jos neaprėpia; /paskyra yra vieša ta pačia prasme kaip ir kitos viešos svetainės dalys - tai kliento, ne darbuotojo, sritis, tad darbuotojų AuthGuard/middleware jos neturi blokuoti. Prieigą į patį turinį (ar rodyti profilį, ar "reikia prisijungti") sprendžia AccountClient.tsx pagal atskirą CustomerAuthProvider būseną, ne šis sąrašas.
const PUBLIC_PREFIXES = ["/automobiliai/", "/paskyra/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
