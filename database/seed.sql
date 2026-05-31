-- ================================================================
-- AutoRent | seed.sql
-- Pradiniai duomenys testavimui ir demonstracijai
-- Prieš vykdant išvalo visas lenteles ir įrašo po 10 eilučių kiekvienoje
-- ================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `Bonusu_Naudojimas`;
TRUNCATE TABLE `Uzsakymo_Nuolaidos`;
TRUNCATE TABLE `Uzsakymo_Paslaugos`;
TRUNCATE TABLE `Automobilio_Grazinimo_Vieta`;
TRUNCATE TABLE `Automobilio_Atsiliepimai`;
TRUNCATE TABLE `Atsakingi_Automobiliai`;
TRUNCATE TABLE `Klientu_Palaikymas`;
TRUNCATE TABLE `Baudu_Registras`;
TRUNCATE TABLE `Kuro_Korteles`;
TRUNCATE TABLE `Kuro_Sanaudos`;
TRUNCATE TABLE `Draudimai`;
TRUNCATE TABLE `Remonto_Darbai`;
TRUNCATE TABLE `Automobiliu_Servisas`;
TRUNCATE TABLE `Rezervavimas`;
TRUNCATE TABLE `Nuolaidos`;
TRUNCATE TABLE `Papildomos_Paslaugos`;
TRUNCATE TABLE `Saskaitos`;
TRUNCATE TABLE `Mokejimai`;
TRUNCATE TABLE `Uzsakymai`;
TRUNCATE TABLE `Automobiliai`;
TRUNCATE TABLE `Pristatymo_Vietos`;
TRUNCATE TABLE `Darbuotojai`;
TRUNCATE TABLE `Klientai`;

-- ----------------------------------------------------------------
-- Klientai (IDs 1–10)
-- ----------------------------------------------------------------

INSERT INTO `Klientai` (`vardas`, `pavarde`, `el_pastas`, `telefono_nr`, `gimimo_data`, `registracijos_data`, `bonus_taskai`)
VALUES
('Jonas',    'Petrauskas',     'jonas.petrauskas@example.com',     '+37061234567', '1990-05-12', '2026-04-28 10:30:00', 150),
('Aistė',    'Kazlauskienė',   'aiste.kazlauskiene@example.com',   '+37069876543', '1985-08-24', '2026-04-29 14:45:00', 200),
('Tomas',    'Vaitkus',        'tomas.vaitkus@example.com',        '+37067788990', '1993-11-15', '2026-04-30 08:15:00',  50),
('Laura',    'Jankauskaitė',   'laura.jankauskaite@example.com',   '+37064567890', '1988-02-10', '2026-05-02 12:00:00', 300),
('Paulius',  'Jonaitis',       'paulius.jonaitis@example.com',     '+37060123456', '1995-07-30', '2026-05-05 17:30:00', 100),
('Gabija',   'Pakalniškytė',   'gabija.pakalniskyte@example.com',  '+37061239876', '1992-03-21', '2026-05-07 09:20:00', 250),
('Mantas',   'Šimkus',         'mantas.simkus@example.com',        '+37068991234', '1987-12-05', '2026-05-08 19:10:00', 400),
('Dovilė',   'Butkutė',        'dovile.butkute@example.com',       '+37065432109', '1994-06-14', '2026-05-12 15:05:00', 175),
('Karolis',  'Rutkauskas',     'karolis.rutkauskas@example.com',   '+37069987654', '1990-09-02', '2026-05-15 11:40:00',  50),
('Rasa',     'Grigaliūnaitė',  'rasa.grigaliunaite@example.com',   '+37061122334', '1986-01-28', '2026-05-18 13:55:00', 225);

-- ----------------------------------------------------------------
-- Pristatymo_Vietos (IDs 1–10)
-- ----------------------------------------------------------------

INSERT INTO `Pristatymo_Vietos` (`pavadinimas`, `adresas`, `miestas`)
VALUES
('Vilnius Centras',  'Gedimino pr. 1, Vilnius',          'Vilnius'),
('Kaunas Centras',   'Laisvės al. 10, Kaunas',           'Kaunas'),
('Klaipėda',         'Taikos pr. 20, Klaipėda',          'Klaipėda'),
('Šiauliai',         'Tilžės g. 5, Šiauliai',            'Šiauliai'),
('Panevėžys',        'Respublikos g. 15, Panevėžys',     'Panevėžys'),
('Alytus',           'Naujoji g. 30, Alytus',            'Alytus'),
('Marijampolė',      'Gedimino g. 5, Marijampolė',       'Marijampolė'),
('Utena',            'J. Basanavičiaus g. 3, Utena',     'Utena'),
('Mažeikiai',        'Laisvės g. 25, Mažeikiai',         'Mažeikiai'),
('Telšiai',          'Žemaitijos g. 7, Telšiai',         'Telšiai');

