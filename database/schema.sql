-- ================================================================
-- AutoRent | schema.sql
-- Duomenų bazės struktūra — lentelės išdėstytos priklausomybių tvarka
-- ================================================================

-- ----------------------------------------------------------------
-- Pagrindiniai subjektai (be priklausomybių)
-- ----------------------------------------------------------------

-- Klientai — sistemos naudotojai su bonus taškų sistema
-- slaptazodis: NULL reiškia, kad klientas dar neturi savo prisijungimo (įrašą
-- sukūrė darbuotojas), arba prisijungia tik per Google - atskira, ne darbuotojo,
-- paskyros sistema (žr. backend app/api/v1/endpoints/customer_auth.py).
CREATE TABLE `Klientai` (
  `kliento_id`         INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `vardas`             VARCHAR(255) NOT NULL,
  `pavarde`            VARCHAR(255) NOT NULL,
  `el_pastas`          VARCHAR(255) NOT NULL UNIQUE CHECK (`el_pastas` LIKE '%_@_%._%'),
  `telefono_nr`        VARCHAR(255) NOT NULL,
  `gimimo_data`        DATE         NOT NULL,
  `registracijos_data` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `slaptazodis`        VARCHAR(255) NULL
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
  `slaptazodis`      VARCHAR(255)  NULL
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
  `pavarų_deze`          ENUM('mechaninė', 'automatinė', 'pusiau automatinė') NOT NULL,
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
  `turi_papildomas_paslaugas` BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Rezervavimas — išankstinės rezervacijos prieš patvirtinant užsakymą
CREATE TABLE `Rezervavimas` (
  `rezervacijos_id`     INTEGER PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`          INTEGER NOT NULL,
  `automobilio_id`      INTEGER NOT NULL,
  `rezervacijos_pradzia` DATE   NOT NULL,
  `rezervacijos_pabaiga` DATE   NOT NULL,
  `busena`              ENUM('patvirtinta', 'atšaukta', 'laukia') NOT NULL,
  CHECK (`rezervacijos_pabaiga` > `rezervacijos_pradzia`)
);

-- Saskaitos — finansiniai dokumentai susieti su užsakymais
CREATE TABLE `Saskaitos` (
  `saskaitos_id`  INTEGER       PRIMARY KEY AUTO_INCREMENT,
  `uzsakymo_id`   INTEGER       NOT NULL,
  `suma`          DECIMAL(10,2) NOT NULL,
  `saskaitos_data` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------
-- Klientų aptarnavimas
-- ----------------------------------------------------------------

-- Pokalbiai — kliento aptarnavimo byla (viena konkreti problema). Kelios žinutės
-- vienoje byloje, ne vienas klausimas+atsakymas įraše. busena reiškia KAS TURI
-- VEIKTI toliau (žr. specifikacijos 8 skyrių), ne vien "atsakyta/neatsakyta".
CREATE TABLE `Pokalbiai` (
  `pokalbio_id`               INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`                INTEGER      NOT NULL,
  `darbuotojo_id`              INTEGER      NULL,
  `tema`                       VARCHAR(150) NOT NULL,
  `kategorija`                  ENUM('rezervacija','atsiemimas_grazinimas','automobilis','saskaita','paskyra','kita') NOT NULL DEFAULT 'kita',
  `busena`                      ENUM('atvira','sprendziama','laukiama_kliento','isspresta') NOT NULL DEFAULT 'atvira',
  `rezervacijos_id`             INTEGER      NULL,
  `sprendimo_santrauka`         TEXT         NULL,
  `kliento_paskutinis_matytas`  INTEGER      NULL,
  `darbuotojo_paskutinis_matytas` INTEGER    NULL,
  `sukurimo_data`               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atnaujinimo_data`            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pokalbio_Zinutes — viešos, klientui IR darbuotojui matomos žinutės. Niekada
-- neperrašomos - klaida taisoma nauja žinute, ne UPDATE.
CREATE TABLE `Pokalbio_Zinutes` (
  `zinutes_id`      INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `pokalbio_id`     INTEGER      NOT NULL,
  `autoriaus_tipas` ENUM('klientas','darbuotojas') NOT NULL,
  `kliento_id`      INTEGER      NULL,
  `darbuotojo_id`   INTEGER      NULL,
  `tekstas`         TEXT         NOT NULL,
  `sukurimo_data`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pokalbio_Pastabos — VIDINĖS pastabos, atskira lentelė (ne CSS-paslėpta žymė
-- Pokalbio_Zinutes viduje), kad klientui skirtas API endpointas jų fiziškai
-- negalėtų atsitiktinai grąžinti.
CREATE TABLE `Pokalbio_Pastabos` (
  `pastabos_id`   INTEGER   PRIMARY KEY AUTO_INCREMENT,
  `pokalbio_id`   INTEGER   NOT NULL,
  `darbuotojo_id` INTEGER   NOT NULL,
  `tekstas`       TEXT      NOT NULL,
  `sukurimo_data` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lojalumo_Atlygiai — kliento uždirbti atlygiai už kas 5 užbaigtas nuomas.
-- etapo_numeris = kiek penketukų nuomų jau uždirbta (1, 2, 3...), unikalu kiekvienam
-- klientui - taip vienas etapas negali sukurti dviejų atlygių net jei būsena
-- perskaičiuojama pakartotinai. Žr. backend customer_loyalty.py.
CREATE TABLE `Lojalumo_Atlygiai` (
  `atlygio_id`      INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `kliento_id`      INTEGER      NOT NULL,
  `etapo_numeris`   INTEGER      NOT NULL,
  `sukurimo_data`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `busena`          ENUM('neisnaudotas', 'isnaudotas') NOT NULL DEFAULT 'neisnaudotas',
  `panaudojimo_data` TIMESTAMP   NULL,
  UNIQUE (`kliento_id`, `etapo_numeris`)
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
