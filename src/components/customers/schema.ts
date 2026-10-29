import * as z from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1, 'Shop name is required'),
  contactName: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required'),
  whatsapp: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  openingBalance: z.coerce.number().default(0),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