-- ----------------------------------------------------------------
-- Darbuotojai (IDs 1–11)
-- ----------------------------------------------------------------

INSERT INTO `Darbuotojai` (
    `vardas`, `pavarde`, `el_pastas`, `telefono_nr`, `pareigos`, `atlyginimas`, `isidarbinimo_data`, `slaptazodis`
) VALUES
('Admin',      'Autorent',      'admin@autorent.lt',                    '+37060000000', 'Administratorius',     2000.00, '2026-04-18', '$2b$12$P5UPwpwc6Cm7qILxpyeD0OjtHOUsPdgaC7n5WUTaY32hkLxcf.Hlu'),
('Tomas',      'Jonaitis',      'tomas.jonaitis@example.com',           '+37060010001', 'Administratorius',     1800.00, '2022-05-10', NULL),
('Rasa',       'Petrauskaitė',  'rasa.petrauskaite@example.com',        '+37060010002', 'Vadybininkas',         1600.00, '2021-03-15', NULL),
('Mindaugas',  'Kazlauskas',    'mindaugas.kazlauskas@example.com',     '+37060010003', 'Mechanikas',           1700.00, '2023-07-20', NULL),
('Inga',       'Simonaitytė',   'inga.simonaityte@example.com',         '+37060010004', 'Klientų aptarnavimas', 1500.00, '2020-09-10', NULL),
('Saulius',    'Jankauskas',    'saulius.jankauskas@example.com',       '+37060010005', 'Vadybininkas',         1650.00, '2019-12-01', NULL),
('Asta',       'Kudirkaitė',    'asta.kudirkaite@example.com',          '+37060010006', 'Administratorius',     1750.00, '2021-06-18', NULL),
('Viktoras',   'Povilaitis',    'viktoras.povilaitis@example.com',      '+37060010007', 'Mechanikas',           1800.00, '2022-11-05', NULL),
('Simas',      'Urbonas',       'simas.urbonas@example.com',            '+37060010008', 'Vadybininkas',         1550.00, '2020-04-25', NULL),
('Raimondas',  'Jasiūnas',      'raimondas.jasiunas@example.com',       '+37060010009', 'Klientų aptarnavimas', 1450.00, '2018-08-30', NULL);

-- ----------------------------------------------------------------
-- Automobiliai (IDs 21–30)
-- technikines_galiojimas — visos datos ateityje
-- ----------------------------------------------------------------

ALTER TABLE `Automobiliai` AUTO_INCREMENT = 21;

INSERT INTO `Automobiliai` (
   `marke`, `modelis`, `metai`, `numeris`, `vin_kodas`,
  `spalva`, `kebulo_tipas`, `pavarų_deze`, `variklio_turis`, `galia_kw`,
  `kuro_tipas`, `rida`, `sedimos_vietos`, `klimato_kontrole`, `navigacija`,
  `kaina_parai`, `automobilio_statusas`, `technikines_galiojimas`, `dabartine_vieta_id`, `pastabos`
) VALUES
('Toyota',        'Corolla',  2018, 'ABC123', 'JTDKB20U20345789', 'Sidabrinė', 'Sedanas',    'automatinė',        1.8,  90, 'hibridas',  85000, 5, TRUE,  TRUE,   40.00, 'laisvas',    '2027-06-15', 1, 'Puikus miesto automobilis'),
('Volkswagen',    'Golf',     2020, 'XYZ456', 'WVZZZ1KZAM124567', 'Juoda',     'Hečbekas',   'mechaninė',         2.0, 110, 'dyzelinas', 45000, 5, TRUE,  TRUE,   50.00, 'isnuomotas', '2026-08-10', 2, NULL),
('BMW',           'X5',       2019, 'BMW789', 'WBABT52000D98765', 'Balta',     'Visureigis', 'automatinė',        3.0, 190, 'dyzelinas', 65000, 5, TRUE,  TRUE,   80.00, 'laisvas',    '2027-12-20', 3, 'Prabangus ir galingas'),
('Mercedes-Benz', 'E-Class',  2021, 'MB500',  'WDD210341A123987', 'Pilka',     'Sedanas',    'automatinė',        2.0, 150, 'benzinas',  35000, 5, TRUE,  TRUE,   90.00, 'isnuomotas', '2027-03-10', 4, NULL),
('Audi',          'A4',       2017, 'AUD567', 'WAUZZZF47HA12654', 'Mėlyna',    'Sedanas',    'mechaninė',         1.8, 125, 'benzinas', 120000, 5, TRUE,  FALSE,  45.00, 'laisvas',    '2026-09-25', 5, 'Ekonomiškas pasirinkimas'),
('Ford',          'Focus',    2016, 'FOR888', 'WF05XXGCC5GG23123','Raudona',   'Hečbekas',   'mechaninė',         1.6,  85, 'benzinas',  98000, 5, FALSE, FALSE,  35.00, 'laisvas',    '2026-12-10', 6, NULL),
('Tesla',         'Model 3',  2022, 'TES999', '5YJ3E1EA7J123321', 'Balta',     'Sedanas',    'automatinė',        0.0, 283, 'elektra',   25000, 5, TRUE,  TRUE,  100.00, 'isnuomotas', '2027-07-05', 7, 'Naujausias modelis su autopilotu'),
('Honda',         'Civic',    2015, 'HON333', 'JHMFC1550F123890', 'Sidabrinė', 'Sedanas',    'mechaninė',         1.5,  88, 'benzinas', 140000, 5, FALSE, FALSE,  30.00, 'servise',    '2026-06-30', 8, 'Reikalingas smulkus remontas'),
('Nissan',        'Qashqai',  2018, 'NIS666', 'SJNFAAJ11U236547', 'Juoda',     'Visureigis', 'pusiau automatinė', 1.6,  96, 'benzinas',  78000, 5, TRUE,  TRUE,   55.00, 'laisvas',    '2026-11-15', 9, NULL),
('Skoda',         'Superb',   2020, 'SKD777', 'TMBJJ9NP2L128765', 'Žalia',     'Sedanas',    'automatinė',        2.0, 140, 'dyzelinas', 41000, 5, TRUE,  TRUE,   60.00, 'laisvas',    '2027-05-30', 10, 'Talpus ir komfortiškas');

