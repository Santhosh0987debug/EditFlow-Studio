import { Prisma } from "@prisma/client";
import type { UserDto } from "@editflow/shared";
import { AppError } from "../../lib/app-error";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../../lib/password";
import { prisma } from "../../lib/prisma";
import type { LoginInput, RegisterInput } from "./auth.schemas";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type PublicUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

export function toUserDto(user: PublicUser): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function registerUser(input: RegisterInput): Promise<UserDto> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      select: publicUserSelect,
    });

    return toUserDto(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(409, "An account with this email already exists.");
    }

    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<UserDto> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    // Compare against a dummy hash so invalid emails take similar time to
    // invalid passwords.
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
    throw new AppError(401, "Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password.");
  }

  return toUserDto(user);
}

export async function getUserById(userId: string): Promise<UserDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  return user ? toUserDto(user) : null;
}
