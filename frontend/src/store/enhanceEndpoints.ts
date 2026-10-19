import { autorentApi } from "./autorentApi";

// Cache tag'ai TURI gyventi ATSKIRAME faile, ne pačiame autorentApi.ts - jis sugeneruojamas IŠ NAUJO (npm run gen:api), tad bet kokia rankinė konfigūracija, įrašyta tiesiai jame, būtų ištrinta per kitą regeneravimą; "enhanceEndpoints" TIK papildo jau sugeneruotus endpoint'us, nekeičiant paties failo.
export const extendedAutorentApi = autorentApi.enhanceEndpoints({
  addTagTypes: ["Cars", "Records"],
  endpoints: {
    // Susiję darbuotojų sąrašai atnaujinami kartu po pakeitimo, kad rezervacijos, nuomos ir automobilio duomenys nesiskirtų tarp puslapių.
    getAllCars: { providesTags: ["Cars", "Records"] },
    createCar: { invalidatesTags: ["Cars", "Records"] },
    updateCar: { invalidatesTags: ["Cars", "Records"] },
    deleteCar: { invalidatesTags: ["Cars", "Records"] },
    getAllEmployees: { providesTags: ["Records"] },
    getCurrentUser: { providesTags: ["Records"] },
    getAllReservations: { providesTags: ["Records"] },
    getLatestReservations: { providesTags: ["Records"] },
    getAllOrders: { providesTags: ["Records"] },
    getAllClients: { providesTags: ["Records"] },
    getAllInvoices: { providesTags: ["Records"] },
    getAvailableCars: { providesTags: ["Records"] },
    getLocations: { providesTags: ["Records"] },
    getStaffConversations: { providesTags: ["Records"] },
    createEmployee: { invalidatesTags: ["Records"] },
    updateEmployee: { invalidatesTags: ["Records"] },
    deleteEmployee: { invalidatesTags: ["Records"] },
    createReservation: { invalidatesTags: ["Records"] },
    updateReservation: { invalidatesTags: ["Records"] },
    deleteReservation: { invalidatesTags: ["Records"] },
    createOrder: { invalidatesTags: ["Records"] },
    updateOrder: { invalidatesTags: ["Records"] },
    deleteOrder: { invalidatesTags: ["Records"] },
    createClient: { invalidatesTags: ["Records"] },
    updateClient: { invalidatesTags: ["Records"] },
    deleteClient: { invalidatesTags: ["Records"] },
    createInvoice: { invalidatesTags: ["Records"] },
    deleteInvoice: { invalidatesTags: ["Records"] },
  },
});

export const {
  useGetAllCarsQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
} = extendedAutorentApi;
