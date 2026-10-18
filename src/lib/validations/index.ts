// src/lib/validations/index.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const productSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().optional().nullable(),
  price: z.number().positive("El precio debe ser mayor a 0"),
  stock: z.number().int().min(0).default(0),
  category: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  itemType: z.enum(["PHYSICAL", "SERVICE", "PACKAGE", "SUBSCRIPTION"]).default("PHYSICAL"),
  durationMinutes: z.number().int().positive("La duración debe ser mayor a 0").optional().nullable(),
  requiresBooking: z.boolean().default(false),
  capacity: z.number().int().positive().optional().nullable(),
  serviceConfig: z.record(z.any()).optional().nullable(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const themeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  fontFamily: z.string().optional(),
});

export const appointmentSchema = z.object({
  productId: z.string().min(1, "ID de servicio requerido"),
  appointmentDate: z.string().min(1, "Fecha requerida"),
  notes: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ThemeInput = z.infer<typeof themeSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
