import { useAuth } from './AuthContext';

// React raktas kliento duomenis rodančiam turiniui: pasikeitus klientui turinys montuojamas iš naujo,
// todėl ankstesnio kliento būsena ir vėluojantys jo užklausų atsakymai naujam klientui nerodomi.
// Kol profilis neatsiųstas (atkurta sesija be customer), naudojamas atskiras raktas; atėjus profiliui
// turinys montuojamas iš naujo jau su kliento raktu.
export function useAccountKey(): string {
  const { customer } = useAuth();
  return customer ? `klientas-${customer.kliento_id}` : 'klientas-nezinomas';
}
