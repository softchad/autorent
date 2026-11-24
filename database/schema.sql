-- ================================================================
-- AutoRent | schema.sql
-- Duomenų bazės struktūra — lentelės išdėstytos priklausomybių tvarka
-- ================================================================

-- ----------------------------------------------------------------
-- Pagrindiniai subjektai (be priklausomybių)
-- ----------------------------------------------------------------

-- Klientai — sistemos naudotojai su bonus taškų sistema; slaptazodis NULL reiškia, kad klientas dar neturi savo prisijungimo (įrašą sukūrė darbuotojas) arba prisijungia tik per Google - atskira, ne darbuotojo, paskyros sistema.
CREATE TABLE `Klientai` (
  `kliento_id`         INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `vardas`             VARCHAR(255) NOT NULL,
  `pavarde`            VARCHAR(255) NOT NULL,
  `el_pastas`          VARCHAR(255) NOT NULL UNIQUE CHECK (`el_pastas` LIKE '%_@_%._%'),
  `telefono_nr`        VARCHAR(255) NOT NULL,
  `gimimo_data`        DATE         NOT NULL,
  `registracijos_data` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `slaptazodis`        VARCHAR(255) NULL,
  -- Kliento token_version lyginama su JWT ver lauku backend/app/api/deps.py; versijos padidinimas atšaukia paskyros turimas sesijas nepakeičiant jos ID.
  `token_version`      INTEGER      NOT NULL DEFAULT 0
);

-- Darbuotojai — įmonės personalas su pareigomis ir atlyginimu
CREATE TABLE `Darbuotojai` (
  `darbuotojo_id`    INTEGER       PRIMARY KEY AUTO_INCREMENT,
  `vardas`           VARCHAR(255)  NOT NULL,
  `pavarde`          VARCHAR(255)  NOT NULL,
  `el_pastas`        VARCHAR(255)  NOT NULL UNIQUE CHECK (`el_pastas` LIKE '%_@_%._%'),
  `telefono_nr`      VARCHAR(255)  NOT NULL,
  `pareigos`         VARCHAR(255)  NOT NULL,
  `atlyginimas`      DECIMAL(10,2) NOT NULL,
  `isidarbinimo_data` DATE         NOT NULL,
  `slaptazodis`      VARCHAR(255)  NULL,
  -- Ta pati priežastis, kaip Klientai.token_version aukščiau.
  `token_version`    INTEGER       NOT NULL DEFAULT 0
);

-- Pristatymo_Vietos — paėmimo ir grąžinimo punktai Lietuvoje
CREATE TABLE `Pristatymo_Vietos` (
  `vietos_id`   INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `pavadinimas` VARCHAR(255) NOT NULL,
  `adresas`     VARCHAR(255) NOT NULL,
  `miestas`     VARCHAR(255) NOT NULL
);

-- ----------------------------------------------------------------
-- Automobiliai (referencuoja Pristatymo_Vietos)
-- ----------------------------------------------------------------

-- Automobiliai — parko transporto priemonės su techniniais duomenimis
CREATE TABLE `Automobiliai` (
  `automobilio_id`       INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `marke`                VARCHAR(255) NOT NULL,
  `modelis`              VARCHAR(255) NOT NULL,
  `metai`                INTEGER      NOT NULL,
  `numeris`              VARCHAR(255) NOT NULL UNIQUE,
  `vin_kodas`            VARCHAR(17)  NOT NULL UNIQUE,
  `spalva`               VARCHAR(255) NOT NULL,
  `kebulo_tipas`         VARCHAR(255) NOT NULL,
  `pavaru_deze`          ENUM('mechaninė', 'automatinė', 'pusiau automatinė') NOT NULL,
  `variklio_turis`       DECIMAL(3,1) NOT NULL,
  `galia_kw`             INTEGER      NOT NULL,
  `kuro_tipas`           ENUM('benzinas', 'dyzelinas', 'elektra', 'hibridas', 'dujos') NOT NULL,
  `rida`                 INTEGER      NOT NULL,
  `sedimos_vietos`       INTEGER      NOT NULL,
  `klimato_kontrole`     BOOLEAN      NOT NULL DEFAULT FALSE,
  `navigacija`           BOOLEAN      NOT NULL DEFAULT FALSE,
  `kaina_parai`          DECIMAL(10,2) NOT NULL,
  `automobilio_statusas` ENUM('laisvas', 'isnuomotas', 'servise', 'remonte') NOT NULL,
  `technikines_galiojimas` DATE       NOT NULL,
  `dabartine_vieta_id`   INTEGER      NOT NULL,
  `pastabos`             TEXT
);

