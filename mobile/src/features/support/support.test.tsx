import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import * as supportApi from '@/api/support';
import { SupportConversation, SupportConversationDetail } from '@/api/types';
import { lt } from '@/i18n/lt';
import { pressTwiceBeforeCommit } from '@/testUtils/pressTwice';
import { ConversationView } from './ConversationView';
import { InboxView } from './InboxView';
import { NewConversationForm } from './NewConversationForm';
import {
  codePointLength,
  lastMessageId,
  messageTime,
  parseConversationId,
  statusBadge,
  stripLikeServer,
  supportErrorMessage,
  validateMessage,
  validateSubject,
} from './supportLogic';

jest.mock('@/api/support');
const api = jest.mocked(supportApi);

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Laukai tokie, kokius grąžina serveris (customer_support.py): paskutine_zinute_autorius – autoriaus tipas,
// kliento žinutės autorius_vardas – null.
function makeConversation(overrides: Partial<SupportConversation> = {}): SupportConversation {
  return {
    pokalbio_id: 31,
    tema: 'Ar galima grąžinti anksčiau?',
    kategorija: 'rezervacija',
    busena: 'laukiama_kliento',
    sukurimo_data: '2026-11-18T09:00:00',
    atnaujinimo_data: '2026-11-19T10:15:00',
    paskutine_zinute: 'Taip, galima – parašykite, kada atvyksite.',
    paskutine_zinute_autorius: 'darbuotojas',
    neperskaityta: true,
    rezervacija: null,
    sprendimo_santrauka: null,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<SupportConversationDetail> = {}): SupportConversationDetail {
  return {
    ...makeConversation(),
    zinutes: [
      { zinutes_id: 1, autoriaus_tipas: 'klientas', autorius_vardas: null, tekstas: 'Ar galima grąžinti anksčiau?', sukurimo_data: '2026-11-18T09:00:00' },
      { zinutes_id: 2, autoriaus_tipas: 'darbuotojas', autorius_vardas: 'AutoRent (Rasa)', tekstas: 'Taip, galima.', sukurimo_data: '2026-11-19T10:15:00' },
    ],
    ...overrides,
  };
}

function withMessage(detail: SupportConversationDetail, id: number, tekstas: string): SupportConversationDetail {
  return {
    ...detail,
    zinutes: [...detail.zinutes, { zinutes_id: id, autoriaus_tipas: 'klientas', autorius_vardas: null, tekstas, sukurimo_data: '2026-11-19T11:00:00' }],
  };
}

beforeEach(() => {
  api.fetchConversations.mockReset();
  api.fetchConversation.mockReset();
  api.createConversation.mockReset();
  api.sendMessage.mockReset();
  api.markConversationSeen.mockReset().mockResolvedValue(makeConversation({ neperskaityta: false }));
});

describe('validacija (ribos kaip serveryje)', () => {
  it('tema: 3–150 simbolių, tarpai nesiskaičiuoja', () => {
    expect(validateSubject('  ab ')).toBe(lt.support.errors.subjectTooShort);
    expect(validateSubject('abc')).toBeNull();
    expect(validateSubject('a'.repeat(151))).toBe(lt.support.errors.subjectTooLong);
  });

  it('žinutė: privaloma, ne ilgesnė nei 5000 simbolių', () => {
    expect(validateMessage('   ')).toBe(lt.support.errors.messageRequired);
    expect(validateMessage('Labas')).toBeNull();
    expect(validateMessage('a'.repeat(5001))).toBe(lt.support.errors.messageTooLong);
  });

  it('ilgis skaičiuojamas Unicode kodo taškais, kaip Python len()', () => {
    expect(codePointLength('\u{1F600}\u{1F600}')).toBe(2);
    // Du emoji – serveriui 2 simboliai, todėl tema per trumpa.
    expect(validateSubject('\u{1F600}\u{1F600}')).toBe(lt.support.errors.subjectTooShort);
    expect(validateSubject('\u{1F600}\u{1F600}\u{1F600}')).toBeNull();
    // 150 emoji – 300 UTF-16 vienetų, bet 150 kodo taškų.
    expect(validateSubject('\u{1F600}'.repeat(150))).toBeNull();
    expect(validateSubject('\u{1F600}'.repeat(151))).toBe(lt.support.errors.subjectTooLong);
    expect(validateMessage('\u{1F600}'.repeat(5000))).toBeNull();
    expect(validateMessage('\u{1F600}'.repeat(5001))).toBe(lt.support.errors.messageTooLong);
  });

  it('pavienis surogatas atmetamas, o sveika pora – ne', () => {
    expect(validateMessage('Labas \uD83D')).toBe(lt.support.errors.invalidCharacters);
    expect(validateSubject('Tema \uDE00')).toBe(lt.support.errors.invalidCharacters);
    expect(validateMessage('Labas \u{1F600}')).toBeNull();
  });

  it('tarpai kraštuose šalinami taip pat, kaip Python str.strip()', () => {
    // \x1c ir \x85 Python laiko tarpais, JS trim() – ne.
    expect(stripLikeServer('\x1cab\x85')).toBe('ab');
    expect(validateSubject('\x1cab\x1c')).toBe(lt.support.errors.subjectTooShort);
    // ﻿ Python nelaiko tarpu, todėl jis lieka ir skaičiuojamas.
    expect(stripLikeServer('﻿ab')).toBe('﻿ab');
    expect(validateSubject('﻿ab')).toBeNull();
    // Vidiniai tarpai ir tekstas nekeičiami.
    expect(stripLikeServer('  Labas,\n  pasauli  ')).toBe('Labas,\n  pasauli');
  });
});

describe('pagalbinės funkcijos', () => {
  it('statusBadge: žinoma būsena turi lietuvišką pavadinimą, nežinoma rodoma neutraliai', () => {
    expect(statusBadge('isspresta')).toEqual({ label: 'Išspręsta', tone: 'success' });
    expect(statusBadge('laukiama_kliento').tone).toBe('warning');
    expect(statusBadge('nauja_busena')).toEqual({ label: 'nauja_busena', tone: 'neutral' });
  });

  it('statusBadge: paveldėti objekto raktai nelaikomi žinoma būsena', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(statusBadge(key)).toEqual({ label: key, tone: 'neutral' });
    }
  });

  it('parseConversationId priima tik saugų teigiamą sveikąjį skaičių', () => {
    expect(parseConversationId('31')).toBe(31);
    expect(parseConversationId('9007199254740991')).toBe(9007199254740991);
    for (const bad of ['0', '-1', '1.5', '1e3', '0x1F', ' 31', '031', '', '9007199254740992', 'abc']) {
      expect(parseConversationId(bad)).toBeNull();
    }
    expect(parseConversationId(['31'])).toBeNull();
    expect(parseConversationId(undefined)).toBeNull();
  });

  it('lastMessageId ir messageTime', () => {
    expect(lastMessageId(makeDetail())).toBe(2);
    expect(lastMessageId(makeDetail({ zinutes: [] }))).toBeNull();
    expect(messageTime('2026-11-19T10:15:00')).toBe('10:15');
  });

  it('supportErrorMessage nerodo serverio „detail“ teksto', () => {
    expect(supportErrorMessage(new ApiError('validation', 422, 'Field required'))).toBe(lt.support.errors.rejected);
    expect(supportErrorMessage(new ApiError('validation', 400, 'Tema turi būti 3-150 simbolių.'))).toBe(lt.support.errors.rejected);
    expect(supportErrorMessage(new ApiError('rate_limited', 429, 'Rate limit exceeded: 10 per 1 minute'))).toBe(
      'Per daug bandymų. Palaukite minutę ir bandykite dar kartą.',
    );
    expect(supportErrorMessage(new ApiError('not_found', 404, 'Pokalbis nerastas'))).toBe(lt.support.notFound);
    expect(supportErrorMessage(new ApiError('network'))).toBe('Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį.');
  });
});

