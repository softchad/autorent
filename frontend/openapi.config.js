// "npm run gen:api" konfigūracija - sugeneruoja src/store/autorentApi.ts IŠ GYVO backend'o OpenAPI schemos (tad backend'as PRIVALO veikti lokaliai prieš paleidimą); kiekvienas backend endpoint'as tampa RTK Query hook'u (žr. "hooks: true" žemiau).
/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
const config = {
  schemaFile: 'http://localhost:8000/openapi.json',
  // "apiFile"/"apiImport" - NAUJI endpoint'ai "injektuojami" į ŠITĄ, jau egzistuojantį baseApi.ts (žr. jo Authorization header'io logiką) - jei ši pora nurodytų kitą/neegzistuojantį failą, sugeneruota API tiesiog neturėtų autentifikacijos.
  apiFile: './src/store/baseApi.ts',
  apiImport: 'baseApi',
  // "exportName" TURI sutapti su tuo, ką autorentApi.ts realiai eksportuoja ("export { injectedRtkApi as autorentApi }") - priešingu atveju visi importai iš šio failo likusiame projekte nulūžtų.
  outputFile: './src/store/autorentApi.ts',
  exportName: 'autorentApi',
  hooks: true,
};

module.exports = config;
