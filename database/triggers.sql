-- ================================================================
-- AutoRent | triggers.sql
-- Duomenų bazės trigeriai — automatinė duomenų validacija
-- ================================================================

-- Kiekvieną bloką nuo CREATE TRIGGER iki END pažymėk atskirai ir paleisk Ctrl+Enter

-- ----------------------------------------------------------------
-- Klientų amžiaus patikrinimas
-- Draudžia registruoti klientus jaunesnius nei 18 metų
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

-- ----------------------------------------------------------------
-- Užsakymo datų patikrinimas
-- Grąžinimo data negali būti ankstesnė nei nuomos data
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

-- ----------------------------------------------------------------
-- Serviso pradžios datos patikrinimas
-- Serviso pradžios data negali būti ateityje
-- ----------------------------------------------------------------

CREATE TRIGGER check_serviso_pradzios_data
BEFORE INSERT ON Automobiliu_Servisas
FOR EACH ROW
BEGIN
  IF NEW.serviso_pradzios_data > CURDATE() THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Serviso pradžios data negali būti ateityje.';
  END IF;
END