-- ----------------------------------------------------------------
-- Uzsakymai — pirmoji partija (IDs 1–10)
-- ----------------------------------------------------------------

INSERT INTO `Uzsakymai` (
    `kliento_id`, `automobilio_id`, `darbuotojo_id`, `nuomos_data`,
    `grazinimo_data`, `paemimo_vietos_id`, `grazinimo_vietos_id`,
    `bendra_kaina`, `uzsakymo_busena`, `turi_papildomas_paslaugas`
) VALUES
(1,  23, 2, '2026-04-28', '2026-05-02', 1, 2,  150.00, 'patvirtinta', TRUE),
(2,  25, 4, '2026-05-01', '2026-06-14', 2, 3,  220.00, 'vykdoma',     FALSE),
(3,  22, 1, '2026-05-06', '2026-05-10', 3, 1,  180.00, 'užbaigta',    TRUE),
(4,  27, 5, '2026-05-12', '2026-05-18', 1, 4,  300.00, 'atšaukta',    FALSE),
(5,  21, 3, '2026-05-19', '2026-05-23', 4, 2,  200.00, 'patvirtinta', TRUE),
(6,  24, 2, '2026-05-26', '2026-06-01', 3, 5,  250.00, 'laukiama',    FALSE),
(7,  26, 4, '2026-05-27', '2026-06-09', 5, 1,  270.00, 'vykdoma',     TRUE),
(8,  28, 6, '2026-05-29', '2026-06-03', 2, 4,  350.00, 'užbaigta',    FALSE),
(9,  29, 7, '2026-06-02', '2026-06-08', 4, 3,  400.00, 'patvirtinta', TRUE),
(10, 30, 8, '2026-06-06', '2026-06-09', 1, 5,  500.00, 'laukiama',    FALSE);

-- ----------------------------------------------------------------
-- Atsakingi_Automobiliai
-- ----------------------------------------------------------------

INSERT INTO `Atsakingi_Automobiliai` (
    `darbuotojo_id`, `automobilio_id`, `pradzios_data`, `pabaigos_data`
) VALUES
(1,  23, '2026-04-27', '2026-05-15'),
(2,  25, '2026-04-28', '2026-05-10'),
(3,  22, '2026-04-29', NULL),
(4,  27, '2026-04-27', '2026-05-05'),
(5,  21, '2026-04-30', NULL),
(6,  24, '2026-04-27', '2026-05-02'),
(7,  26, '2026-04-28', NULL),
(8,  28, '2026-04-27', '2026-05-03'),
(9,  29, '2026-04-29', NULL),
(10, 30, '2026-04-27', '2026-05-01');

-- ----------------------------------------------------------------
-- Klientu_Palaikymas
-- ----------------------------------------------------------------

