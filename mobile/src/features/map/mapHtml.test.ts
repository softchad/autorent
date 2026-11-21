import {
  buildMapHtml,
  DEFAULT_ATTRIBUTION,
  DEFAULT_TILES_URL,
  escapeHtml,
  isValidCoordinate,
  isValidTilesUrl,
  type MapOptions,
  toSafeScriptJson,
} from './mapHtml';

const VILNIUS = { lat: 54.6862361, lng: 25.2859942, title: 'Vilnius Centras', address: 'Gedimino pr. 1, Vilnius' };
const CUSTOM_TILES = 'https://tiles.example.com/{z}/{x}/{y}.png';
const A = { lat: 54.7, lng: 25.3 };
const C = { lat: 54.69, lng: 25.29 };

function dataOf(html: string) {
  return JSON.parse(/var data = (.*);/.exec(html)![1]);
}

// Paleidžia sugeneruotą vidinį script su imituotu Leaflet ir DOM; grąžina, kas buvo iškviesta.
function runMapScript(html: string, withLeaflet = true) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  expect(scripts).toHaveLength(1);

  const errorElement = { style: { display: 'none' } };
  const document = { getElementById: jest.fn((id: string) => (id === 'map-error' ? errorElement : null)) };
  const layer = () => {
    const created = { addTo: jest.fn(), on: jest.fn() };
    created.addTo.mockReturnValue(created);
    created.on.mockReturnValue(created);
    return created;
  };
  const map = { setView: jest.fn(), fitBounds: jest.fn(), attributionControl: { setPosition: jest.fn() } };
  map.setView.mockReturnValue(map);
  const L = {
    map: jest.fn(() => map),
    tileLayer: jest.fn(layer),
    divIcon: jest.fn((options: object) => ({ divIcon: options })),
    marker: jest.fn(layer),
    polyline: jest.fn(layer),
  };

  new Function('L', 'document', scripts[0])(withLeaflet ? L : undefined, document);
  return { L, map, errorElement };
}

describe('isValidCoordinate', () => {
  it.each([
    [54.68, 25.28, true],
    [-90, 180, true],
    [90, -180, true],
    [0, 0, true],
    [91, 25, false],
    [-90.0001, 25, false],
    [90.0001, 25, false],
    [54, 181, false],
    [54, -180.0001, false],
    [54, 180.0001, false],
    [NaN, 25, false],
    [54, Infinity, false],
    [-Infinity, 25, false],
  ])('(%p, %p) → %p', (lat, lng, expected) => {
    expect(isValidCoordinate(lat, lng)).toBe(expected);
  });
});

describe('toSafeScriptJson', () => {
  it('neleidžia tekstui užbaigti script žymos', () => {
    const json = toSafeScriptJson({ title: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json).title).toBe('</script><script>alert(1)</script>');
  });

  it('užkoduoja HTML komentaro pradžią', () => {
    const json = toSafeScriptJson({ title: '<!-- x' });
    expect(json).not.toContain('<!--');
    expect(json).toContain('\\u003c!--');
    expect(JSON.parse(json).title).toBe('<!-- x');
  });

  it('užkoduoja eilučių skyriklius U+2028 ir U+2029', () => {
    const text = 'a\u2028b\u2029c';
    const json = toSafeScriptJson({ text });
    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');
    expect(json).toContain('\\u2028');
    expect(json).toContain('\\u2029');
    expect(JSON.parse(json).text).toBe(text);
  });
});

