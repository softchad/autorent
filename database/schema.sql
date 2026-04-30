-- ================================================================
-- AutoRent | schema.sql
-- Duomenų bazės struktūra — lentelės išdėstytos priklausomybių tvarka
-- ================================================================

-- ----------------------------------------------------------------
-- Pagrindiniai subjektai (be priklausomybių)
-- ----------------------------------------------------------------

-- Klientai — sistemos naudotojai su bonus taškų sistema
CREATE TABLE `Klientai` (
  `kliento_id`         INTEGER      PRIMARY KEY AUTO_INCREMENT,
  `vardas`             VARCHAR(255) NOT NULL,
  `pavarde`            VARCHAR(255) NOT NULL,
  `el_pastas`          VARCHAR(255) NOT NULL UNIQUE CHECK (`el_pastas` LIKE '%_@_%._%'),
  `telefono_nr`        VARCHAR(255) NOT NULL,
  `gimimo_data`        DATE         NOT NULL,
  `registracijos_data` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `bonus_taskai`       INTEGER      DEFAULT 0 CHECK (`bonus_taskai` >= 0)
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

-- ----------------------------------------------------------------
-- Veikla: užsakymai, rezervacijos, sąskaitos, mokėjimai
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- Klientų aptarnavimas ir atsiliepimai
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- Aptarnavimas: servisas, remontas, kuras, draudimas, baudos
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- Ryšių lentelės: paslaugos, nuolaidos, bonusai
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- Darbuotojų ir automobilių priskyrimas
-- ----------------------------------------------------------------

-- ================================================================
-- Užsienio raktai (sugrupuoti pagal lentelę)
-- ================================================================
