import { autorentApi } from "./autorentApi";

// Cache tag'ai TURI gyventi ATSKIRAME faile, ne pačiame autorentApi.ts - jis sugeneruojamas IŠ NAUJO (npm run gen:api), tad bet kokia rankinė konfigūracija, įrašyta tiesiai jame, būtų ištrinta per kitą regeneravimą; "enhanceEndpoints" TIK papildo jau sugeneruotus endpoint'us, nekeičiant paties failo.
export const extendedAutorentApi = autorentApi.enhanceEndpoints({
  addTagTypes: ["Cars"],
  endpoints: {
    // Tik "Cars" turi tag'ais pagrįstą automatinį atnaujinimą - likusios esybės (klientai/darbuotojai/užsakymai/rezervacijos/sąskaitos) vietoj to naudoja rankinį refetch() po kiekvienos mutacijos (žr. useClientsData.ts ir pan.); nesuderinta tarp esybių, bet abi veikia teisingai.
    getAllCars: { providesTags: ["Cars"] },
    createCar: { invalidatesTags: ["Cars"] },
    updateCar: { invalidatesTags: ["Cars"] },
    deleteCar: { invalidatesTags: ["Cars"] },
  },
});

export const {
  useGetAllCarsQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
} = extendedAutorentApi;