describe('escapeHtml', () => {
  it('užkoduoja HTML specialiuosius simbolius', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
});

describe('isValidTilesUrl', () => {
  it.each([
    DEFAULT_TILES_URL,
    CUSTOM_TILES,
    'https://{s}.tiles.example.com/{z}/{x}/{y}{r}.png',
    'https://tiles.example.com:8443/{z}/{x}/{y}.png?key=abc-123',
  ])('priima %p', (url) => {
    expect(isValidTilesUrl(url)).toBe(true);
  });

  it.each([
    ['be šablono vietų', 'https://tiles.example.com/map.png'],
    ['be {y}', 'https://tiles.example.com/{z}/{x}.png'],
    ['http', 'http://tiles.example.com/{z}/{x}/{y}.png'],
    ['javascript', 'javascript:{z}{x}{y}'],
    ['be hosto', 'https://{z}/{x}/{y}'],
    ['hostas be kelio', 'https://tiles.example.com{z}/{x}/{y}'],
    ['tuščia žymė', 'https://tiles..example.com/{z}/{x}/{y}.png'],
    ['IP adresas', 'https://127.0.0.1/{z}/{x}/{y}.png'],
    ['naudotojas ir slaptažodis', 'https://user:pass@tiles.example.com/{z}/{x}/{y}.png'],
    ['naudotojas', 'https://user@tiles.example.com/{z}/{x}/{y}.png'],
    ['tarpas', 'https://tiles.example.com/{z}/{x}/{y} .png'],
    ['tabuliacija', 'https://tiles.example.com/{z}/{x}/{y}\t.png'],
    ['eilutės pabaiga', 'https://tiles.example.com/{z}/{x}/{y}.png\n'],
    ['dviguba kabutė', 'https://tiles.example.com/{z}/{x}/{y}".png'],
    ['viengubė kabutė', "https://tiles.example.com/{z}/{x}/{y}'.png"],
    ['nežinoma vieta', 'https://tiles.example.com/{z}/{x}/{y}/{foo}.png'],
    ['vieta su tarpais', 'https://tiles.example.com/{ z }/{x}/{y}.png'],
    ['nesuporuotas skliaustas', 'https://tiles.example.com/{z}/{x}/{y}}.png'],
  ])('atmeta: %s', (_reason, url) => {
    expect(isValidTilesUrl(url)).toBe(false);
  });
});

describe('buildMapHtml', () => {
  it('įterpia koordinates ir pavadinimą', () => {
    const html = buildMapHtml(VILNIUS);
    expect(html).toContain('"lat":54.6862361');
    expect(html).toContain('Vilnius Centras');
  });

  it('naudoja konkrečią Leaflet versiją su integrity atributais', () => {
    const html = buildMapHtml(VILNIUS);
    expect(html).toContain('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    expect(html.match(/integrity="sha256-/g)).toHaveLength(2);
  });

  it('piktybinis adresas nesukuria naujos script žymos', () => {
    const html = buildMapHtml({ ...VILNIUS, address: '</script><script>window.x=1</script>' });
    expect(html.match(/<script/g)).toHaveLength(2);
  });

  it('padalinio pavadinimas nepatenka į sugeneruotą HTML ar žymeklių šabloną', () => {
    const html = buildMapHtml({ ...VILNIUS, title: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('innerHTML');
    expect(html).not.toContain('bindPopup');
    expect(html).not.toContain('<img src=x');
    // Žymeklių HTML yra pastovus tekstas be jokių duomenų.
    expect(html).toContain(`html: '<div class="pin"></div>'`);
  });

  it('žemėlapis tamsus ir rodo plytelių autorystę', () => {
    const html = buildMapHtml(VILNIUS);
    expect(html).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(html).toContain('invert(100%)');
    expect(html).toContain("attributionControl.setPosition('topright')");
    expect(html).toContain('OpenStreetMap contributors');
    expect(html).toContain('background: #0B121F');
  });

  it('be kliento vietos ir maršruto nieko papildomo nebraižo', () => {
    const data = dataOf(buildMapHtml(VILNIUS));
    expect(data.user).toBeNull();
    expect(data.route).toEqual([]);
  });

  it('perduoda kliento vietą ir tikro maršruto taškus', () => {
    const route = [A, C];
    const data = dataOf(buildMapHtml(VILNIUS, { userPoint: A, route }));
    expect(data.user).toEqual(A);
    expect(data.route).toEqual(route);
  });

  it('netinkama kliento vieta atmetama atskirai nuo maršruto', () => {
    const data = dataOf(buildMapHtml(VILNIUS, { userPoint: { lat: 999, lng: 0 }, route: [A, C] }));
    expect(data.user).toBeNull();
    expect(data.route).toEqual([A, C]);
  });

  it('maršrutas [A, netinkamas, C] nebraižomas visai, o tinkama kliento vieta lieka', () => {
    const data = dataOf(buildMapHtml(VILNIUS, { userPoint: A, route: [A, { lat: NaN, lng: 1 }, C] }));
    expect(data.route).toEqual([]);
    expect(data.user).toEqual(A);
  });

  it('netinkamas plytelių adresas iš konfigūracijos pakeičiamas numatytuoju', () => {
    const data = dataOf(buildMapHtml(VILNIUS, { tilesUrl: 'javascript:alert(1)' }));
    expect(data.tilesUrl).toBe(DEFAULT_TILES_URL);
  });

  it.each<[string, MapOptions]>([
    ['be nustatymų', {}],
    ['tuščia autorystė', { attribution: '' }],
    ['tarpų autorystė', { attribution: '   ' }],
    ['autorystė su numatytosiomis plytelėmis', { attribution: 'Kita autorystė' }],
    ['netinkamas adresas su autoryste', { tilesUrl: 'https://tiles.example.com/map.png', attribution: 'Kita autorystė' }],
    ['tinkamas adresas be autorystės', { tilesUrl: CUSTOM_TILES }],
    ['tinkamas adresas su tuščia autoryste', { tilesUrl: CUSTOM_TILES, attribution: '' }],
    ['numatytasis adresas su kita autoryste', { tilesUrl: DEFAULT_TILES_URL, attribution: 'Kita autorystė' }],
  ])('numatytosios OSM plytelės su jų autoryste: %s', (_reason, options) => {
    const data = dataOf(buildMapHtml(VILNIUS, options));
    expect(data.tilesUrl).toBe(DEFAULT_TILES_URL);
    expect(data.attribution).toBe(DEFAULT_ATTRIBUTION);
    expect(data.darkTiles).toBe(true);
  });

  it('pasirinktinė autorystė perduodama kaip užkoduotas tekstas', () => {
    const data = dataOf(buildMapHtml(VILNIUS, { tilesUrl: CUSTOM_TILES, attribution: ' Plytelės © Pavyzdys ' }));
    expect(data.tilesUrl).toBe(CUSTOM_TILES);
    expect(data.attribution).toBe('Plytelės © Pavyzdys');
    expect(data.darkTiles).toBe(false);
  });

  it('piktybinis HTML pasirinktinėje autorystėje Leaflet pasiekia tik užkoduotas', () => {
    const attribution = '<img src=x onerror=alert(1)><a href="javascript:alert(2)">x</a>';
    const html = buildMapHtml(VILNIUS, { tilesUrl: CUSTOM_TILES, attribution });
    const { L } = runMapScript(html);

    const passed = (L.tileLayer.mock.calls[0] as unknown[])[1] as { attribution: string };
    expect(passed.attribution).toBe(escapeHtml(attribution));
    expect(passed.attribution).not.toMatch(/[<>"]/);
  });

  it('atmeta netinkamas koordinates', () => {
    expect(() => buildMapHtml({ ...VILNIUS, lat: 954 })).toThrow('Netinkamos koordinatės');
  });
});

describe('sugeneruoto script vykdymas su imituotu Leaflet', () => {
  it('sukuria žemėlapį, žymeklį su pavadinimu ir numatytąsias plyteles', () => {
    const { L, map, errorElement } = runMapScript(buildMapHtml(VILNIUS));

    expect(map.setView).toHaveBeenCalledWith([VILNIUS.lat, VILNIUS.lng], 15);
    expect(L.tileLayer).toHaveBeenCalledWith(DEFAULT_TILES_URL, expect.objectContaining({ attribution: DEFAULT_ATTRIBUTION }));
    expect(L.marker).toHaveBeenCalledTimes(1);
    expect(L.marker).toHaveBeenCalledWith([VILNIUS.lat, VILNIUS.lng], expect.objectContaining({ title: VILNIUS.title }));
    expect(L.polyline).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(errorElement.style.display).toBe('none');
  });

  it('tinkamas maršrutas nubraižomas, o kliento vieta pažymima', () => {
    const { L, map } = runMapScript(buildMapHtml(VILNIUS, { userPoint: A, route: [A, C] }));

    expect(L.marker).toHaveBeenCalledTimes(2);
    expect(L.marker).toHaveBeenLastCalledWith([A.lat, A.lng], expect.anything());
    expect(L.polyline).toHaveBeenCalledTimes(1);
    expect((L.polyline.mock.calls[0] as unknown[])[0]).toEqual([
      [A.lat, A.lng],
      [C.lat, C.lng],
    ]);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('maršrutas su netinkamu tašku nebraižomas', () => {
    const { L } = runMapScript(buildMapHtml(VILNIUS, { userPoint: A, route: [A, { lat: 1, lng: Infinity }, C] }));

    expect(L.polyline).not.toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalledTimes(2);
  });

  it('neįkėlus Leaflet rodomas klaidos pranešimas', () => {
    const html = buildMapHtml(VILNIUS);
    const { L, errorElement } = runMapScript(html, false);

    expect(errorElement.style.display).toBe('block');
    expect(L.map).not.toHaveBeenCalled();
    expect(html).toContain('Nepavyko parodyti žemėlapio');
  });
});
