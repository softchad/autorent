# Bendras limiter objektas - importuojamas IR main.py (app.state.limiter), IR endpoint moduliuose (@limiter.limit decoratoriui); laikomas ATSKIRAME faile, kad endpoint'ai neimportuotų main.py tiesiogiai (tai sukeltų ciklinę importaciją - main.py importuoja endpoint'us, endpoint'ai importuotų main.py atgal).
from slowapi import Limiter
from slowapi.util import get_remote_address

# "key_func" - PAGAL KĄ skaičiuojami kreipiniai; get_remote_address naudoja kliento IP adresą, tad limitas taikomas KIEKVIENAM IP atskirai, ne visai sistemai bendrai.
limiter = Limiter(key_func=get_remote_address)
