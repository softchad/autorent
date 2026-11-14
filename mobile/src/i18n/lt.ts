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
    skip: 'Praleisti',
    skipHint: 'Praleisti įžangą ir atidaryti programėlę',
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
} as const;