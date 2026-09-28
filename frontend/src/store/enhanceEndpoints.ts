import { carRentalApi } from "./carRentalApi";

export const extendedCarRentalApi = carRentalApi.enhanceEndpoints({
  addTagTypes: ["Cars"],
  endpoints: {
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
} = extendedCarRentalApi;
