import { describe, expect, it } from 'vitest';
import {
  hojaEmail,
  hojaRows,
  validateComplaint,
  type StoredComplaint,
} from '../supabase/functions/libro-reclamaciones/complaint';

const valid = {
  tipo: 'reclamo',
  consumidor_nombre: '  Ana   Pérez ',
  documento_tipo: 'DNI',
  documento_numero: '12345678',
  domicilio: 'Av. Los Andes 123, Huaraz, Áncash',
  telefono: '929 445 834',
  correo: 'Ana@Ejemplo.pe',
  bien_tipo: 'producto',
  monto: '25,00',
  bien_descripcion: 'QUIMIVER, frasco de 50 g',
  numero_pedido: '',
  detalle: 'El frasco llegó con la tapa rota.',
  pedido: 'Cambio del frasco.',
};

const provider = {
  tradeName: 'QUIMIVER',
  businessName: 'CELGIMED',
  ruc: '20123456789',
  address: 'Jr. Ejemplo 1, Huaraz',
  email: 'ventas@quimicaverdeandina.pe',
  website: 'https://edgarvilca.github.io/Quimiver/',
};

describe('validateComplaint', () => {
  it('acepta y normaliza una hoja válida', () => {
    const r = validateComplaint(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.consumidor_nombre).toBe('Ana Pérez');
    expect(r.value.correo).toBe('ana@ejemplo.pe');
    expect(r.value.telefono).toBe('929445834');
    expect(r.value.monto).toBe(25);
    expect(r.value.numero_pedido).toBeNull();
    expect(r.value.menor_de_edad).toBe(false);
    expect(r.value.apoderado_nombre).toBeNull();
  });

  it('marca cada campo con error', () => {
    const r = validateComplaint({ ...valid, documento_numero: '123', correo: 'no', tipo: 'otro' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['correo', 'documento_numero', 'tipo']);
  });

  it('exige apoderado si es menor de edad', () => {
    const r = validateComplaint({ ...valid, menor_de_edad: 'on' });
    expect(r.ok).toBe(false);
    const ok = validateComplaint({ ...valid, menor_de_edad: true, apoderado_nombre: 'Luis Pérez' });
    expect(ok.ok).toBe(true);
  });

  it('valida el RUC y rechaza datos que no son objeto', () => {
    expect(
      validateComplaint({ ...valid, documento_tipo: 'RUC', documento_numero: '20123456789' }).ok,
    ).toBe(true);
    expect(
      validateComplaint({ ...valid, documento_tipo: 'RUC', documento_numero: '30123456789' }).ok,
    ).toBe(false);
    expect(validateComplaint(null).ok).toBe(false);
  });

  it('el monto es opcional', () => {
    const r = validateComplaint({ ...valid, monto: '' });
    expect(r.ok && r.value.monto).toBeNull();
  });
});

describe('hoja', () => {
  const stored: StoredComplaint = {
    ...(validateComplaint(valid) as { ok: true; value: StoredComplaint }).value,
    codigo: 'LR-000001',
    creado_en: '2026-10-05T23:40:00Z',
  };

  it('incluye los datos del proveedor y la fecha en hora de Lima', () => {
    const rows = Object.fromEntries(hojaRows(stored, provider));
    expect(rows['Hoja de reclamación N.º']).toBe('LR-000001');
    expect(rows.RUC).toBe('20123456789');
    expect(rows['Fecha y hora']).toMatch(/5 de octubre de 2026.*18:40/);
    expect(rows['Monto reclamado']).toBe('S/ 25.00');
  });

  it('escapa el HTML del correo', () => {
    const mail = hojaEmail({ ...stored, detalle: '<script>x</script> roto' }, provider);
    expect(mail.subject).toBe('Hoja de reclamación LR-000001 · QUIMIVER');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.text).toContain('15 días hábiles');
  });
});
