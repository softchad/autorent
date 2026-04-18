import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from './store';

export const baseApi = createApi({
  reducerPath: 'api',
  keepUnusedDataFor: 300,

  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:8000',
    credentials: 'include',

    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;

      // Redux state tokenas; fallback į localStorage (tas pats raktas "token")
      const token =
        state.auth?.token ??
        (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      headers.set('Accept', 'application/json');
      return headers;
    },
  }),

  endpoints: () => ({}),
});
