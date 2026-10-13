"""Ordena la cadena de conexión de SUPABASE_DB_URL antes de usarla.

Arregla los errores más comunes al copiarla de Supabase: espacios o saltos de línea al
inicio o al final, comillas alrededor, corchetes que quedaron de [YOUR-PASSWORD] y
contraseñas con símbolos (* / @ # ?) que rompen la dirección si no se codifican.
Imprime la cadena corregida. Si no puede, explica qué parte está mal sin mostrar la
contraseña (los registros de GitHub de un repositorio público los puede ver cualquiera).
"""
import os
import re
import sys
from urllib.parse import quote, unquote

url = os.environ.get("SUPABASE_DB_URL", "").strip().strip("'\"").strip()
if url.upper().startswith("SUPABASE_DB_URL="):
    url = url.split("=", 1)[1].strip().strip("'\"").strip()

forma = re.fullmatch(r"(postgres(?:ql)?://)([^:/@]+):(.*)@([^@/:]+)(?::(\d+))?(/[^/?#]*)?(\?.*)?", url, re.S)
if not forma:
    avisos = []
    if not re.match(r"postgres(ql)?://", url):
        avisos.append("no empieza con postgresql://")
    if "@" not in url:
        avisos.append("le falta la @ antes de la dirección del servidor")
    if re.search(r"\s", url):
        avisos.append("tiene espacios o saltos de línea en medio")
    print("SUPABASE_DB_URL no tiene la forma postgresql://usuario:contraseña@servidor:5432/postgres"
          + (": " + "; ".join(avisos) if avisos else ""), file=sys.stderr)
    sys.exit(1)

inicio, usuario, clave, servidor, puerto, base, opciones = forma.groups()
if clave.startswith("[") and clave.endswith("]"):
    clave = clave[1:-1]
if not clave:
    print("SUPABASE_DB_URL no tiene contraseña entre usuario: y @", file=sys.stderr)
    sys.exit(1)
# Si la contraseña ya venía codificada (%2A, etc.) no se codifica dos veces.
clave = quote(unquote(clave), safe="")
print(f"{inicio}{usuario}:{clave}@{servidor}:{puerto or '5432'}{base or '/postgres'}{opciones or ''}")
