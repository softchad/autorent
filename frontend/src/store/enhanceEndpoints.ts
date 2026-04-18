import { carRentalApi } from "./carRentalApi";

export const extendedCarRentalApi = carRentalApi.enhanceEndpoints({
  addTagTypes: ["Cars", "Support"],
  endpoints: {
    getAllCars: { providesTags: ["Cars"] },
    createCar: { invalidatesTags: ["Cars"] },
    updateCar: { invalidatesTags: ["Cars"] },
    deleteCar: { invalidatesTags: ["Cars"] },
    getAllSupports: { providesTags: ["Support"] },
    answerToSupport: { invalidatesTags: ["Support"] },
  },
});

export const {
  useGetAllCarsQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useGetAllSupportsQuery,
  useAnswerToSupportMutation,
} = extendedCarRentalApi;