-- ----------------------------------------------------------------
-- Veikla: užsakymai, rezervacijos, sąskaitos
-- ----------------------------------------------------------------

-- Uzsakymai — aktyvios nuomos su kaina, statusu ir papildomomis paslaugomis
CREATE TABLE `Uzsakymai` (
  `uzsakymo_id`              INTEGER       PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`               INTEGER       NOT NULL,
  `automobilio_id`           INTEGER       NOT NULL,
  `darbuotojo_id`            INTEGER       NOT NULL,
  `nuomos_data`              DATE          NOT NULL,
  `grazinimo_data`           DATE          NOT NULL,
  `paemimo_vietos_id`        INTEGER       NOT NULL,
  `grazinimo_vietos_id`      INTEGER       NOT NULL,
  `bendra_kaina`             DECIMAL(10,2) NOT NULL,
  `uzsakymo_busena`          ENUM('laukiama', 'patvirtinta', 'vykdoma', 'užbaigta', 'atšaukta') NOT NULL,
  `turi_papildomas_paslaugas` BOOLEAN      NOT NULL DEFAULT FALSE,
  -- fiksuota (ne procentinė) nuolaidos kodo suma, pritaikyta sukūrimo metu; NIEKADA nebekinta per visą užsakymo gyvavimą (žr. backend/app/api/endpoints/order.py update_order kainos pertaikymo komentarą).
  `taikyta_nuolaida_eur`     DECIMAL(10,2) NOT NULL DEFAULT 0,
  `bazine_kaina_parai`       DECIMAL(18,8) NULL
);

-- Rezervavimas — išankstinės rezervacijos prieš patvirtinant užsakymą
CREATE TABLE `Rezervavimas` (
  `rezervacijos_id`     INTEGER PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`          INTEGER NOT NULL,
  `automobilio_id`      INTEGER NOT NULL,
  `rezervacijos_pradzia` DATE   NOT NULL,
  `rezervacijos_pabaiga` DATE   NOT NULL,
  `busena`              ENUM('patvirtinta', 'atšaukta', 'laukia') NOT NULL,
  -- Rezervacijos paros tarifas užfiksuojamas sukūrimo metu, kad parko kainų pakeitimai nekeistų rezervacijos vertės; NULL reiškia nežinomą istorinį tarifą, kurį customer.py turi įvertinti formuodamas atsakymą.
  `kaina_parai`         DECIMAL(10,2) NULL,
  CHECK (`rezervacijos_pabaiga` > `rezervacijos_pradzia`)
);

