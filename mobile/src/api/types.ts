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
