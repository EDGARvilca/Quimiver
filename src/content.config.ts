import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

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

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: z.object({
    name: z.string().min(1),
    manufacturer: z.string().min(1),
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
    images: z.object({
      hero: image,
      ingredient: image,
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
