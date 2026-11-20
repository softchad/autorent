export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Customer = {
  kliento_id: number;
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data: string | null;
};

export type RegisterPayload = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  slaptazodis: string;
};

// Pagalbos pokalbiai (tie patys laukai kaip svetainės „Pašto dėžutėje“).
export type SupportStatus = 'atvira' | 'sprendziama' | 'laukiama_kliento' | 'isspresta';

export type SupportReservationContext = {
  rezervacijos_id: number;
  marke: string;
  modelis: string;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
};

export type SupportConversation = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute: string | null;
  // Autoriaus tipas ('klientas' arba 'darbuotojas'), ne vardas.
  paskutine_zinute_autorius: string | null;
  // true – pagalba atsakė, o klientas atsakymo dar nematė.
  neperskaityta: boolean;
  rezervacija: SupportReservationContext | null;
  sprendimo_santrauka: string | null;
};

export type SupportMessage = {
  zinutes_id: number;
  autoriaus_tipas: 'klientas' | 'darbuotojas';
  // Darbuotojo žinutėje – „AutoRent (Vardas)“, kliento žinutėje – null; el. pašto ar telefono serveris negrąžina.
  autorius_vardas: string | null;
  tekstas: string;
  sukurimo_data: string;
};

export type SupportConversationDetail = SupportConversation & {
  zinutes: SupportMessage[];
};

export type Location = {
  vietos_id: number;
  pavadinimas: string;
  adresas: string;
  miestas: string;
};

// Viešas automobilio aprašas: serveris negrąžina VIN, valstybinio numerio ir vidinių pastabų.
export type PublicCar = {
  automobilio_id: number;
  marke: string;
  modelis: string;
  metai: number;
  spalva: string;
  kebulo_tipas: string;
  pavaru_deze: string;
  variklio_turis: number;
  galia_kw: number;
  kuro_tipas: string;
  rida: number;
  sedimos_vietos: number;
  klimato_kontrole: boolean;
  navigacija: boolean;
  kaina_parai: number;
  automobilio_statusas: string;
  lokacija: Location | null;
  // Užpildoma tik kai užklausoje nurodytos datos.
  laisvas_pasirinktu_laikotarpiu: boolean | null;
};
