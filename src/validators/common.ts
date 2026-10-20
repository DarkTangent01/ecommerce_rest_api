import { z } from "zod";

// Joi (which these schemas replace) converted query/form strings by default. These helpers keep that
// behaviour so multipart forms ("25") and JSON bodies (25) validate the same way.

const toNumber = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value);
const toBoolean = (value: unknown) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};
const toDate = (value: unknown) => (typeof value === "string" || typeof value === "number" ? new Date(value) : value);

/** Joi parsed JSON strings into arrays/objects (multipart forms send `variants` as a JSON string). */
export const jsonish = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }, schema);

export const numeric = () => z.preprocess(toNumber, z.number());
export const integer = () => z.preprocess(toNumber, z.number().int());
export const boolish = () => z.preprocess(toBoolean, z.boolean());
export const dateish = () => z.preprocess(toDate, z.date());

/** A money amount: non-negative, rounded to 2 decimals (Joi `precision(2)` semantics). */
export const money = () =>
  z
    .preprocess(toNumber, z.number().min(0))
    .transform((value) => Math.round(value * 100) / 100);

/** A required string that must not be empty after trimming. */
export const requiredString = (max: number) => z.string().trim().min(1, "is required").max(max);

export const objectIdString = () => z.string().regex(/^[0-9a-fA-F]{24}$/, "must be a valid id");

export interface ValidationDetail {
  field: string;
  message: string;
}

/** Thrown (or passed to `next`) when request input fails validation; rendered as HTTP 422. */
export class RequestValidationError extends Error {
  readonly details: ValidationDetail[];

  constructor(error: z.ZodError) {
    super("Validation failed");
    this.details = error.issues.map((issue) => ({
      field: issue.path.map(String).join("."),
      message: issue.message,
    }));
  }
}

export type ValidationResult<T> = { error: RequestValidationError; value?: undefined } | { error?: undefined; value: T };

/** Validates `input` against `schema`, mirroring Joi's `{ error, value }` result shape. */
export const validate = <S extends z.ZodType>(schema: S, input: unknown): ValidationResult<z.output<S>> => {
  const result = schema.safeParse(input ?? {});
  return result.success ? { value: result.data } : { error: new RequestValidationError(result.error) };
};
