import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenDto, SignInDto, SignUpDto } from './dto/auth.dto';
import { AuthUser } from './types/auth-user.type';
import { SafeUser } from './types/safe-user.type';

const ACCESS_TOKEN_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ??
  '15m') as JwtSignOptions['expiresIn'];
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS ?? 30);
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    this.validateSignUp(dto);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
      },
    });

    return this.buildAuthResponse(user);
  }

  async signIn(dto: SignInDto) {
    this.validateSignIn(dto);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.signAccessToken(storedToken.user);
    const refreshToken = await this.createRefreshToken(storedToken.user.id);

    return { accessToken, refreshToken };
  }

  async signOut(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async me(user: AuthUser): Promise<SafeUser> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });

    if (!currentUser) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.toSafeUser(currentUser);
  }

  private async buildAuthResponse(user: User) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: this.toSafeUser(user),
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const refreshToken = randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
      },
    });

    return refreshToken;
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      companyName: user.companyName,
      phone: user.phone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private validateSignUp(dto: SignUpDto) {
    this.validateSignIn(dto);

    if (!Object.values(UserRole).includes(dto.role)) {
      throw new BadRequestException('role must be SHIPPER, BROKER, or ADMIN');
    }
  }

  private validateSignIn(dto: SignInDto) {
    if (!dto.email) {
      throw new BadRequestException('email is required');
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }
  }
}