INSERT INTO `Klientu_Palaikymas` (
    `kliento_id`, `darbuotojo_id`, `tema`, `pranesimas`, `atsakymas`, `pateikimo_data`, `atsakymo_data`
) VALUES
(1, 3,    'Automobilio gedimas',         'Automobilis pradėjo skleisti keistus garsus važiuojant.',           'Jūsų automobilis buvo patikrintas, ir nustatyta, kad tai smulki techninė problema. Remontas atliktas.',             '2026-05-05 10:15:00', '2026-05-06 14:30:00'),
(2, NULL, 'Rezervacijos atšaukimas',     'Noriu atšaukti savo užsakymą, nes planai pasikeitė.',               NULL,                                                                                                               '2026-05-07 12:00:00', NULL),
(3, 5,    'Kainos klausimas',            'Ar galiu gauti nuolaidą ilgalaikei nuomai?',                        'Taip, ilgalaikėms nuomoms taikomos specialios nuolaidos. Susisiekite dėl išsamesnės informacijos.',               '2026-05-10 09:45:00', '2026-05-10 16:00:00'),
(4, NULL, 'Pamiršau daiktą automobilyje','Palikau telefoną nuomotame automobilyje. Kaip galėčiau jį atsiimti?',NULL,                                                                                                               '2026-05-12 14:20:00', NULL),
(5, 7,    'Sąskaitos klausimas',         'Kodėl mano sąskaitoje rodoma papildoma suma?',                      'Papildoma suma priskaičiuota už degalų trūkumą grąžinant automobilį.',                                            '2026-05-15 08:10:00', '2026-05-15 12:40:00'),
(6, 2,    'Automobilio keitimas',        'Ar galiu pakeisti rezervuotą automobilį į kitą modelį?',            'Taip, galima pakeisti automobilį, jei yra laisvų modelių. Prašome susisiekti.',                                   '2026-05-20 11:30:00', '2026-05-20 17:15:00'),
(7, NULL, 'Techninė problema',           'Negaliu prisijungti prie savo paskyros jūsų svetainėje.',           NULL,                                                                                                               '2026-05-25 15:50:00', NULL),
(8, 4,    'Apmokėjimo klausimas',        'Ar galiu sumokėti grynaisiais, kai atsiimsiu automobilį?',          'Taip, priimame ir grynųjų pinigų mokėjimus atsiimant automobilį.',                                               '2026-05-28 13:10:00', '2026-05-28 16:45:00'),
(9, 6,    'Papildomos paslaugos',        'Ar galima užsisakyti vaikišką kėdutę kartu su automobiliu?',        'Taip, už papildomą mokestį galima pridėti vaikišką kėdutę prie rezervacijos.',                                   '2026-06-02 09:00:00', '2026-06-02 12:20:00'),
(10,NULL, 'Skundas dėl aptarnavimo',     'Buvau nepatenkintas darbuotojo bendravimu nuomos punkte.',          NULL,                                                                                                               '2026-06-04 18:30:00', NULL);

-- ----------------------------------------------------------------
-- Automobilio_Atsiliepimai
-- ----------------------------------------------------------------

INSERT INTO `Automobilio_Atsiliepimai` (
    `kliento_id`, `automobilio_id`, `ivertinimas`, `komentaras`, `data`
) VALUES
(1,  23, 5, 'Labai patogus ir ekonomiškas automobilis. Važiavau ilgą kelionę – jokių problemų.',        '2026-05-10 10:30:00'),
(2,  25, 4, 'Automobilis buvo tvarkingas, bet salone jautėsi kvapas.',                                  '2026-05-12 14:20:00'),
(3,  22, 3, 'Vidutinė patirtis – automobilis veikė gerai, bet turėjo keletą įbrėžimų.',                 '2026-05-14 12:45:00'),
(4,  27, 5, 'Puikus pasirinkimas – patogus, ekonomiškas ir gerai prižiūrėtas.',                         '2026-05-15 08:55:00'),
(5,  21, 2, 'Automobilis buvo nešvarus, o stabdžiai atrodė susidėvėję.',                                '2026-05-18 18:40:00'),
(6,  24, 4, 'Labai malonu vairuoti, bet navigacija buvo pasenusi.',                                     '2026-05-20 09:15:00'),
(7,  26, 5, 'Viskas tobula – užsakysiu vėl!',                                                           '2026-05-22 16:00:00'),
(8,  28, 3, 'Automobilis buvo patogus, bet kuro sąnaudos buvo didesnės nei tikėjausi.',                 '2026-05-25 11:30:00'),
(9,  29, 1, 'Prasta patirtis – automobilis turėjo mechaninių problemų.',                                '2026-05-28 20:10:00'),
(10, 30, 4, 'Geras automobilis, bet kaina galėtų būti mažesnė.',                                        '2026-06-01 13:45:00');

-- ----------------------------------------------------------------
-- Uzsakymai — antroji partija (IDs 11–20)
-- ----------------------------------------------------------------

