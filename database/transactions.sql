-- ================================================================
-- AutoRent | transactions.sql
-- Saugomų procedūrų aprašymai — sudėtingos operacijos su transakcijomis
-- ================================================================

-- ----------------------------------------------------------------
-- 1 žingsnis: paleisti šią eilutę atskirai (Ctrl+Enter)
-- ----------------------------------------------------------------

DROP PROCEDURE IF EXISTS CreateUzsakymas;

-- ----------------------------------------------------------------
-- 2 žingsnis: pažymėti VISĄ bloką nuo CREATE iki END ir paleisti (Ctrl+Enter)
-- ----------------------------------------------------------------

CREATE PROCEDURE CreateUzsakymas(
    IN in_klientoID INT,
    IN in_automobilioID INT,
    IN in_darbuotojoID INT,
    IN in_nuomosData DATE,
    IN in_grazinimoData DATE,
    IN in_paemimoVietaID INT,
    IN in_grazinimoVietaID INT,
    IN in_papildomosPaslaugos TEXT
)
BEGIN
    DECLARE v_dienosNuomos INT;
    DECLARE v_kainaParai DECIMAL(10,2);
    DECLARE v_bendraKaina DECIMAL(10,2);
    DECLARE v_autoUzimtas INT DEFAULT 0;
    DECLARE v_klientasUzimtas INT DEFAULT 0;
    DECLARE v_uzsakymoID INT;

    -- Patikrinama, ar automobilis laisvas pasirinktu laikotarpiu
    SELECT COUNT(*) INTO v_autoUzimtas
    FROM Uzsakymai
    WHERE automobilio_id = in_automobilioID
      AND uzsakymo_busena IN ('patvirtinta', 'vykdoma')
      AND (nuomos_data BETWEEN in_nuomosData AND in_grazinimoData
           OR grazinimo_data BETWEEN in_nuomosData AND in_grazinimoData);

    IF v_autoUzimtas > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Automobilis jau rezervuotas arba išnuomotas tomis dienomis.';
    END IF;

    -- Patikrinama, ar klientas neturi kito aktyvaus užsakymo
    SELECT COUNT(*) INTO v_klientasUzimtas
    FROM Uzsakymai
    WHERE kliento_id = in_klientoID
      AND uzsakymo_busena IN ('patvirtinta', 'vykdoma')
      AND (nuomos_data BETWEEN in_nuomosData AND in_grazinimoData
           OR grazinimo_data BETWEEN in_nuomosData AND in_grazinimoData);

    IF v_klientasUzimtas > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Klientas jau turi kitą rezervuotą automobilį tomis dienomis.';
    END IF;

    -- Automatinis kainos skaičiavimas
    SELECT DATEDIFF(in_grazinimoData, in_nuomosData) INTO v_dienosNuomos;
    SELECT kaina_parai INTO v_kainaParai
      FROM Automobiliai
      WHERE automobilio_id = in_automobilioID;
    SET v_bendraKaina = v_kainaParai * v_dienosNuomos;

    START TRANSACTION;

    INSERT INTO Uzsakymai (
        kliento_id, automobilio_id, darbuotojo_id, nuomos_data,
        grazinimo_data, paemimo_vietos_id, grazinimo_vietos_id,
        bendra_kaina, uzsakymo_busena, turi_papildomas_paslaugas
    )
    VALUES (
        in_klientoID, in_automobilioID, in_darbuotojoID, in_nuomosData,
        in_grazinimoData, in_paemimoVietaID, in_grazinimoVietaID,
        v_bendraKaina, 'laukiama', IF(LENGTH(in_papildomosPaslaugos) > 0, TRUE, FALSE)
    );

    SET v_uzsakymoID = LAST_INSERT_ID();

    -- Jei nurodytos papildomos paslaugos, jos pridedamos prie užsakymo
    IF LENGTH(in_papildomosPaslaugos) > 0 THEN
        SET @sql = CONCAT(
            'INSERT INTO Uzsakymo_Paslaugos (uzsakymo_id, paslaugos_id) ',
            'SELECT ', v_uzsakymoID, ', paslaugos_id FROM Papildomos_Paslaugos ',
            'WHERE FIND_IN_SET(paslaugos_id, "', in_papildomosPaslaugos, '") > 0'
        );
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;

    COMMIT;

    SELECT 'Užsakymas sukurtas sėkmingai.' AS rezultatas;
END
