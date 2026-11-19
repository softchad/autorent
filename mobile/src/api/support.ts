import { apiRequest } from './client';
import { SupportConversation, SupportConversationDetail } from './types';

// Pagalbos pokalbiai – tas pats serverio API, kurį naudoja svetainės „Pašto dėžutė“.
// Serveris grąžina tik prisijungusio kliento pokalbius (klientą nustato pagal tokeną).
const BASE = '/customer/support/conversations';

// Dar neužbaigtos perskaitymo žymos. Sąrašas užklausiamas tik joms pasibaigus (sėkmingai ar ne),
// kad grįžus iš pokalbio „neperskaityta“ žyma nebūtų parodyta iš senesnės serverio būsenos.
// Laukimą riboja užklausos laiko limitas (api/client).
const pendingSeen = new Set<Promise<void>>();

export async function fetchConversations(signal?: AbortSignal): Promise<SupportConversation[]> {
  if (pendingSeen.size > 0) {
    await Promise.all(pendingSeen);
  }
  return apiRequest<SupportConversation[]>(BASE, { auth: true, signal });
}

export function fetchConversation(conversationId: number, signal?: AbortSignal): Promise<SupportConversationDetail> {
  return apiRequest<SupportConversationDetail>(`${BASE}/${conversationId}`, { auth: true, signal });
}

export type NewConversation = {
  tema: string;
  kategorija: string;
  pranesimas: string;
};

// Naujas pokalbis sukuriamas iškart su pirmąja žinute.
export function createConversation(payload: NewConversation): Promise<SupportConversationDetail> {
  return apiRequest<SupportConversationDetail>(BASE, { method: 'POST', auth: true, body: payload });
}

export function sendMessage(conversationId: number, text: string): Promise<SupportConversationDetail> {
  return apiRequest<SupportConversationDetail>(`${BASE}/${conversationId}/messages`, {
    method: 'POST',
    auth: true,
    body: { tekstas: text },
  });
}

// Pažymi, iki kurios žinutės klientas perskaitė pokalbį (dingsta „neperskaityta“ žyma).
export function markConversationSeen(conversationId: number, lastMessageId: number): Promise<SupportConversation> {
  const request = apiRequest<SupportConversation>(`${BASE}/${conversationId}/seen`, {
    method: 'POST',
    auth: true,
    body: { zinutes_id: lastMessageId },
  });
  const settled = request.then(
    () => undefined,
    () => undefined,
  );
  pendingSeen.add(settled);
  void settled.then(() => {
    pendingSeen.delete(settled);
  });
  return request;
}
