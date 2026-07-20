import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RefreshTokenDto, SignInDto, SignUpDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUser } from './types/auth-user.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Create a shipper, broker, or admin account' })
  @ApiCreatedResponse({ description: 'User created with access and refresh tokens.' })
  @ApiBadRequestResponse({ description: 'Invalid signup payload.' })
  @ApiConflictResponse({ description: 'Email is already registered.' })
  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @ApiOperation({ summary: 'Sign in and receive access and refresh tokens' })
  @ApiCreatedResponse({ description: 'Signed in with access and refresh tokens.' })
  @ApiBadRequestResponse({ description: 'Invalid signin payload.' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @Post('signin')
  signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  @ApiOperation({ summary: 'Rotate a refresh token and receive new tokens' })
  @ApiCreatedResponse({ description: 'New access and refresh tokens returned.' })
  @ApiBadRequestResponse({ description: 'refreshToken is required.' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired.' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiCreatedResponse({ description: 'Refresh token revoked.' })
  @ApiBadRequestResponse({ description: 'refreshToken is required.' })
  @Post('signout')
  signOut(@Body() dto: RefreshTokenDto) {
    return this.authService.signOut(dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiOkResponse({ description: 'Current user profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or stale access token.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