INSERT INTO `Uzsakymai` (
    `kliento_id`, `automobilio_id`, `darbuotojo_id`, `nuomos_data`,
    `grazinimo_data`, `paemimo_vietos_id`, `grazinimo_vietos_id`,
    `bendra_kaina`, `uzsakymo_busena`, `turi_papildomas_paslaugas`
) VALUES
(1,  23, 2, '2026-04-29', '2026-05-03', 1, 2,  150.00, 'patvirtinta', TRUE),
(2,  25, 4, '2026-05-03', '2026-06-16', 2, 3,  220.00, 'vykdoma',     FALSE),
(3,  22, 1, '2026-05-08', '2026-05-12', 3, 1,  180.00, 'užbaigta',    TRUE),
(4,  27, 5, '2026-05-14', '2026-05-20', 1, 4,  300.00, 'atšaukta',    FALSE),
(5,  21, 3, '2026-05-20', '2026-05-25', 4, 2,  200.00, 'patvirtinta', TRUE),
(6,  24, 2, '2026-05-28', '2026-06-04', 3, 5,  250.00, 'laukiama',    FALSE),
(7,  26, 4, '2026-05-30', '2026-06-09', 5, 1,  270.00, 'vykdoma',     TRUE),
(8,  28, 6, '2026-06-01', '2026-06-05', 2, 4,  350.00, 'užbaigta',    FALSE),
(9,  29, 7, '2026-06-03', '2026-06-09', 4, 3,  400.00, 'patvirtinta', TRUE),
(10, 30, 8, '2026-06-07', '2026-06-11', 1, 5,  500.00, 'laukiama',    FALSE);

-- ----------------------------------------------------------------
-- Automobiliu_Servisas
-- serviso_pradzios_data negali būti ateityje (triggeris)
-- ----------------------------------------------------------------

INSERT INTO `Automobiliu_Servisas` (
    `automobilio_id`, `serviso_pradzios_data`, `serviso_pabaigos_data`,
    `plovimas`, `salono_valymas`, `technine_apziura`, `tepalai_pakeisti`,
    `kaina`, `busena`
) VALUES
(21, '2026-04-28', '2026-04-29', TRUE,  TRUE,  FALSE, TRUE,  120.00, 'baigtas'),
(22, '2026-04-30', '2026-05-01', TRUE,  FALSE, TRUE,  TRUE,  250.00, 'baigtas'),
(23, '2026-05-03', NULL,         FALSE, FALSE, TRUE,  FALSE,  80.00, 'vyksta'),
(24, '2026-05-07', '2026-05-09', TRUE,  TRUE,  FALSE, FALSE, 150.00, 'baigtas'),
(25, '2026-05-10', NULL,         FALSE, TRUE,  TRUE,  TRUE,  300.00, 'vyksta'),
(26, '2026-05-14', '2026-05-15', TRUE,  FALSE, FALSE, TRUE,  100.00, 'baigtas'),
(27, '2026-05-18', '2026-05-19', FALSE, FALSE, TRUE,  TRUE,  200.00, 'baigtas'),
(28, '2026-05-21', NULL,         TRUE,  TRUE,  FALSE, FALSE, 180.00, 'vyksta'),
(29, '2026-05-25', NULL,         FALSE, TRUE,  TRUE,  TRUE,  320.00, 'laukia'),
(30, '2026-05-28', '2026-05-29', TRUE,  TRUE,  FALSE, TRUE,  140.00, 'baigtas');

-- ----------------------------------------------------------------
-- Kuro_Sanaudos
-- ----------------------------------------------------------------

INSERT INTO `Kuro_Sanaudos` (
    `automobilio_id`, `data`, `kuro_kiekis`, `kaina`
) VALUES
(21, '2026-04-28',  45.50,  90.00),
(22, '2026-04-29',  50.00, 100.00),
(23, '2026-04-30',  30.25,  60.50),
(24, '2026-05-01',  40.75,  85.00),
(25, '2026-05-03',  55.00, 110.00),
(26, '2026-05-05',  42.30,  84.60),
(27, '2026-05-07',  35.75,  71.50),
(28, '2026-05-08',  60.00, 120.00),
(29, '2026-05-09',  38.50,  77.00),
(30, '2026-05-12',  44.10,  88.20),
(21, '2026-05-14',  48.60,  97.20),
(22, '2026-05-15',  32.80,  65.60),
(23, '2026-05-18',  41.90,  83.80),
(24, '2026-05-20',  53.20, 106.40),
(25, '2026-05-21',  36.45,  72.90),
(26, '2026-05-22',  47.80,  95.60),
(27, '2026-05-25',  39.75,  79.50),
(28, '2026-05-27',  62.30, 124.60),
(29, '2026-05-29',  37.50,  75.00),
(30, '2026-06-01',  45.90,  91.80);

-- ----------------------------------------------------------------
-- Remonto_Darbai
-- ----------------------------------------------------------------

