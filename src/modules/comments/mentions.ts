import "server-only";
import { AppError } from "../../lib/api/errors.ts";
import { database } from "../../database/client.ts";

const mentionPattern =
  /(?:^|[^A-Za-z0-9_.@-])@([A-Za-z0-9][A-Za-z0-9_.-]{0,63})/g;
const MAX_MENTIONS = 25;

export function extractMentionTokens(body: string) {
  const tokens = new Set<string>();
  for (const match of body.matchAll(mentionPattern))
    tokens.add(match[1]!.toLowerCase());
  if (tokens.size > MAX_MENTIONS) throw new AppError("BAD_REQUEST");
  return [...tokens];
}

function keysForUser(user: { name: string; email: string }) {
  const emailKey = user.email.slice(0, user.email.indexOf("@")).toLowerCase();
  const nameKey = user.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [emailKey, nameKey];
}

export async function resolveMentions(organizationId: string, body: string) {
  const tokens = extractMentionTokens(body);
  if (!tokens.length) return [];
  const memberships = await database.membership.findMany({
    where: { organizationId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  const resolved = tokens.map((token) => {
    const matches = memberships
      .map(({ user }) => user)
      .filter((user) => keysForUser(user).includes(token));
    if (matches.length !== 1) throw new AppError("BAD_REQUEST");
    return matches[0]!;
  });
  return resolved;
}
