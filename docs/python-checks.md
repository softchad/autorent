# Python patikros

Backend palaikoma Python 3.12 versija. Komandas vykdyti iš `backend` aplanko, aktyvavus virtualią aplinką.

```powershell
python -m pip install -r requirements-dev.txt
ruff check .
```

Tikrinamos importų vietos, sintaksės ir pagrindinės vykdymo klaidos. `app/main.py` pirmiausia užkrauna aplinką, o `tests/conftest.py` prieš programos importus paruošia SQLite variklį. Šiems dviem failams taikoma tik E402 išimtis.

Importų rūšiavimas tikrinamas atskirai sutvarkytiems failams:

```powershell
ruff check app/api/endpoints/customer_holds.py app/services/rental_terms.py --extend-select I
```

Viso backend importų rūšiavimas ir formatavimo patikra dar nėra privalomi. `ruff format .` šiame etape netaikomas.

Prieš backend testus proceso `DATABASE_URL` turi rodyti į `mysql+pymysql://tests-must-not-connect@127.0.0.1:1/none`, o `AUTORENT_MYSQL_TEST_URL` turi būti nenustatytas. Testai naudoja atskirą SQLite bazę; MySQL integracijos testai be atskiros testinės bazės praleidžiami.

## GitHub Actions

`.github/workflows/ruff.yml` paleidžia abi Ruff patikras po kiekvieno push, per pull request ir rankiniu būdu per Actions. CI naudoja Python 3.12 ir Ruff 0.17.6; keičiant Ruff versiją reikia kartu atnaujinti workflow ir requirements-dev.txt.

Workflow diegia tik Ruff, programos nepaleidžia ir DB ar projekto paslapčių nenaudoja. Jis netaiso failų, neatlieka deploy ir dar nepaleidžia testų, build ar priklausomybių audito.

Rezultatas matomas prie commito ir Actions skiltyje kaip `Ruff backend`. Norint stabdyti PR sujungimą, GitHub šakos taisyklėse šią patikrą reikia nustatyti kaip privalomą. Vien workflow to neužtikrina; tiesioginio push į main jis taip pat nesustabdo. Pirmas tikras GitHub paleidimas galimas tik įkėlus workflow į repozitoriją.