-- Saskaitos — finansiniai dokumentai susieti su užsakymais
CREATE TABLE `Saskaitos` (
  `saskaitos_id`  INTEGER       PRIMARY KEY AUTO_INCREMENT,
  -- UNIQUE - vienas užsakymas gali turėti TIK VIENĄ sąskaitą (1:1 ryšys); be šio apribojimo du vienu metu ateinantys createInvoice kreipiniai abu praeitų "ar jau yra" patikrą (žr. backend/app/api/endpoints/invoice.py) PRIEŠ bet kuriam užsicommit'inant ir sukurtų DVI sąskaitas tam pačiam užsakymui .
  `uzsakymo_id`   INTEGER       NOT NULL UNIQUE,
  `suma`          DECIMAL(10,2) NOT NULL,
  `saskaitos_data` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gavejo_vardas` VARCHAR(255) NULL,
  `gavejo_pavarde` VARCHAR(255) NULL
);

-- ----------------------------------------------------------------
-- Klientų aptarnavimas
-- ----------------------------------------------------------------

-- Pokalbiai — kliento aptarnavimo byla (viena konkreti problema, kelios žinutės vienoje byloje, ne vienas klausimas+atsakymas įraše); busena reiškia KAS TURI VEIKTI toliau, ne vien "atsakyta/neatsakyta".
CREATE TABLE `Pokalbiai` (
  `pokalbio_id`                   INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`                    INTEGER      NOT NULL,
  `darbuotojo_id`                 INTEGER      NULL,
  `tema`                          VARCHAR(150) NOT NULL,
  `kategorija`                    ENUM('rezervacija','atsiemimas_grazinimas','automobilis','saskaita','paskyra','kita') NOT NULL DEFAULT 'kita',
  `busena`                        ENUM('atvira','sprendziama','laukiama_kliento','isspresta') NOT NULL DEFAULT 'atvira',
  `rezervacijos_id`               INTEGER      NULL,
  `sprendimo_santrauka`           TEXT         NULL,
  `kliento_paskutinis_matytas`    INTEGER      NULL,
  `darbuotojo_paskutinis_matytas` INTEGER      NULL,
  `sukurimo_data`                 TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atnaujinimo_data`              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pokalbio_Zinutes — viešos, klientui IR darbuotojui matomos žinutės; niekada neperrašomos - klaida taisoma nauja žinute, ne UPDATE.
CREATE TABLE `Pokalbio_Zinutes` (
  `zinutes_id`      INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `pokalbio_id`     INTEGER      NOT NULL,
  `autoriaus_tipas` ENUM('klientas','darbuotojas') NOT NULL,
  `kliento_id`      INTEGER      NULL,
  `darbuotojo_id`   INTEGER      NULL,
  `tekstas`         TEXT         NOT NULL,
  `sukurimo_data`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pokalbio_Pastabos — VIDINĖS pastabos, atskira lentelė (ne CSS-paslėpta žymė Pokalbio_Zinutes viduje), kad klientui skirtas API endpointas jų fiziškai negalėtų atsitiktinai grąžinti.
CREATE TABLE `Pokalbio_Pastabos` (
  `pastabos_id`   INTEGER   PRIMARY KEY AUTO_INCREMENT,
  `pokalbio_id`   INTEGER   NOT NULL,
  `darbuotojo_id` INTEGER   NOT NULL,
  `tekstas`       TEXT      NOT NULL,
  `sukurimo_data` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lojalumo_Atlygiai — kliento uždirbti atlygiai už kas 5 užbaigtas nuomas; etapo_numeris = kiek penketukų nuomų jau uždirbta (1, 2, 3...), unikalu kiekvienam klientui - taip vienas etapas negali sukurti dviejų atlygių net jei būsena perskaičiuojama pakartotinai (žr. backend customer_loyalty.py).
CREATE TABLE `Lojalumo_Atlygiai` (
  `atlygio_id`      INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`      INTEGER      NOT NULL,
  `etapo_numeris`   INTEGER      NOT NULL,
  `sukurimo_data`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `busena`          ENUM('neisnaudotas', 'isnaudotas') NOT NULL DEFAULT 'neisnaudotas',
  `panaudojimo_data` TIMESTAMP   NULL,
  UNIQUE (`kliento_id`, `etapo_numeris`)
);

-- Nuolaidos_Kodai — "AUTORENT" + 6 skaitmenys formato kodai, išduoti klientui arba automatiškai per lojalumo programą (kilme='lojalumas'), arba darbuotojo ranka sprendžiant aptarnavimo problemą (kilme='aptarnavimas'); žr. backend discount_code_service.py.
CREATE TABLE `Nuolaidos_Kodai` (
  `kodo_id`           INTEGER       PRIMARY KEY AUTO_INCREMENT,
  `kodas`             VARCHAR(20)   NOT NULL UNIQUE,
  `kliento_id`        INTEGER       NOT NULL,
  `verte_eur`         DECIMAL(10,2) NOT NULL,
  `kilme`             ENUM('lojalumas', 'aptarnavimas') NOT NULL,
  `pastaba`           VARCHAR(255)  NULL,
  `sukurimo_data`     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `panaudojimo_data`  TIMESTAMP     NULL
);

-- ================================================================
-- Užsienio raktai (sugrupuoti pagal lentelę)
-- ================================================================

ALTER TABLE `Automobiliai`
  ADD FOREIGN KEY (`dabartine_vieta_id`) REFERENCES `Pristatymo_Vietos` (`vietos_id`);

ALTER TABLE `Uzsakymai`
  ADD FOREIGN KEY (`kliento_id`)          REFERENCES `Klientai`          (`kliento_id`),
  ADD FOREIGN KEY (`automobilio_id`)      REFERENCES `Automobiliai`      (`automobilio_id`),
  ADD FOREIGN KEY (`darbuotojo_id`)       REFERENCES `Darbuotojai`       (`darbuotojo_id`),
  ADD FOREIGN KEY (`paemimo_vietos_id`)   REFERENCES `Pristatymo_Vietos` (`vietos_id`),
  ADD FOREIGN KEY (`grazinimo_vietos_id`) REFERENCES `Pristatymo_Vietos` (`vietos_id`);

