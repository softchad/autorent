import { apiRequest } from './client';
import { createConversation, fetchConversation, fetchConversations, markConversationSeen, sendMessage } from './support';

jest.mock('./client');
const request = jest.mocked(apiRequest);

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue([]);
});

describe('pagalbos pokalbių užklausos', () => {
  it('visos užklausos siunčiamos su prisijungimo raktu', async () => {
    await fetchConversations();
    await fetchConversation(5);
    await createConversation({ tema: 'Tema', kategorija: 'kita', pranesimas: 'Tekstas' });
    await sendMessage(5, 'Labas');
    await markConversationSeen(5, 12);
    expect(request).toHaveBeenCalledTimes(5);
    for (const [, options] of request.mock.calls) {
      expect(options).toMatchObject({ auth: true });
    }
  });

  it('naudoja esamus kliento pagalbos endpointus', async () => {
    await fetchConversations();
    await fetchConversation(5);
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/customer/support/conversations', '/customer/support/conversations/5']);
  });

  it('naujas pokalbis ir žinutė siunčiami serverio laukų pavadinimais', async () => {
    await createConversation({ tema: 'Tema', kategorija: 'saskaita', pranesimas: 'Tekstas' });
    expect(request).toHaveBeenLastCalledWith('/customer/support/conversations', {
      method: 'POST',
      auth: true,
      body: { tema: 'Tema', kategorija: 'saskaita', pranesimas: 'Tekstas' },
    });
    await sendMessage(5, 'Labas');
    expect(request).toHaveBeenLastCalledWith('/customer/support/conversations/5/messages', { method: 'POST', auth: true, body: { tekstas: 'Labas' } });
  });

  it('perskaitymo žyma nurodo paskutinę matytą žinutę', async () => {
    await markConversationSeen(5, 12);
    expect(request).toHaveBeenLastCalledWith('/customer/support/conversations/5/seen', { method: 'POST', auth: true, body: { zinutes_id: 12 } });
  });

  it('sąrašo užklausa perduoda atšaukimo signalą', async () => {
    const controller = new AbortController();
    await fetchConversations(controller.signal);
    expect(request).toHaveBeenLastCalledWith('/customer/support/conversations', { auth: true, signal: controller.signal });
  });
});

describe('grįžimas į pašto dėžutę po perskaitymo žymos', () => {
  function deferredRequest() {
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  async function flush() {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  }

  it('sąrašas užklausiamas tik užsibaigus pradėtai perskaitymo žymai', async () => {
    const seen = deferredRequest();
    request.mockReturnValueOnce(seen.promise as Promise<never>);
    void markConversationSeen(5, 12);

    const list = fetchConversations();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    seen.resolve({});
    await list;
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][0]).toBe('/customer/support/conversations');
  });

  it('nepavykusi perskaitymo žyma sąrašo neblokuoja', async () => {
    const seen = deferredRequest();
    request.mockReturnValueOnce(seen.promise as Promise<never>);
    markConversationSeen(5, 12).catch(() => undefined);

    const list = fetchConversations();
    seen.reject(new Error('ryšys'));
    await expect(list).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('be laukiančių žymų sąrašas užklausiamas iškart', async () => {
    const list = fetchConversations();
    expect(request).toHaveBeenCalledTimes(1);
    await list;
  });
});
