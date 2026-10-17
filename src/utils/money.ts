// Money is stored as decimal currency units (e.g. 19.99) for API compatibility, but all
// arithmetic happens on integer cents so sums and discounts never accumulate float error
// (0.1 * 3 = 0.30000000000000004).

export type Cents = number;

/** Converts a decimal amount to integer cents, rounding half away from zero. */
export const toCents = (amount: number): Cents => {
  // toFixed(6) removes representation noise (1.005 * 100 = 100.49999...) before rounding.
  const scaled = Number((Math.abs(amount) * 100).toFixed(6));
  return Math.sign(amount) * Math.round(scaled);
};

export const fromCents = (cents: Cents): number => cents / 100;

/** Applies a percentage to an amount in cents, rounding to the nearest cent. */
export const percentOf = (cents: Cents, percent: number): Cents => Math.round((cents * percent) / 100);

/** Rounds an arbitrary decimal (e.g. a DB $sum) to 2 places via cents. */
export const roundMoney = (amount: number): number => fromCents(toCents(amount));
