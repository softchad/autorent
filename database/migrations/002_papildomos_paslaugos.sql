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
