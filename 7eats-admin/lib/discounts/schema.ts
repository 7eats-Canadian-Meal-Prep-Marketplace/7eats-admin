import { z } from "zod";

const money = z
  .number()
  .positive()
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
    "At most 2 decimal places",
  );

export const discountInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    discountType: z.enum(["percentage", "fixed"]),
    value: money,
    maxDiscountAmount: money.optional().nullable(),
    minOrderSubtotal: z
      .number()
      .nonnegative()
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
        "At most 2 decimal places",
      )
      .optional()
      .nullable(),
    perUserLimit: z.number().int().min(1).max(1000),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.discountType !== "percentage" || d.value <= 100, {
    message: "Percentage discount cannot exceed 100",
    path: ["value"],
  })
  .refine((d) => !(d.startsAt && d.endsAt) || d.endsAt > d.startsAt, {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export type DiscountInput = z.infer<typeof discountInputSchema>;