ALTER TABLE `Rezervavimas`
  ADD FOREIGN KEY (`kliento_id`)     REFERENCES `Klientai`     (`kliento_id`),
  ADD FOREIGN KEY (`automobilio_id`) REFERENCES `Automobiliai` (`automobilio_id`);

ALTER TABLE `Saskaitos`
  ADD FOREIGN KEY (`uzsakymo_id`) REFERENCES `Uzsakymai` (`uzsakymo_id`);

ALTER TABLE `Lojalumo_Atlygiai`
  ADD FOREIGN KEY (`kliento_id`) REFERENCES `Klientai` (`kliento_id`);

ALTER TABLE `Nuolaidos_Kodai`
  ADD FOREIGN KEY (`kliento_id`) REFERENCES `Klientai` (`kliento_id`);

ALTER TABLE `Pokalbiai`
  ADD FOREIGN KEY (`kliento_id`)      REFERENCES `Klientai`     (`kliento_id`),
  ADD FOREIGN KEY (`darbuotojo_id`)   REFERENCES `Darbuotojai`  (`darbuotojo_id`),
  ADD FOREIGN KEY (`rezervacijos_id`) REFERENCES `Rezervavimas` (`rezervacijos_id`);

ALTER TABLE `Pokalbio_Zinutes`
  ADD FOREIGN KEY (`pokalbio_id`)   REFERENCES `Pokalbiai`   (`pokalbio_id`),
  ADD FOREIGN KEY (`kliento_id`)    REFERENCES `Klientai`    (`kliento_id`),
  ADD FOREIGN KEY (`darbuotojo_id`) REFERENCES `Darbuotojai` (`darbuotojo_id`);

ALTER TABLE `Pokalbio_Pastabos`
  ADD FOREIGN KEY (`pokalbio_id`)   REFERENCES `Pokalbiai`   (`pokalbio_id`),
  ADD FOREIGN KEY (`darbuotojo_id`) REFERENCES `Darbuotojai` (`darbuotojo_id`);

-- ================================================================
-- Mobiliosios programėlės lentelės (tas pats turinys kaip database/migrations/)
-- ================================================================

-- Laikinas automobilio laikymas, kol klientas programėlėje peržiūri ir patvirtina rezervaciją.
-- Laikymas blokuoja automobilį kitiems klientams tik kol busena = 'aktyvus' IR galioja_iki > dabar (UTC).

