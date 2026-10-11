import { configureStore } from "@reduxjs/toolkit";
import { extendedAutorentApi } from "./enhanceEndpoints";
import authReducer from "./authSlice";

// Tikras, ClientProvider.tsx naudojamas store'as - "extendedAutorentApi" (NE tiesiai "autorentApi"), kad VISŲ RTK Query mutacijų dispatch'ai (nesvarbu, kuriame faile kviečiami) matytų enhanceEndpoints.ts sukonfigūruotus cache tag'us.
export const store = configureStore({
  reducer: {
    [extendedAutorentApi.reducerPath]: extendedAutorentApi.reducer,
    auth: authReducer,
  },
  // ".concat" (NE perrašymas) - PALIEKA RTK numatytąją middleware (serializability/immutability patikros), tik PRIDEDA RTK Query savo (cache/polling/invalidavimas).
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(extendedAutorentApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
