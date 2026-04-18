import { configureStore } from "@reduxjs/toolkit";
import { extendedCarRentalApi } from "./enhanceEndpoints";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    [extendedCarRentalApi.reducerPath]: extendedCarRentalApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(extendedCarRentalApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
