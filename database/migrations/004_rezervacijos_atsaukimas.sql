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
