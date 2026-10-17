import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from './store';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { logout } from './authSlice';

const queryWithAuth = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token ??
      (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    return headers;
  },
});

const authenticatedQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, options) => {
  const token = (api.getState() as RootState).auth.token;
  const result = await queryWithAuth(args, api, options);
  if (result.error?.status === 401 && token && token === (api.getState() as RootState).auth.token) {
    api.dispatch(logout());
    api.dispatch(baseApi.util.resetApiState());
  }
  return result;
};

// Bendras visų darbuotojų pusės RTK Query endpoint'ų pagrindas - čia VIENOJE vietoje prisegamas Authorization header'is, kad kiekvienas endpoint'as (enhanceEndpoints.ts/autorentApi.ts) jo pats atskirai nebepridėtų.
export const baseApi = createApi({
  reducerPath: 'api',
  // Ilgiau nei RTK Query numatytasis 60s - darbuotojas dažnai šokinėja tarp sąrašo puslapių (automobiliai/klientai/...) per kelias minutes, tad ilgesnis cache'o galiojimas sumažina pakartotinius refetch'us be realios naudos.
  keepUnusedDataFor: 300,

  baseQuery: authenticatedQuery,

  endpoints: () => ({}),
});