CREATE TABLE `Rezervaciju_Laikymai` (
  `laikymo_id`      INTEGER  PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`      INTEGER  NOT NULL,
  `automobilio_id`  INTEGER  NOT NULL,
  `pradzia`         DATE     NOT NULL,
  `pabaiga`         DATE     NOT NULL,
  -- Laikai saugomi UTC, kad galiojimas nepriklausytų nuo serverio laiko juostos ir vasaros laiko.
  `sukurta`         DATETIME NOT NULL,
  `galioja_iki`     DATETIME NOT NULL,
  -- aktyvus → panaudotas (virto rezervacija) | atsauktas (klientas nutraukė) | pasibaiges (baigėsi laikas).
  `busena`          ENUM('aktyvus', 'panaudotas', 'atsauktas', 'pasibaiges') NOT NULL DEFAULT 'aktyvus',
  -- Užpildoma, kai laikymas paverčiamas rezervacija.
  `rezervacijos_id` INTEGER  NULL,
  -- Ta pati taisyklė kaip Rezervavimas lentelėje: bent viena para.
  CONSTRAINT `chk_laikymo_datos` CHECK (`pabaiga` > `pradzia`),
  -- Laikymas negali galioti trumpiau nei buvo sukurtas.
  CONSTRAINT `chk_laikymo_galiojimas` CHECK (`galioja_iki` > `sukurta`)
);

ALTER TABLE `Rezervaciju_Laikymai`
  -- Laikymas visada priklauso egzistuojančiam klientui ir automobiliui.
  ADD CONSTRAINT `fk_laikymo_klientas`    FOREIGN KEY (`kliento_id`)      REFERENCES `Klientai`     (`kliento_id`),
  ADD CONSTRAINT `fk_laikymo_automobilis` FOREIGN KEY (`automobilio_id`)  REFERENCES `Automobiliai` (`automobilio_id`),
  ADD CONSTRAINT `fk_laikymo_rezervacija` FOREIGN KEY (`rezervacijos_id`) REFERENCES `Rezervavimas` (`rezervacijos_id`);

-- Užimtumo tikrinimas: „ar šis automobilis turi aktyvų, nepasibaigusį laikymą?“
CREATE INDEX `idx_laikymai_automobilis` ON `Rezervaciju_Laikymai` (`automobilio_id`, `busena`, `galioja_iki`);
-- Limito tikrinimas: „kiek aktyvių laikymų turi šis klientas?“
CREATE INDEX `idx_laikymai_klientas` ON `Rezervaciju_Laikymai` (`kliento_id`, `busena`, `galioja_iki`);


-- Papildomos paslaugos, kurias klientas gali pasirinkti rezervuodamas, ir jų ryšys su rezervacija.

-- Paslaugų katalogas. Kaina – eurais už vieną nuomos parą.
CREATE TABLE `Papildomos_Paslaugos` (
  `paslaugos_id` INTEGER       PRIMARY KEY AUTO_INCREMENT,
  -- Pastovus kodas, pagal kurį paslaugą atpažįsta programėlė (ID tarp aplinkų gali skirtis).
  `kodas`        VARCHAR(40)   NOT NULL,
  `pavadinimas`  VARCHAR(100)  NOT NULL,
  `aprasymas`    VARCHAR(255)  NOT NULL,
  `kaina_parai`  DECIMAL(10,2) NOT NULL,
  -- Nebesiūloma paslauga neištrinama (ji gali būti senose rezervacijose), tik išjungiama.
  `aktyvi`       BOOLEAN       NOT NULL DEFAULT TRUE,
  -- Du įrašai su tuo pačiu kodu padarytų kainą dviprasmišką.
  CONSTRAINT `uq_paslaugos_kodas` UNIQUE (`kodas`),
  -- Neigiama kaina sumažintų rezervacijos sumą.
  CONSTRAINT `chk_paslaugos_kaina` CHECK (`kaina_parai` >= 0)
);

-- Rezervacijai pasirinktos paslaugos (ryšys N:M).
CREATE TABLE `Rezervacijos_Paslaugos` (
  `rezervacijos_id` INTEGER       NOT NULL,
  `paslaugos_id`    INTEGER       NOT NULL,
  -- Kaina užfiksuojama rezervuojant, kad vėlesnis katalogo kainos pakeitimas nepakeistų jau sutartos sumos
  -- (tas pats principas kaip Rezervavimas.kaina_parai).
  `kaina_parai`     DECIMAL(10,2) NOT NULL,
  -- Ta pati paslauga vienai rezervacijai gali būti pridėta tik kartą.
  PRIMARY KEY (`rezervacijos_id`, `paslaugos_id`),
  -- Ištrynus rezervaciją jos paslaugų eilutės nebereikalingos.
  CONSTRAINT `fk_rez_paslaugos_rezervacija` FOREIGN KEY (`rezervacijos_id`)
    REFERENCES `Rezervavimas` (`rezervacijos_id`) ON DELETE CASCADE,
  -- Paslaugos, kuri panaudota rezervacijoje, ištrinti negalima.
  CONSTRAINT `fk_rez_paslaugos_paslauga` FOREIGN KEY (`paslaugos_id`)
    REFERENCES `Papildomos_Paslaugos` (`paslaugos_id`),
  CONSTRAINT `chk_rez_paslaugos_kaina` CHECK (`kaina_parai` >= 0)
);

-- Kliento pasirinkta paėmimo valanda (12–18). NULL – svetainėje sukurta rezervacija, kurioje valanda nepasirenkama.
ALTER TABLE `Rezervavimas`
  ADD COLUMN `paemimo_valanda` TINYINT NULL,
  ADD CONSTRAINT `chk_paemimo_valanda` CHECK (`paemimo_valanda` IS NULL OR `paemimo_valanda` BETWEEN 12 AND 18);

INSERT INTO `Papildomos_Paslaugos` (`kodas`, `pavadinimas`, `aprasymas`, `kaina_parai`) VALUES
('pilna_apsauga',          'Pilna apsauga',          'Papildomos apsaugos paslauga. Sąlygos nurodomos nuomos sutartyje.', 12.00),
('papildomas_vairuotojas', 'Papildomas vairuotojas', 'Automobilį galės vairuoti dar vienas sutartyje nurodytas asmuo.', 5.00),
('vaikiska_kedute',        'Vaikiška kėdutė',        'Kėdutė vaikui nuo 9 iki 36 kg, sumontuojama prieš paėmimą.',     4.00);

-- Kokią nuomos sąlygų versiją ir kada (UTC) klientas priėmė patvirtindamas rezervaciją programėlėje.
-- NULL – rezervacija sukurta svetainėje arba darbuotojo (ten sąlygų priėmimas nefiksuojamas).
ALTER TABLE `Rezervavimas`
  ADD COLUMN `salygu_versija`   VARCHAR(20) NULL,
  ADD COLUMN `salygos_priimtos` DATETIME    NULL,
  -- Versija ir priėmimo laikas turi būti užpildyti kartu arba abu tušti.
  ADD CONSTRAINT `chk_salygu_priemimas`
    CHECK ((`salygu_versija` IS NULL) = (`salygos_priimtos` IS NULL));

-- Idempotencijos raktai rezervacijos patvirtinimo pakartojimams atpažinti.
CREATE TABLE `Idempotencijos_Raktai` (
  `rakto_id`        INTEGER     PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`      INTEGER     NOT NULL,
  -- Programėlės sugeneruotas atsitiktinis raktas (UUID).
  `raktas`          VARCHAR(64) NOT NULL,
  -- Prašymo turinio SHA-256: tas pats raktas su kitokiu turiniu yra klaida, ne pakartojimas.
  `uzklausos_maisa` CHAR(64)    NOT NULL,
  `rezervacijos_id` INTEGER     NOT NULL,
  `sukurta`         DATETIME    NOT NULL,
  -- Raktas unikalus kliento ribose: du vienalaikiai prašymai su tuo pačiu raktu negali abu būti įrašyti.
  CONSTRAINT `uq_idempotencijos_raktas` UNIQUE (`kliento_id`, `raktas`),
  CONSTRAINT `fk_idem_klientas` FOREIGN KEY (`kliento_id`) REFERENCES `Klientai` (`kliento_id`),
  -- Ištrynus rezervaciją raktas nebeturi į ką rodyti.
  CONSTRAINT `fk_idem_rezervacija` FOREIGN KEY (`rezervacijos_id`)
    REFERENCES `Rezervavimas` (`rezervacijos_id`) ON DELETE CASCADE
);

