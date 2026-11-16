import { apiRequest } from './client';
import { ApiError } from './errors';
import {
  Customer,
  RegisterPayload,
} from './types';

// TypeScript tipas atsakymo runtime nevaliduoja, todėl tokeną patikriname patys.
// Tokenas grąžinamas nepakeistas; jo parašą tikrina serveris.
function readAccessToken(response: unknown): string {
  if (
    typeof response !== 'object' ||
    response === null ||
    Array.isArray(response)
  ) {
    throw new ApiError('unknown');
  }

  const token = (response as { access_token?: unknown }).access_token;

  if (typeof token !== 'string' || token.trim() === '') {
    throw new ApiError('unknown');
  }

  return token;
}

export async function login(
  email: string,
  password: string,
): Promise<string> {
  const response = await apiRequest<unknown>(
    '/customer/login',
    {
      method: 'POST',
      body: {
        el_pastas: email.trim().toLowerCase(),
        slaptazodis: password,
      },
    },
  );

  return readAccessToken(response);
}

// Po registracijos serveris iškart grąžina tokeną.
export async function register(
  payload: RegisterPayload,
): Promise<string> {
  const response = await apiRequest<unknown>(
    '/customer/register',
    {
      method: 'POST',
      body: {
        ...payload,
        el_pastas: payload.el_pastas.trim().toLowerCase(),
      },
    },
  );

  return readAccessToken(response);
}

export function fetchMe(): Promise<Customer> {
  return apiRequest<Customer>(
    '/customer/me',
    { auth: true },
  );
}
