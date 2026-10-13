import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { site } from './config/site';
import {
  PRODUCT_ROW_ID,
  applyProductRow,
  parseProductRow,
  type ProductData,
} from './lib/product-data';

/**
 * Texto comercial que necesita respaldo del negocio antes de publicarse
 * (propiedades, certificaciones, composición, testimonios).
 * Mientras `verified` sea `false`, el sitio no lo muestra como dato real.
 */
const claim = z.object({
  text: z.string().min(1),
  verified: z.boolean(),
});

const image = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/**
 * Con PRODUCTO_DESDE_BASE=1 (el despliegue a GitHub Pages) los precios, la presentación y
 * dos textos salen de la tabla `producto_web`, que se edita desde el panel. Si la base no
 * responde, la compilación falla y queda publicada la versión anterior: nunca se publica
 * un precio viejo del JSON. Sin la variable (desarrollo y pruebas) se usa solo el JSON.
 */
async function productRowFromDatabase() {
  const { supabaseUrl, publishableKey } = site.panel;
  const url = `${supabaseUrl}/rest/v1/producto_web?producto=eq.${PRODUCT_ROW_ID}&select=*`;
  const res = await fetch(url, { headers: { apikey: publishableKey } });
  if (!res.ok) throw new Error(`No se pudo leer producto_web (${res.status}).`);
  const row = parseProductRow(await res.json());
  if (!row) throw new Error('La fila de producto_web no tiene datos válidos.');
  return row;
}

const jsonFiles = glob({ pattern: '**/*.json', base: './src/content/products' });

const products = defineCollection({
  loader: {
    name: 'productos',
    load: async (context) => {
      context.store.clear();
      await jsonFiles.load(context);
      if (process.env.PRODUCTO_DESDE_BASE !== '1') return;
      const row = await productRowFromDatabase();
      const entry = context.store.get('quimiver');
      if (!entry) throw new Error('Falta src/content/products/quimiver.json.');
      const data = await context.parseData({
        id: entry.id,
        data: { ...applyProductRow(entry.data as unknown as ProductData, row) },
      });
      context.store.set({ ...entry, data, digest: context.generateDigest(data) });
      context.logger.info(
        `Precios y textos del producto leídos de la base (${row.actualizado_en}).`,
      );
    },
  },
  schema: z.object({
    name: z.string().min(1),
    manufacturer: z.string().min(1),
    /** Tipo de producto tal como figura en la etiqueta (p. ej. "Crema de congona"). */
    descriptor: z.string().min(1),
    intro: z.string().min(1),
    seo: z.object({
      title: z.string().min(1),
      description: z.string().min(1),
    }),
    presentations: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          price: z.number().positive(),
          wholesalePrice: z.number().positive(),
        }),
      )
      .min(1),
    /** Unidades desde las que rige el precio por mayor (media docena). */
    wholesaleMinQuantity: z.number().int().min(2),
    /** Fecha del último cambio en la base; solo existe si se leyó de `producto_web`. */
    updatedAt: z.string().optional(),
    images: z.object({
      hero: image,
      ingredient: image,
      /**
       * Secuencia de fotos del frasco girando (opcional). `pattern` lleva {n} donde va el número
       * del cuadro: "/images/giro/giro-{n}.webp" → giro-01.webp … giro-36.webp.
       * Mientras no exista, la foto real hace un giro 3D ligero al bajar.
       */
      spin: z
        .object({
          pattern: z.string().includes('{n}'),
          frames: z.number().int().min(2),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .optional(),
    }),
    badge: claim,
    summary: claim,
    seal: claim,
    highlights: z.array(claim),
    origin: claim,
    benefits: z.object({
      intro: claim,
      items: z.array(z.object({ title: z.string(), text: z.string(), verified: z.boolean() })),
    }),
    ingredients: z.object({
      heading: z.string().min(1),
      description: claim,
      points: z.array(claim),
    }),
    usage: z.array(z.object({ title: z.string(), text: z.string() })),
    testimonials: z.array(
      z.object({
        quote: z.string(),
        author: z.string(),
        city: z.string(),
        verified: z.boolean(),
      }),
    ),
    faq: z.array(z.object({ question: z.string(), answer: z.string(), verified: z.boolean() })),
  }),
});

export const collections = { products };
