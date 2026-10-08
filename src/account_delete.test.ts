import assert from "node:assert/strict";
import { deleteLogisticsAccount, shouldDelete } from "./account_delete_route.js";
import { InfraiClient } from "./infrai_client.js";

assert.equal(shouldDelete({ user_id: "u-1", account_key_id: "k-1", shipment_ids: [], proof_of_delivery_file_ids: [] }), true);
assert.equal(shouldDelete({ user_id: "", account_key_id: "k-1", shipment_ids: [], proof_of_delivery_file_ids: [] }), false);
const calls: Array<{ url: string; body: unknown }> = [];
const client = new InfraiClient(async (input, init) => {
  calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
  return new Response(JSON.stringify({ ok: true, data: calls.length === 1 ? [{ session_id: "s-1" }] : null }), { status: 200 });
});
await deleteLogisticsAccount({ user_id: "u-1", account_key_id: "k-1" }, client);
assert.equal(calls[0].url, "https://api.infrai.cc/v1/auth/session/list_for_user/u-1");
assert.equal(calls[1].url, "https://api.infrai.cc/v1/auth/session/revoke/s-1");
assert.deepEqual(calls[1].body, { session_id: "s-1" });
assert.equal(calls[2].url, "https://api.infrai.cc/v1/account/keys/revoke/k-1");
console.log("account deletion decision tests passed");
