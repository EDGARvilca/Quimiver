# API

La web no tiene un servidor propio: habla con Supabase de tres formas. Todas las direcciones están en `src/config/site.ts`.

| Base                                                     | Uso                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `https://buuelzmvfidigimbrplm.supabase.co/functions/v1/` | Edge Functions (Deno, TypeScript) para lo que escribe el público. |
| `https://buuelzmvfidigimbrplm.supabase.co/rest/v1/`      | PostgREST: tablas y funciones SQL, con las reglas RLS.            |
| `https://buuelzmvfidigimbrplm.supabase.co/auth/v1/`      | Supabase Auth: sesión del panel.                                  |

Todas las llamadas llevan la cabecera `apikey` con la clave publicable (es pública por diseño; los permisos los decide la base). Las del panel llevan además `Authorization: Bearer <token de sesión>`.

## Edge Function `pedidos`

Código: `supabase/functions/pedidos/` (`pedido.ts` es la validación, compartida con las pruebas).

**`GET /functions/v1/pedidos`** → `200 { "ok": true, "disponible": true }`. Dice si hay stock sin revelar la cantidad. `503` si la base no responde.

**`POST /functions/v1/pedidos`** con JSON:

```json
{
  "cliente_nombre": "María López",
  "telefono": "987654321",
  "ciudad": "Huaraz",
  "presentacion": "Frasco de 50 g",
  "cantidad": 6,
  "precio_unitario": 20,
  "tipo_precio": "por mayor",
  "entrega": "Envío por Shalom (costo según destino)",
  "total_estimado": 120,
  "observaciones": null
}
```

| Respuesta                                                | Cuándo                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `201 { "codigo": "P-000012", "creado_en": "…" }`         | Pedido guardado.                                                          |
| `400 { "error": "Formato no válido." }`                  | No es JSON.                                                               |
| `403`                                                    | El origen no está permitido (solo la web publicada y `localhost`).        |
| `405`                                                    | Método distinto de GET, POST u OPTIONS.                                   |
| `413`                                                    | Cuerpo de más de 8 KB (20 KB en el libro).                                |
| `422 { "error": "…", "errors": { "campo": "mensaje" } }` | Datos no válidos (por ejemplo, el total no cuadra con precio y cantidad). |
| `429`                                                    | Más de 5 pedidos por hora desde el mismo celular o más de 60 en total.    |
| `500`                                                    | No se pudo guardar. La web abre WhatsApp igual.                           |

Variables (secretos de la función): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (las pone Supabase), `ALLOWED_ORIGINS` (opcional), `BREVO_API_KEY`, `MAIL_FROM` y `PEDIDOS_CORREO` (opcionales, aviso por correo).

## Edge Function `libro-reclamaciones`

Código: `supabase/functions/libro-reclamaciones/` (`complaint.ts` valida).

**`GET`** → `200 { "ok": true, "enabled": true }`; `enabled` es falso mientras falten razón social, RUC o domicilio en `libro_proveedor`.

**`POST`** con la hoja (tipo, consumidor, documento, domicilio, celular, correo, menor de edad y apoderado, bien, monto, descripción, número de pedido, detalle y pedido del consumidor). Respuestas como en `pedidos`: `201 { "codigo": "LR-000002", "creado_en": "…" }`, `422` con errores por campo, `429` tras 3 hojas por hora del mismo correo o 30 en total, `503` si el libro no está habilitado. Si Brevo está configurado, envía la copia al consumidor y al proveedor.

## PostgREST (tablas y funciones)

| Llamada                                                                                  | Quién                          | Qué devuelve                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST rest/v1/rpc/seguir_pedido` `{ "p_codigo": "P-000012", "p_telefono": "987654321" }` | Público                        | `{ ok: true, codigo, estado, creado_en, presentacion, cantidad, entrega, total_estimado }` o `{ ok: false, error: "datos" \| "no_encontrado" \| "limite" }`. |
| `POST rest/v1/rpc/es_administrador`                                                      | Sesión                         | `true` o `false`.                                                                                                                                            |
| `GET rest/v1/pedidos?select=*&order=creado_en.desc&limit=500`                            | Administrador                  | Pedidos.                                                                                                                                                     |
| `PATCH rest/v1/pedidos?id=eq.12` `{ "estado": "confirmado", "notas_internas": "…" }`     | Administrador                  | Pedido actualizado. `400` con código `P0001` si no hay stock.                                                                                                |
| `POST rest/v1/rpc/ver_stock`                                                             | Administrador                  | `{ stock, movimientos[] }`.                                                                                                                                  |
| `POST rest/v1/rpc/ajustar_stock` `{ "p_cantidad": 50, "p_motivo": "Producción nueva" }`  | Administrador                  | Stock nuevo.                                                                                                                                                 |
| `GET rest/v1/producto_web?producto=eq.quimiver-50g`                                      | Público (PR de producto)       | Datos editables del producto.                                                                                                                                |
| `PATCH rest/v1/producto_web?producto=eq.quimiver-50g`                                    | Administrador (PR de producto) | Fila actualizada; la base rechaza valores fuera de rango.                                                                                                    |

Errores de PostgREST: `401` sesión vencida, `403` o lista vacía si la RLS no deja, `400` con `code` de PostgreSQL si falla una regla.

## Supabase Auth (panel)

| Llamada                                       | Para qué                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `POST auth/v1/token?grant_type=password`      | Entrar con correo y contraseña.                                                    |
| `POST auth/v1/token?grant_type=refresh_token` | Renovar la sesión antes de que venza.                                              |
| `POST auth/v1/logout`                         | Salir.                                                                             |
| `POST auth/v1/recover?redirect_to=…/panel/`   | "Olvidé mi contraseña" (PR de recuperación). Responde igual exista o no el correo. |
| `PUT auth/v1/user { "password": "…" }`        | Guardar la contraseña nueva con el token del enlace.                               |
