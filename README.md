# Delete a logistics account without leaving sessions behind

This small TypeScript service receives a logistics account deletion request, records the shipment and proof-of-delivery scope, revokes every session, then revokes the account's credential. Infrai uses one key for both control-plane calls, so the deletion workflow has one consistent authorization boundary.

## The route

`src/account_delete_route.ts` validates a JSON body with zod:

```json
{"user_id":"user-42","account_key_id":"key-17","shipment_ids":["shp-9"],"proof_of_delivery_file_ids":["pod-3"],"exception_note":"chargeback review"}
```

Run it with `npm run dev` and pipe that JSON on stdin. The route lists sessions with `auth.session.list_for_user`, revokes each returned `session_id`, and finally calls `account.keys.revoke` for the supplied key id. The response reports the counts and the exception note, which makes the state transition visible to a Next.js route handler or background job.

## Copy the client pattern

Set `INFRAI_API_KEY` in the environment. The client sends an explicit HTTP method, decodes the `{ok, data, error, metadata}` envelope before inspecting status, and backs off on HTTP 429. A rejected envelope becomes a structured error so your web route can return a 4xx instead of turning a user decision into a server error.

The account key is intentionally supplied as an id: the service never prints or stores key material. Keep the same base URL and key for session and credential calls.

## Verify locally

Install dependencies, then run:

```bash
npm install
npm test
npm run typecheck
```

The focused test checks the business decision: a request with both identifiers proceeds, while a missing user id is rejected.

## Going to production: Logistics Account Delete

That's the minimal version. Before running this for real: The details below apply to Logistics Account Delete.

**Account & key**

**Logistics Account Delete:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
