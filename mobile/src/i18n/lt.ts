// Bendri lietuviški sąsajos tekstai.
export const lt = {
  common: {
    appName: 'AutoRent',
    loading: 'Kraunama…',
    retry: 'Bandyti dar kartą',
    cancel: 'Atšaukti',
    confirm: 'Patvirtinti',
    close: 'Uždaryti',
    back: 'Atgal',
    save: 'Išsaugoti',
    yes: 'Taip',
    no: 'Ne',
  },
  tabs: {
    cars: 'Automobiliai',
    reservations: 'Rezervacijos',
    account: 'Paskyra',
  },
  // Kalendorių pavadinimai.
  dates: {
    weekdays: ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'],
    months: [
      'sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis',
      'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis',
    ],
  },
  // Pirmojo paleidimo ekranas.
  onboarding: {
    headline: 'Atrask automobilį, kuris tavo kelionę pavers ypatinga.',
    slide: 'Pradėk kelionę',
    slideHint: 'Patraukite mygtuką į dešinę arba aktyvinkite jį, kad pradėtumėte naudotis programėle',
    skip: 'Tęsti',
    skipHint: 'Atidaryti programėlę',
  },
  // Paieškos skydelis ir automobilių kortelės.
  search: {
    heading: 'Rask savo automobilį',
    location: 'Paėmimo vieta',
    from: 'Nuo',
    to: 'Iki',
    submit: 'Ieškoti',
    anyLocation: 'Visi padaliniai',
    chooseDate: 'Pasirinkti',
  },
  vehicle: {
    perDay: '/ diena',
    reserveNow: 'Rezervuoti dabar',
    expand: 'Išskleisti automobilio informaciją',
    collapse: 'Suskleisti automobilio informaciją',
  },
  brands: {
    title: 'Gamintojai',
    all: 'Visi',
  },
  // Dizaino peržiūros ekranas (tik kūrimo režimu).
  preview: {
    title: 'Dizaino peržiūra',
    open: 'Dizaino peržiūra',
    note: 'Pavyzdiniai duomenys – tik dizaino peržiūrai',
    search: 'Paieškos skydelis',
    cards: 'Automobilių kortelės',
    sampleBadge: 'Pavyzdys',
    map: 'Žemėlapio ekrano dalys',
    sheetBody: 'Čia rodoma išsami automobilio informacija: techniniai duomenys, paėmimo vieta ir nuomos sąlygos.',
    controls: 'Mygtukai ir laukai',
    chips: { price_asc: 'Pigiausi', price_desc: 'Brangiausi', newest: 'Naujausi' },
    badges: { success: 'Patvirtinta', warning: 'Laukia', danger: 'Atšaukta', info: 'Informacija' },
    field: 'Teksto laukas',
    fieldHint: 'Pagalbinis tekstas po lauku',
    states: 'Būsenos',
    emptyTitle: 'Tuščia būsena',
    emptyMessage: 'Taip atrodo ekranas, kai nėra ką rodyti.',
    errorMessage: 'Taip atrodo klaidos pranešimas.',
  },
  auth: {
    sessionExpired: 'Sesija baigėsi. Prisijunkite iš naujo.',
  },
} as const;