-- Senų raktų valymui pagal sukūrimo laiką.
CREATE INDEX `idx_idem_sukurta` ON `Idempotencijos_Raktai` (`sukurta`);

-- Kas ir kada užbaigė rezervaciją bei koks mokestis pritaikytas.
-- Būsena 'atšaukta' iki šiol reiškė tris skirtingus dalykus (atšaukė klientas, atšaukė darbuotojas,
-- rezervacija paversta užsakymu); klientui programėlėje juos reikia parodyti skirtingai.
ALTER TABLE `Rezervavimas`
  -- NULL – rezervacija neatšaukta arba atšaukta prieš šį pakeitimą (priežastis nežinoma).
  ADD COLUMN `atsaukimo_tipas`    ENUM('klientas', 'darbuotojas', 'isnuomota') NULL,
  -- Atšaukimo momentas UTC.
  ADD COLUMN `atsaukta`           DATETIME      NULL,
  -- Mokestis, kuris klientui buvo parodytas ir pritaikytas atšaukiant (0 – nemokamai).
  ADD COLUMN `atsaukimo_mokestis` DECIMAL(10,2) NULL,
  -- Mokestis negali būti neigiamas.
  ADD CONSTRAINT `chk_atsaukimo_mokestis` CHECK (`atsaukimo_mokestis` IS NULL OR `atsaukimo_mokestis` >= 0),
  -- Atšaukimo duomenys turi prasmę tik atšauktai rezervacijai.
  ADD CONSTRAINT `chk_atsaukimo_tipas_busena` CHECK (`atsaukimo_tipas` IS NULL OR `busena` = 'atšaukta');

-- Kliento rezervacijų sąrašui (programėlės „Mano rezervacijos“): filtras pagal klientą, rikiavimas pagal pradžią.
CREATE INDEX `idx_rezervavimas_klientas_pradzia` ON `Rezervavimas` (`kliento_id`, `rezervacijos_pradzia`);
