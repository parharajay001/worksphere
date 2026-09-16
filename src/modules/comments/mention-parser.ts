import { AppError } from "../../lib/api/errors.ts";

const mentionPattern =
  /(?:^|[^A-Za-z0-9_.@-])@([A-Za-z0-9][A-Za-z0-9_.-]{0,63})/g;
const MAX_MENTIONS = 25;

export function extractMentionTokens(body: string) {
  const tokens: string[] = [];
  for (const match of body.matchAll(mentionPattern)) {
    const token = match[1]!.toLowerCase();
    if (tokens.includes(token)) throw new AppError("BAD_REQUEST");
    tokens.push(token);
  }
  if (tokens.length > MAX_MENTIONS) throw new AppError("BAD_REQUEST");
  return tokens;
}
