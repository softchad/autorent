/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
const config = {
  schemaFile: 'http://localhost:8000/openapi.json',
  apiFile: './src/store/baseApi.ts',       // ← Čia turi būti TEISINGAS kelias
  apiImport: 'baseApi',
  outputFile: './src/store/carRentalApi.ts', // ← Ir čia taip pat
  exportName: 'carRentalApi',
  hooks: true,
};

module.exports = config;