describe('InboxView', () => {
  it('rodo pokalbius ir pažymi neperskaitytą ne vien spalva', async () => {
    api.fetchConversations.mockResolvedValue([makeConversation(), makeConversation({ pokalbio_id: 32, tema: 'Sąskaita', neperskaityta: false, busena: 'isspresta' })]);
    await render(<InboxView onOpen={jest.fn()} onNew={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Ar galima grąžinti anksčiau?')).toBeTruthy());
    expect(screen.getByTestId('conversation-unread-31')).toBeTruthy();
    expect(screen.queryByTestId('conversation-unread-32')).toBeNull();
    expect(screen.getByTestId('conversation-31').props.accessibilityLabel).toContain('Neperskaitytas atsakymas');
    expect(screen.getByText('Išspręsta')).toBeTruthy();
  });

  it('paspaudus atidaro pokalbį, mygtukas pradeda naują', async () => {
    api.fetchConversations.mockResolvedValue([makeConversation()]);
    const onOpen = jest.fn();
    const onNew = jest.fn();
    await render(<InboxView onOpen={onOpen} onNew={onNew} />);
    await waitFor(() => expect(screen.getByTestId('conversation-31')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('conversation-31'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ pokalbio_id: 31 }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nauja žinutė' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('tuščia pašto dėžutė turi paaiškinimą ir naujos žinutės mygtuką', async () => {
    api.fetchConversations.mockResolvedValue([]);
    await render(<InboxView onOpen={jest.fn()} onNew={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Žinučių dar nėra')).toBeTruthy());
    expect(screen.getByTestId('inbox-new')).toBeTruthy();
  });

  it('klaidos atveju leidžia pakartoti', async () => {
    api.fetchConversations.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue([makeConversation()]);
    await render(<InboxView onOpen={jest.fn()} onNew={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('error-view')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(screen.getByTestId('conversation-31')).toBeTruthy());
  });

  it('atnaujinant po grįžimo sąrašas lieka, o nepavykus – lieka su lietuvišku paaiškinimu', async () => {
    api.fetchConversations.mockResolvedValueOnce([makeConversation()]);
    const { rerender } = await render(<InboxView onOpen={jest.fn()} onNew={jest.fn()} refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId('conversation-31')).toBeTruthy());

    const refresh = deferred<SupportConversation[]>();
    api.fetchConversations.mockReturnValueOnce(refresh.promise);
    await rerender(<InboxView onOpen={jest.fn()} onNew={jest.fn()} refreshKey={2} />);
    expect(api.fetchConversations).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('conversation-31')).toBeTruthy();

    await act(async () => {
      refresh.reject(new ApiError('server', 500, 'Internal Server Error'));
    });
    expect(screen.getByTestId('conversation-31')).toBeTruthy();
    expect(screen.getByTestId('inbox-refresh-error')).toHaveTextContent('Serverio klaida. Bandykite dar kartą.');
    expect(screen.queryByText('Internal Server Error')).toBeNull();
  });
});

describe('ConversationView', () => {
  it('rodo žinutes su autoriumi ir pažymi pokalbį perskaitytu', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail());
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByText('Taip, galima.')).toBeTruthy());
    expect(screen.getByLabelText('Jūs, lapkričio 18 d., 09:00: Ar galima grąžinti anksčiau?')).toBeTruthy();
    expect(screen.getByLabelText('AutoRent (Rasa), lapkričio 19 d., 10:15: Taip, galima.')).toBeTruthy();
    await waitFor(() => expect(api.markConversationSeen).toHaveBeenCalledWith(31, 2));
  });

  it('išsiunčia žinutę, parodo atnaujintą pokalbį ir išvalo lauką', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail());
    api.sendMessage.mockResolvedValue(withMessage(makeDetail(), 3, 'Ačiū!'));
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), '  Ačiū!  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Siųsti žinutę' }));
    await waitFor(() => expect(screen.getByTestId('message-3')).toBeTruthy());
    expect(api.sendMessage).toHaveBeenCalledWith(31, 'Ačiū!');
    expect(screen.getByTestId('composer-input').props.value).toBe('');
  });

  it('dvigubas paspaudimas siunčia žinutę vieną kartą; siuntimo metu laukas neredaguojamas', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail());
    const pending = deferred<SupportConversationDetail>();
    api.sendMessage.mockReturnValue(pending.promise);
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Ačiū!');

    await pressTwiceBeforeCommit('composer-send');
    await fireEvent.press(screen.getByTestId('composer-send'));
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('composer-input').props.editable).toBe(false);

    await act(async () => {
      pending.resolve(withMessage(makeDetail(), 3, 'Ačiū!'));
    });
    expect(screen.getByTestId('message-3')).toBeTruthy();
    expect(screen.getByTestId('composer-input').props.value).toBe('');
    expect(screen.getByTestId('composer-input').props.editable).toBe(true);
  });

  it('tuščia žinutė nesiunčiama', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail());
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('composer-send')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('composer-send'));
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId('composer-error')).toHaveTextContent(lt.support.errors.messageRequired);
  });

  it('nepavykus išsiųsti tekstas lieka lauke, klaida lietuviška ir automatiškai nekartojama', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail());
    api.sendMessage.mockRejectedValue(new ApiError('validation', 422, 'Field required'));
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Svarbi žinutė');
    await fireEvent.press(screen.getByTestId('composer-send'));
    await waitFor(() => expect(screen.getByTestId('composer-error')).toHaveTextContent(lt.support.errors.rejected));
    expect(screen.queryByText('Field required')).toBeNull();
    expect(screen.getByTestId('composer-input').props.value).toBe('Svarbi žinutė');
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('išspręstame pokalbyje rodoma sprendimo santrauka', async () => {
    api.fetchConversation.mockResolvedValue(makeDetail({ busena: 'isspresta', sprendimo_santrauka: 'Grąžinimo laikas pakeistas.' }));
    await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('conversation-resolution')).toBeTruthy());
    expect(screen.getByText('Grąžinimo laikas pakeistas.')).toBeTruthy();
    expect(screen.getByTestId('conversation-status')).toHaveTextContent('Išspręsta');
  });

  it('svetimas ar nerastas pokalbis rodo klaidą, o ne tuščią ekraną', async () => {
    api.fetchConversation.mockRejectedValue(new ApiError('not_found', 404, 'Pokalbis nerastas'));
    await render(<ConversationView conversationId={999} />);
    await waitFor(() => expect(screen.getByTestId('error-view')).toBeTruthy());
    expect(screen.getByText(lt.support.notFound)).toBeTruthy();
    expect(api.markConversationSeen).not.toHaveBeenCalled();
  });

  it('pakeitus pokalbį nelieka ankstesnio atsakymo, teksto, klaidos, o pavėluotas siuntimas jo nepaveikia', async () => {
    const first = makeDetail();
    const second = makeDetail({
      pokalbio_id: 32,
      tema: 'Sąskaita',
      zinutes: [{ zinutes_id: 50, autoriaus_tipas: 'klientas', autorius_vardas: null, tekstas: 'Kur sąskaita?', sukurimo_data: '2026-11-19T12:00:00' }],
    });
    api.fetchConversation.mockImplementation((id) => Promise.resolve(id === 31 ? first : second));
    const lateSend = deferred<SupportConversationDetail>();
    api.sendMessage.mockReturnValueOnce(lateSend.promise);

    const { rerender } = await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Senas tekstas');
    await fireEvent.press(screen.getByTestId('composer-send'));

    await rerender(<ConversationView conversationId={32} />);
    await waitFor(() => expect(screen.getByText('Kur sąskaita?')).toBeTruthy());
    expect(screen.getByTestId('composer-input').props.value).toBe('');
    expect(screen.getByTestId('composer-input').props.editable).toBe(true);

    await act(async () => {
      lateSend.resolve(withMessage(first, 3, 'Senas tekstas'));
    });
    expect(screen.queryByTestId('message-3')).toBeNull();
    expect(screen.queryByText('Ar galima grąžinti anksčiau?')).toBeNull();
    expect(screen.getByText('Kur sąskaita?')).toBeTruthy();
  });

  it('perskaitytu žymimas tik parodytas pokalbis – niekada naujas numeris su sena žinute', async () => {
    const second = deferred<SupportConversationDetail>();
    api.fetchConversation.mockImplementation((id) => (id === 31 ? Promise.resolve(makeDetail()) : second.promise));

    const { rerender } = await render(<ConversationView conversationId={31} />);
    await waitFor(() => expect(api.markConversationSeen).toHaveBeenCalledWith(31, 2));

    await rerender(<ConversationView conversationId={32} />);
    expect(api.markConversationSeen.mock.calls).toEqual([[31, 2]]);

    await act(async () => {
      second.resolve(
        makeDetail({
          pokalbio_id: 32,
          zinutes: [{ zinutes_id: 50, autoriaus_tipas: 'darbuotojas', autorius_vardas: 'AutoRent', tekstas: 'Sveiki', sukurimo_data: '2026-11-19T12:00:00' }],
        }),
      );
    });
    expect(api.markConversationSeen.mock.calls).toEqual([
      [31, 2],
      [32, 50],
    ]);
  });
});

