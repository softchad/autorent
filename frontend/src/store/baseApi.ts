import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from './store';

// Bendras visų darbuotojų pusės RTK Query endpoint'ų pagrindas - čia VIENOJE vietoje prisegamas Authorization header'is, kad kiekvienas endpoint'as (enhanceEndpoints.ts/autorentApi.ts) jo pats atskirai nebepridėtų.
export const baseApi = createApi({
  reducerPath: 'api',
  // Ilgiau nei RTK Query numatytasis 60s - darbuotojas dažnai šokinėja tarp sąrašo puslapių (automobiliai/klientai/...) per kelias minutes, tad ilgesnis cache'o galiojimas sumažina pakartotinius refetch'us be realios naudos.
  keepUnusedDataFor: 300,

  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
    // Reikalinga, kad kartu su užklausa keliautų IR "session" slapukas (Starlette SessionMiddleware, OAuth srautui) - backend CORS (main.py) tam atitinkamai turi allow_credentials=True.
    credentials: 'include',

    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;

      // Fallback į localStorage BŪTINAS - AuthGuard.tsx tokeną į Redux atstato savo useEffect'e PO hard-reload, tad TRUMPam langui (kol tas effect'as paleidžiamas) Redux dar rodo "null", nors tikras tokenas localStorage jau yra.
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
