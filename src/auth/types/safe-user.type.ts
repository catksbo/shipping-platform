import { UserRole } from '@prisma/client';

export type SafeUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  companyName: string | null;
  phone: string | null;
  stripeAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
