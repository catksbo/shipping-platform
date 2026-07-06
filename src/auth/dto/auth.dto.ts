import { UserRole } from '@prisma/client';

export class SignUpDto {
  email!: string;
  password!: string;
  role!: UserRole;
  name?: string;
  companyName?: string;
  phone?: string;
}

export class SignInDto {
  email!: string;
  password!: string;
}

export class RefreshTokenDto {
  refreshToken!: string;
}
