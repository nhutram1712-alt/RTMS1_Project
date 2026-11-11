import { Role, UserStatus } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  roomId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

