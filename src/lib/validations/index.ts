// src/lib/validations/index.ts
import { z } from "zod";
import { passwordIssues, PASSWORD_FORM_MESSAGE } from "@/lib/password-rules";
import { normalizePriceInput } from "@/lib/price-display";

// Login accepts any existing password (6 or more characters); the strict rules apply when one is set.
export const loginSchema = z.object({
  email: z.string().email("emailInvalid"),
  password: z.string().min(6, "passwordMin"),
});

// A password being set or changed: the shared rules in src/lib/password-rules.ts.
export const newPasswordSchema = z.string().superRefine((value, ctx) => {
  const [first] = passwordIssues(value);
  if (first) ctx.addIssue({ code: z.ZodIssueCode.custom, message: PASSWORD_FORM_MESSAGE[first] });
});

export const registerSchema = z.object({
  name: z.string().min(2, "nameShort"),
  email: z.string().email("emailInvalid"),
  password: newPasswordSchema,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "passwordMismatch",
  path: ["confirmPassword"],
});

// The owner's change-password card. `currentPassword` is required by the route when the account has a password.
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(72).optional(),
  newPassword: newPasswordSchema,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "passwordMismatch",
  path: ["confirmPassword"],
});

export const productBaseSchema = z.object({
  name: z.string().min(2, "nameRequired"),
  description: z.string().optional().nullable(),
  price: z.number().min(0, "pricePositive").optional(),
  priceMode: z.enum(["FIXED", "FROM", "ON_REQUEST"]).optional(),
  assessmentProductId: z.string().min(1).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  category: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  itemType: z.enum(["PHYSICAL", "SERVICE", "PACKAGE", "SUBSCRIPTION"]).default("PHYSICAL"),
  durationMinutes: z.number().int().positive("durationPositive").optional().nullable(),
  requiresBooking: z.boolean().default(false),
  capacity: z.number().int().positive().optional().nullable(),
  serviceConfig: z.record(z.any()).optional().nullable(),
  visitModes: z.enum(["IN_PERSON", "ONLINE", "BOTH"]).optional().nullable(),
});

// The price fields depend on each other (a starting price needs an amount, on request has none), so the rule
// lives in normalizePriceInput and the form and the API both run it. Updates use productBaseSchema.partial().
export const productSchema = productBaseSchema.superRefine((data, ctx) => {
  const result = normalizePriceInput(data, { partial: false });
  if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: result.error });
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const themeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "colorInvalid"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "colorInvalid"),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "colorInvalid"),
  fontFamily: z.string().optional(),
});

export const appointmentSchema = z.object({
  productId: z.string().min(1, "serviceIdRequired"),
  appointmentDate: z.string().min(1, "dateRequired"),
  notes: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ThemeInput = z.infer<typeof themeSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