INSERT INTO `Remonto_Darbai` (
    `automobilio_id`, `remonto_pradzios_data`, `remonto_pabaigos_data`,
    `aprasymas`, `detales_pakeistos`, `garantija_menesiais`, `meistras`,
    `serviso_pavadinimas`, `kaina`, `busena`
) VALUES
(21, '2026-04-28', '2026-04-30', 'Variklio remontas',                   'Paskirstymo diržas, vandens pompa',  12, 'Tomas Kazlauskas',      'AutoFix Servisas',   450.00, 'baigtas'),
(22, '2026-04-30', '2026-05-02', 'Stabdžių sistemos keitimas',          'Stabdžių diskai ir kaladėlės',        6, 'Rimas Jonaitis',        'Fast Auto',          320.00, 'baigtas'),
(23, '2026-05-03', NULL,         'Kėbulo dažymas',                      NULL,                                NULL, 'Lukas Petrauskas',      'ColorCar',           600.00, 'vyksta'),
(24, '2026-05-07', '2026-05-09', 'Sankabos keitimas',                   'Sankabos komplektas',                24, 'Marius Žilinskas',      'Top Repair',         750.00, 'baigtas'),
(25, '2026-05-10', NULL,         'Elektrinės sistemos remontas',        'Akumuliatorius, laidai',              6, 'Dovydas Stankevičius',  'ElectroFix',         280.00, 'vyksta'),
(26, '2026-05-14', '2026-05-15', 'Kondicionieriaus remontas',           'Kompresorius',                       12, 'Aurimas Vaitkus',       'CoolCar Servisas',   200.00, 'baigtas'),
(27, '2026-05-18', '2026-05-19', 'Pakabos remontas',                    'Amortizatoriai, stabilizatoriai',    18, 'Andrius Vilkas',        'Suspension Masters', 500.00, 'baigtas'),
(28, '2026-05-21', NULL,         'Starterio remontas',                  'Starteris',                          12, 'Gintaras Lekavičius',   'Quick Fix',          350.00, 'vyksta'),
(29, '2026-05-25', NULL,         'Turbinos remontas',                   'Turbina, vamzdynai',                 12, 'Vaidotas Šimkus',       'Turbo Pro',          680.00, 'laukia'),
(30, '2026-05-28', '2026-05-29', 'Duslintuvo keitimas',                 'Duslintuvas',                         6, 'Julius Jankauskas',     'Exhaust Experts',    250.00, 'baigtas'),
(21, '2026-06-01', NULL,         'Kompiuterinė diagnostika',            NULL,                                NULL, 'Martynas Gailius',      'Diagnozė LT',        100.00, 'vyksta'),
(22, '2026-06-02', '2026-06-04', 'Vairo sistemos remontas',             'Vairo traukės',                      12, 'Paulius Stasiūnas',     'Steering Fix',       400.00, 'baigtas'),
(23, '2026-06-04', NULL,         'Degalų siurblio keitimas',            'Degalų siurblys',                    12, 'Tadas Žukas',           'FuelTech',           350.00, 'laukia'),
(24, '2026-06-06', '2026-06-07', 'Langų pakėlimo mechanizmo keitimas', 'Langų mechanizmas',                   6, 'Arnas Kvedys',          'GlassFix',           180.00, 'baigtas'),
(25, '2026-06-08', NULL,         'Pavarų dėžės remontas',              'Pavarų dėžės guoliai',               24, 'Vytautas Mažeika',      'Gearbox Center',     900.00, 'laukia');

-- ----------------------------------------------------------------
-- Draudimai
-- ----------------------------------------------------------------

INSERT INTO `Draudimai` (
    `automobilio_id`, `draudimo_tipas`, `galiojimo_pradzia`, `galiojimo_pabaiga`, `suma`
) VALUES
(21, 'civilinis', '2026-04-27', '2027-04-27', 120.00),
(22, 'kasko',     '2026-04-27', '2027-04-27', 450.00),
(23, 'civilinis', '2026-04-28', '2027-04-28', 130.00),
(24, 'kasko',     '2026-04-28', '2027-04-28', 500.00),
(25, 'civilinis', '2026-04-29', '2027-04-29', 140.00),
(26, 'kasko',     '2026-04-29', '2027-04-29', 470.00),
(27, 'civilinis', '2026-04-30', '2027-04-30', 125.00),
(28, 'kasko',     '2026-04-30', '2027-04-30', 480.00),
(29, 'civilinis', '2026-05-01', '2027-05-01', 135.00),
(30, 'kita',      '2026-05-01', '2027-05-01', 300.00);

-- ----------------------------------------------------------------
-- Baudu_Registras
-- ----------------------------------------------------------------

