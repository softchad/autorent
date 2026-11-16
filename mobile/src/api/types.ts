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