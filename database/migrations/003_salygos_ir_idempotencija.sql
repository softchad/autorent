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
