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
