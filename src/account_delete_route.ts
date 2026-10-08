import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";

export const deletionRequest = z.object({
  user_id: z.string().min(1),
  account_key_id: z.string().min(1),
  shipment_ids: z.array(z.string()).default([]),
  proof_of_delivery_file_ids: z.array(z.string()).default([]),
  exception_note: z.string().optional()
});
export type DeletionRequest = z.infer<typeof deletionRequest>;

export function shouldDelete(input: DeletionRequest): boolean {
  return input.user_id.length > 0 && input.account_key_id.length > 0;
}

export async function deleteLogisticsAccount(input: unknown, client = new InfraiClient()) {
  const parsed = deletionRequest.parse(input);
  if (!shouldDelete(parsed)) throw new Error("Account deletion needs a user and account key id");
  const sessions = await client.request<Array<{ session_id: string }>>("GET", `/auth/session/list_for_user/${encodeURIComponent(parsed.user_id)}`);
  for (const session of sessions) await client.request("POST", `/auth/session/revoke/${encodeURIComponent(session.session_id)}`, { session_id: session.session_id });
  await client.request("DELETE", `/account/keys/revoke/${encodeURIComponent(parsed.account_key_id)}`);
  return { user_id: parsed.user_id, revoked_sessions: sessions.length, revoked_account_key: parsed.account_key_id, shipments_reviewed: parsed.shipment_ids.length, proof_files_reviewed: parsed.proof_of_delivery_file_ids.length, exception_note: parsed.exception_note ?? null };
}

export function mapError(error: unknown) {
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) return { status: error.status, body: { error: error.code, message: error.message } };
  return { status: 500, body: { error: "ACCOUNT_DELETION_FAILED" } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const body = await new Promise<string>(resolve => { let data = ""; process.stdin.on("data", chunk => data += chunk); process.stdin.on("end", () => resolve(data)); });
  try { console.log(JSON.stringify(await deleteLogisticsAccount(JSON.parse(body)))); } catch (error) { console.error(JSON.stringify(mapError(error))); process.exitCode = 1; }
}
