import { randomBytes } from "crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeInviteCode(length = 6) {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) code += alphabet[bytes[i]! % alphabet.length];
  return code;
}
