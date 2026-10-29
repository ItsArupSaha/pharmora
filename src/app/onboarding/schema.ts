import * as z from 'zod';

export const onboardingSchema = z.object({
  storeType: z.enum(['pharmacy', 'general']).default('pharmacy'),
  companyName: z.string().min(2, 'Store name must be at least 2 characters.'),
  subtitle: z.string().optional(),
  address: z.string().min(5, 'Please enter a valid address.'),
  phone: z.string().min(5, 'Please enter a valid phone number.'),
  bkashNumber: z.string().optional(),
  bankInfo: z.string().optional(),
  initialCash: z.coerce.number().min(0).default(0),
  initialBank: z.coerce.number().min(0).default(0),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
