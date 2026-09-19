-- ================================================================
-- AutoRent | queries.sql
-- Analitinės ir operacinės užklausos — 18 užklausų pagal temas
-- ================================================================

-- ----------------------------------------------------------------
-- Klientai
-- ----------------------------------------------------------------

-- 1. Kiek klientų yra užsakę bent vieną automobilį?
SELECT COUNT(DISTINCT kliento_id) AS uzsake_klientai
FROM Uzsakymai;

-- 2. Kokie klientai išleido daugiausiai pinigų nuomai?
SELECT k.kliento_id, k.vardas, k.pavarde, SUM(u.bendra_kaina) AS viso_isleista
FROM Uzsakymai u
JOIN Klientai k ON u.kliento_id = k.kliento_id
GROUP BY k.kliento_id
ORDER BY viso_isleista DESC
LIMIT 10;

-- 3. Nauji klientai per paskutinį mėnesį
SELECT COUNT(*) AS nauji_klientai
FROM Klientai
WHERE registracijos_data >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH);

-- ----------------------------------------------------------------
-- Darbuotojai
-- ----------------------------------------------------------------

-- 4. Darbuotojai, dirbantys daugiau nei 5 metus
SELECT *
FROM darbuotojai
WHERE isidarbinimo_data <= DATE_SUB(CURDATE(), INTERVAL 5 YEAR);

-- 5. Darbuotojas su didžiausiu atlyginimu
SELECT *
FROM darbuotojai
ORDER BY atlyginimas DESC
LIMIT 1;

-- ----------------------------------------------------------------
-- Rezervavimas ir pristatymo vietos
-- ----------------------------------------------------------------

-- 6. Klientai, kurie turi aktyvias rezervacijas
SELECT DISTINCT kliento_id
FROM rezervavimas r
WHERE rezervacijos_pabaiga >= CURDATE();

-- 7. Vidutinė rezervacijos trukmė dienomis
SELECT AVG(DATEDIFF(rezervacijos_pabaiga, rezervacijos_pradzia)) AS vidutine_rezervacijos_trukme_dienomis
FROM rezervavimas r;

-- 8. Kiek pristatymo vietų turime kiekviename mieste?
SELECT miestas, COUNT(*) AS vietu_kiekis
FROM pristatymo_vietos
GROUP BY miestas
ORDER BY vietu_kiekis DESC;

-- ----------------------------------------------------------------
-- Sudėtinės JOIN užklausos
-- ----------------------------------------------------------------

-- 9. Visos rezervacijos su kliento vardu ir pavarde
SELECT r.rezervacijos_id, r.rezervacijos_pradzia, r.rezervacijos_pabaiga,
       r.busena, k.vardas, k.pavarde
FROM Rezervavimas r
JOIN Klientai k ON r.kliento_id = k.kliento_id;

-- 10. Klientai, kurie turi aktyvias patvirtintas rezervacijas
SELECT k.kliento_id, k.vardas, k.pavarde, r.rezervacijos_pradzia,
       r.rezervacijos_pabaiga, r.busena
FROM Klientai k
JOIN Rezervavimas r ON k.kliento_id = r.kliento_id
WHERE r.busena = 'patvirtinta';

-- 11. Visi automobiliai su jų dabartine buvimo vieta
SELECT a.automobilio_id, a.marke, a.modelis, p.pavadinimas AS dabartine_vieta
FROM Automobiliai a
JOIN Pristatymo_Vietos p ON a.dabartine_vieta_id = p.vietos_id;

-- 12. 10 klientų, kurie išleido daugiausiai pinigų užsakymams
SELECT k.kliento_id, k.vardas, k.pavarde, SUM(u.bendra_kaina) AS suma
FROM Klientai k
JOIN Uzsakymai u ON k.kliento_id = u.kliento_id
GROUP BY k.kliento_id, k.vardas, k.pavarde
ORDER BY suma DESC
LIMIT 10;

-- ----------------------------------------------------------------
-- Analitinės užklausos
-- ----------------------------------------------------------------

-- 13. Populiariausi automobiliai pagal klientų amžiaus grupes
SELECT
    CASE
        WHEN TIMESTAMPDIFF(YEAR, k.gimimo_data, CURDATE()) < 25 THEN 'Jaunesni nei 25'
        WHEN TIMESTAMPDIFF(YEAR, k.gimimo_data, CURDATE()) BETWEEN 25 AND 40 THEN '25-40'
        ELSE 'Vyresni nei 40'
    END AS amziaus_grupe,
    a.marke,
    a.modelis,
    COUNT(*) AS uzsakymu_skaicius
FROM Uzsakymai u
JOIN Klientai k ON u.kliento_id = k.kliento_id
JOIN Automobiliai a ON u.automobilio_id = a.automobilio_id
GROUP BY amziaus_grupe, a.marke, a.modelis
ORDER BY amziaus_grupe, uzsakymu_skaicius DESC;

-- 14. Populiariausias mėnuo automobilių rezervacijoms
SELECT MONTH(rezervacijos_pradzia) AS menuo, COUNT(*) AS rezervaciju_skaicius
FROM Rezervavimas
GROUP BY menuo
ORDER BY rezervaciju_skaicius DESC;

-- 15. Automobilių užimtumo analizė — kiek užsakymų kiekvienam automobiliui
SELECT a.marke, a.modelis, COUNT(*) AS uzsakymu_skaicius
FROM Uzsakymai u
JOIN Automobiliai a ON u.automobilio_id = a.automobilio_id
GROUP BY a.automobilio_id, a.marke, a.modelis
ORDER BY uzsakymu_skaicius DESC;

-- 16. Vidutinė užsakymo suma pagal savaitės dieną
SELECT DAYNAME(u.nuomos_data) AS savaites_diena, ROUND(AVG(u.bendra_kaina), 2) AS vidutine_suma
FROM Uzsakymai u
GROUP BY savaites_diena
ORDER BY FIELD(savaites_diena, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');

-- 17. Klientai, kurie ilgai nesinaudojo paslaugomis (daugiau nei 1 mėnuo)
SELECT k.vardas, k.pavarde, MAX(u.nuomos_data) AS paskutinis_uzsakymas
FROM Klientai k
JOIN Uzsakymai u ON k.kliento_id = u.kliento_id
GROUP BY k.kliento_id, k.vardas, k.pavarde
HAVING MAX(u.nuomos_data) < DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
ORDER BY paskutinis_uzsakymas ASC;

-- 18. Populiariausia automobilio spalva pagal užsakymus
SELECT a.spalva, COUNT(*) AS vienetų
FROM Uzsakymai u
JOIN Automobiliai a ON u.automobilio_id = a.automobilio_id
GROUP BY a.spalva
ORDER BY vienetų DESC;