describe('NewConversationForm', () => {
  async function fillForm(subject = 'Klausimas', message = 'Tekstas') {
    await fireEvent.changeText(screen.getByTestId('support-subject'), subject);
    await fireEvent.changeText(screen.getByTestId('support-message'), message);
  }

  it('nesiunčia, kol tema per trumpa ar žinutė tuščia', async () => {
    await render(<NewConversationForm onCreated={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('support-subject'), 'ab');
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(api.createConversation).not.toHaveBeenCalled();
    expect(screen.getByText(lt.support.errors.subjectTooShort)).toBeTruthy();
    expect(screen.getByText(lt.support.errors.messageRequired)).toBeTruthy();
  });

  it('siunčia temą, pasirinktą kategoriją ir žinutę', async () => {
    const onCreated = jest.fn();
    api.createConversation.mockResolvedValue(makeDetail({ pokalbio_id: 40 }));
    await render(<NewConversationForm onCreated={onCreated} />);
    await fireEvent.changeText(screen.getByTestId('support-subject'), ' Klausimas dėl sąskaitos ');
    await fireEvent.press(screen.getByRole('button', { name: 'Sąskaita' }));
    await fireEvent.changeText(screen.getByTestId('support-message'), 'Negavau sąskaitos.');
    await fireEvent.press(screen.getByTestId('support-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ pokalbio_id: 40 })));
    expect(api.createConversation).toHaveBeenCalledWith({ tema: 'Klausimas dėl sąskaitos', kategorija: 'saskaita', pranesimas: 'Negavau sąskaitos.' });
  });

  it('emoji ir vidiniai tarpai siunčiami nepakeisti', async () => {
    api.createConversation.mockResolvedValue(makeDetail({ pokalbio_id: 41 }));
    await render(<NewConversationForm onCreated={jest.fn()} />);
    await fillForm('\u{1F600}\u{1F600}\u{1F600}', '  Labas \u{1F44B}\n\nAčiū  ');
    await fireEvent.press(screen.getByTestId('support-submit'));
    await waitFor(() => expect(api.createConversation).toHaveBeenCalledTimes(1));
    expect(api.createConversation).toHaveBeenCalledWith({ tema: '\u{1F600}\u{1F600}\u{1F600}', kategorija: 'kita', pranesimas: 'Labas \u{1F44B}\n\nAčiū' });
  });

  it('dvigubas pateikimas sukuria vieną pokalbį', async () => {
    const pending = deferred<SupportConversationDetail>();
    api.createConversation.mockReturnValue(pending.promise);
    const onCreated = jest.fn();
    await render(<NewConversationForm onCreated={onCreated} />);
    await fillForm();

    await pressTwiceBeforeCommit('support-submit');
    expect(api.createConversation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('support-subject').props.editable).toBe(false);

    await act(async () => {
      pending.resolve(makeDetail({ pokalbio_id: 40 }));
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('išmontavus pavėluotas sukūrimo atsakymas nenaviguoja', async () => {
    const pending = deferred<SupportConversationDetail>();
    api.createConversation.mockReturnValue(pending.promise);
    const onCreated = jest.fn();
    const { unmount } = await render(<NewConversationForm onCreated={onCreated} />);
    await fillForm();
    await fireEvent.press(screen.getByTestId('support-submit'));
    await unmount();
    await act(async () => {
      pending.resolve(makeDetail({ pokalbio_id: 40 }));
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('serverio klaida parodoma lietuviškai, forma lieka užpildyta ir nekartojama', async () => {
    api.createConversation.mockRejectedValue(new ApiError('rate_limited', 429, 'Rate limit exceeded: 10 per 1 minute'));
    await render(<NewConversationForm onCreated={jest.fn()} />);
    await fillForm();
    await fireEvent.press(screen.getByTestId('support-submit'));
    await waitFor(() => expect(screen.getByTestId('support-error')).toBeTruthy());
    expect(screen.getByTestId('support-error')).toHaveTextContent('Per daug bandymų. Palaukite minutę ir bandykite dar kartą.');
    expect(screen.queryByText(/Rate limit/)).toBeNull();
    expect(screen.getByTestId('support-subject').props.value).toBe('Klausimas');
    expect(api.createConversation).toHaveBeenCalledTimes(1);
  });
});