INSERT INTO `Baudu_Registras` (
    `automobilio_id`, `baudos_priezastis`, `data`, `suma`, `kliento_id`
) VALUES
(21, 'Greičio viršijimas (+20 km/h)',          '2026-04-28',  50.00, 3),
(22, 'Neleistinas parkavimas',                 '2026-04-30',  30.00, 5),
(23, 'Važiavimas be saugos diržo',             '2026-05-02',  20.00, 2),
(24, 'Raudono šviesoforo nepaisymas',          '2026-05-05', 100.00, 7),
(25, 'Netinkama eismo juosta',                 '2026-05-07',  25.00, 1),
(26, 'Greičio viršijimas (+30 km/h)',          '2026-05-09',  80.00, 4),
(27, 'Automobilio palikimas ant žalios vejos', '2026-05-12',  40.00, 8),
(28, 'Važiavimas be techninės apžiūros',       '2026-05-15', 120.00, 6),
(29, 'Neapmokėtas mokamas kelias',             '2026-05-19',  15.00, 9),
(30, 'Parkavimas neįgaliųjų vietoje',          '2026-05-22', 150.00, 10),
(21, 'Telefono naudojimas vairuojant',         '2026-05-25',  35.00, 3),
(23, 'Neįjungti žibintai dienos metu',         '2026-05-28',  10.00, 2),
(25, 'Važiavimas dviračių taku',               '2026-06-01',  70.00, 1),
(27, 'Netinkamas lenkimas',                    '2026-06-03',  90.00, 8),
(29, 'Krovinio svorio viršijimas',             '2026-06-05', 200.00, 9);

-- ----------------------------------------------------------------
-- Papildomos_Paslaugos
-- ----------------------------------------------------------------

INSERT INTO `Papildomos_Paslaugos` (
    `pavadinimas`, `aprasymas`, `kaina`
) VALUES
('Vaikiška kėdutė',                    'Saugos kėdutė vaikams nuo 9 mėn. iki 12 metų.',                        5.00),
('GPS navigacija',                     'Naujausia GPS sistema su atnaujintais žemėlapiais.',                    7.00),
('Papildomas vairuotojas',             'Galimybė registruoti antrą vairuotoją prie nuomos sutarties.',         10.00),
('Pilnas draudimas',                   'Pilnas draudimas, padengiantis visus galimus nuostolius.',              20.00),
('Stogo bagažinė',                     'Papildoma vieta bagažui kelionėms su daugiau daiktų.',                  8.00),
('Wi-Fi modemas',                      'Mobilus Wi-Fi interneto ryšys automobilyje (neriboti duomenys).',       6.50),
('Žiemos paketas',                     'Žieminės padangos, langų skystis ir grandinės slidžioms sąlygoms.',   12.00),
('Automobilio pristatymas',            'Automobilio pristatymas į pasirinktą vietą nuomos pradžiai.',          15.00),
('Automobilio grąžinimas kitoje vietoje','Galimybė grąžinti automobilį kitoje vietoje nei paėmimo vieta.',    25.00),
('Kuro paslauga',                      'Pilnas kuro bakas nuomos pradžioje su galimybe grąžinti tuščią.',      30.00);

-- ----------------------------------------------------------------
-- Uzsakymo_Paslaugos
-- ----------------------------------------------------------------

INSERT INTO `Uzsakymo_Paslaugos` (`uzsakymo_id`, `paslaugos_id`) VALUES
(11, 1),
(11, 4),
(13, 2),
(13, 5),
(15, 3),
(15, 6),
(17, 7),
(17, 8),
(19, 9),
(19, 10);

-- ----------------------------------------------------------------
-- Rezervavimas
-- ----------------------------------------------------------------

INSERT INTO `Rezervavimas` (
    `kliento_id`, `automobilio_id`, `rezervacijos_pradzia`, `rezervacijos_pabaiga`, `busena`
) VALUES
(1,  23, '2026-05-20', '2026-05-25', 'patvirtinta'),
(2,  25, '2026-05-22', '2026-05-28', 'laukia'),
(3,  22, '2026-05-25', '2026-05-29', 'patvirtinta'),
(4,  27, '2026-05-15', '2026-05-20', 'atšaukta'),
(5,  21, '2026-06-01', '2026-06-05', 'patvirtinta'),
(6,  24, '2026-06-06', '2026-06-12', 'laukia'),
(7,  26, '2026-06-07', '2026-06-11', 'patvirtinta'),
(8,  28, '2026-05-28', '2026-06-02', 'atšaukta'),
(9,  29, '2026-06-08', '2026-06-14', 'patvirtinta'),
(10, 30, '2026-06-09', '2026-06-16', 'laukia');

-- ----------------------------------------------------------------
-- Nuolaidos
-- ----------------------------------------------------------------

