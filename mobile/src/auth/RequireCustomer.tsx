import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { lt } from '@/i18n/lt';
import { useAuth } from './AuthContext';

type ProfileLoad = 'idle' | 'loading' | 'failed';

// Naudojamas RequireAuth viduje. Turinį (pvz. redaguojamą formą) montuoja tik žinant kliento ID:
// - kol profilio nėra, rodomas krovimas arba klaida su pakartojimu, todėl nėra juodraščio,
//   kurį vėliau ištrintų atėjęs profilis;
// - turinys raktuojamas kliento ID, todėl pasikeitus klientui A juodraštis ir vėluojantys jo
//   atsakymai kliento B turinyje nelieka.
// Atkūrus sesiją AuthContext profilį užklausia fone ir nesėkmės nepraneša (customer lieka null),
// todėl čia profilis užklausiamas dar kartą ir rodoma šios užklausos būsena. Žinoma riba: kol
// fono užklausa nesibaigusi, GET /customer/me siunčiamas du kartus.
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { customer, refreshCustomer } = useAuth();
  const [profileLoad, setProfileLoad] = useState<ProfileLoad>(customer ? 'idle' : 'loading');
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const loadProfile = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setProfileLoad('loading');
    try {
      await refreshCustomer();
      if (mountedRef.current) setProfileLoad('idle');
    } catch {
      if (mountedRef.current) setProfileLoad('failed');
    } finally {
      busyRef.current = false;
    }
  }, [refreshCustomer]);

  const hasCustomer = Boolean(customer);
  useEffect(() => {
    if (!hasCustomer) {
      void loadProfile();
    }
    // Tik atidarius ekraną; vėliau – mygtuku „Bandyti dar kartą“.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (customer) {
    return <Fragment key={`klientas-${customer.kliento_id}`}>{children}</Fragment>;
  }
  if (profileLoad === 'loading') {
    return <LoadingView message={lt.requireAuth.loadingProfile} />;
  }
  return <ErrorView message={lt.account.profileUnavailable} onRetry={() => void loadProfile()} />;
}
