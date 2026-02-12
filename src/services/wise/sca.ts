import { createSign } from "node:crypto";

export function signScaChallenge(oneTimeToken: string, privateKeyBase64: string): string {
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
  const signer = createSign("SHA256");
  signer.update(oneTimeToken);
  signer.end();
  return signer.sign(privateKey, "base64");
}
