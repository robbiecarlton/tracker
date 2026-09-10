import { z } from "zod";

/**
 * Validation shared by the backend (request validation) and the mobile/web app
 * (form validation) so the rules live in exactly one place.
 */

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "That password is too long");

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  /** IANA timezone, e.g. "Europe/London". Captured at signup for view math. */
  timezone: z.string().trim().min(1).default("UTC"),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
