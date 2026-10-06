/**
 * JSON para incrustar en `<script type="application/json">` o JSON-LD. Escapa `<` para que
 * ningún texto pueda cerrar la etiqueta (`</script>`) e inyectar HTML; JSON.parse lo lee igual.
 */
export function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
