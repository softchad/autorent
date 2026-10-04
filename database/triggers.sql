-- ================================================================
-- AutoRent | triggers.sql
-- Duomenų bazės trigeriai — automatinė duomenų validacija
-- ================================================================

-- Kiekvieną bloką nuo CREATE TRIGGER iki END pažymėk atskirai ir paleisk Ctrl+Enter

-- ----------------------------------------------------------------
-- Klientų amžiaus patikrinimas - draudžia registruoti klientus jaunesnius nei 18 metų
-- ----------------------------------------------------------------

CREATE TRIGGER check_gimimo_data
BEFORE INSERT ON Klientai
FOR EACH ROW
BEGIN
  IF TIMESTAMPDIFF(YEAR, NEW.gimimo_data, CURDATE()) < 18 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Klientas turi būti bent 18 metų.';
  END IF;
END

-- Ta pati patikra UPDATE'ui - be šito klientas galėtų būti "pasendintas" po
-- registracijos, apeinant amžiaus apribojimą.
CREATE TRIGGER check_gimimo_data_update
BEFORE UPDATE ON Klientai
FOR EACH ROW
BEGIN
  IF TIMESTAMPDIFF(YEAR, NEW.gimimo_data, CURDATE()) < 18 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Klientas turi būti bent 18 metų.';
  END IF;
END

-- ----------------------------------------------------------------
-- Užsakymo datų patikrinimas - grąžinimo data negali būti ankstesnė nei nuomos data
-- ----------------------------------------------------------------

CREATE TRIGGER check_grazinimo_data
BEFORE INSERT ON Uzsakymai
FOR EACH ROW
BEGIN
  IF NEW.grazinimo_data < NEW.nuomos_data THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Grąžinimo data negali būti anksčiau nei nuomos data.';
  END IF;
END

-- Ta pati patikra UPDATE'ui - be šito grazinimo_data galėtų būti pakeista į
-- datą prieš nuomos_data po užsakymo sukūrimo.
CREATE TRIGGER check_grazinimo_data_update
BEFORE UPDATE ON Uzsakymai
FOR EACH ROW
BEGIN
  IF NEW.grazinimo_data < NEW.nuomos_data THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Grąžinimo data negali būti anksčiau nei nuomos data.';
  END IF;
END
