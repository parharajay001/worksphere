import "server-only";
import { database } from "../../database/client.ts";

export async function findUserByEmail(email: string) {
  return database.user.findUnique({ where: { email } });
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  return database.user.create({
    data: input,
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
}