INSERT INTO `Nuolaidos` (
    `pavadinimas`, `procentas`, `galiojimo_pradzia`, `galiojimo_pabaiga`
) VALUES
('Pavasario akcija',              10.00, '2026-04-27', '2026-05-31'),
('Lojalaus kliento nuolaida',     15.00, '2026-01-01', '2026-12-31'),
('Vasaros specialus pasiūlymas',  12.50, '2026-06-01', '2026-08-31'),
('Savaitgalio nuolaida',           5.00, '2026-04-27', '2026-06-30'),
('Ilgalaikės nuomos nuolaida',    20.00, '2026-01-01', '2026-12-31'),
('Kalėdinė akcija',               25.00, '2026-12-01', '2026-12-31'),
('Naujoko nuolaida',               8.00, '2026-04-27', '2026-06-30'),
('Rudens pasiūlymas',             10.00, '2026-09-01', '2026-10-31'),
('Juodojo penktadienio nuolaida', 30.00, '2026-11-29', '2026-11-30'),
('Gimtadienio nuolaida',          18.00, '2026-01-01', '2026-12-31');

-- ----------------------------------------------------------------
-- Uzsakymo_Nuolaidos
-- ----------------------------------------------------------------

INSERT INTO `Uzsakymo_Nuolaidos` (`uzsakymo_id`, `nuolaidos_id`) VALUES
(11, 2),
(13, 5),
(15, 7),
(17, 1),
(19, 10);

-- ----------------------------------------------------------------
-- Kuro_Korteles
-- ----------------------------------------------------------------

INSERT INTO `Kuro_Korteles` (
    `automobilio_id`, `korteles_numeris`, `galiojimo_pabaiga`
) VALUES
(21, 'FK-001-2026', '2027-04-28'),
(22, 'FK-002-2026', '2027-04-29'),
(23, 'FK-003-2026', '2027-04-30'),
(24, 'FK-004-2026', '2027-05-01'),
(25, 'FK-005-2026', '2027-05-05'),
(26, 'FK-006-2026', '2027-05-07'),
(27, 'FK-007-2026', '2027-05-09'),
(28, 'FK-008-2026', '2027-05-12'),
(29, 'FK-009-2026', '2027-05-15'),
(30, 'FK-010-2026', '2027-05-18');

-- ----------------------------------------------------------------
-- Bonusu_Naudojimas
-- ----------------------------------------------------------------

INSERT INTO `Bonusu_Naudojimas` (
    `kliento_id`, `uzsakymo_id`, `panaudoti_taskai`, `nuolaidos_id`, `data`
) VALUES
(1, 11, 150, 2, '2026-05-02 12:00:00'),
(3, 13, 200, 5, '2026-05-08 14:30:00'),
(5, 15, 100, 7, '2026-05-20 16:45:00'),
(7, 17, 250, 1, '2026-05-27 10:15:00'),
(9, 19, 300, 10,'2026-06-03 18:00:00');

-- ----------------------------------------------------------------
-- Saskaitos
-- ----------------------------------------------------------------

INSERT INTO `Saskaitos` (`uzsakymo_id`, `suma`, `saskaitos_data`) VALUES
(1,  150.00, '2026-05-02 15:00:00'),
(2,  220.00, '2026-05-01 12:00:00'),
(3,  180.00, '2026-05-10 10:30:00'),
(5,  200.00, '2026-05-23 14:00:00'),
(6,  250.00, '2026-06-01 09:45:00'),
(7,  270.00, '2026-05-27 16:20:00'),
(8,  350.00, '2026-06-03 11:10:00'),
(9,  400.00, '2026-06-02 13:30:00'),
(10, 500.00, '2026-06-06 17:00:00'),
(11, 150.00, '2026-04-29 08:50:00');

-- ----------------------------------------------------------------
-- Mokejimai
-- ----------------------------------------------------------------

INSERT INTO `Mokejimai` (`uzsakymo_id`, `suma`, `mokejimo_data`, `mokejimo_tipas`) VALUES
(1,  150.00, '2026-05-02 15:30:00', 'kortele'),
(3,  180.00, '2026-05-10 11:00:00', 'bankinis pavedimas'),
(5,  200.00, '2026-05-23 14:30:00', 'kortele'),
(6,  250.00, '2026-06-01 10:00:00', 'grynieji'),
(7,  270.00, '2026-05-27 17:00:00', 'kortele'),
(8,  350.00, '2026-06-03 11:45:00', 'grynieji'),
(9,  400.00, '2026-06-02 14:00:00', 'paypal'),
(10, 500.00, '2026-06-06 17:30:00', 'bankinis pavedimas'),
(11, 150.00, '2026-04-29 09:15:00', 'kortele'),
(13, 180.00, '2026-05-12 13:00:00', 'kortele');

-- ----------------------------------------------------------------
-- Automobilio_Grazinimo_Vieta
-- ----------------------------------------------------------------

INSERT INTO `Automobilio_Grazinimo_Vieta` (
    `automobilio_id`, `vietos_id`
) VALUES
(21, 1),
(22, 2),
(23, 3),
(24, 4),
(25, 5),
(26, 1),
(27, 2),
(28, 3),
(29, 4),
(30, 5);


SET FOREIGN_KEY_CHECKS = 1;
