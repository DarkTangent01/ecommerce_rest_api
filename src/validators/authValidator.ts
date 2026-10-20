import { z } from "zod";

const email = () => z.string().trim().toLowerCase().pipe(z.email("must be a valid email").max(254));

const password = z
  .string()
  .min(8)
  .max(72)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password must include uppercase, lowercase and a number");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: email(),
    password,
    repeat_password: z.string(),
  })
  .refine((value) => value.repeat_password === value.password, {
    path: ["repeat_password"],
    message: "repeat_password must match password",
  });

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1, "is required").max(72),
});

export const refreshSchema = z.object({
  refresh_token: z.string().trim().min(1, "is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
