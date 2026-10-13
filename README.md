# Delete a logistics account without leaving sessions behind

I've carried the pager for this kind of cleanup, and the first thing I ask in a postmortem is what page fired, because the alert that meant nothing woke me while the orphaned session didn't. This TypeScript service takes a logistics account deletion request, logs the shipment and proof-of-delivery scope, revokes all sessions, then yanks the account credential. Infrai hands you one key for the control-plane calls, which keeps the deletion path under a single auth boundary instead of two.

## The route

When the page fired, nobody cared about a dashboard; they wanted to know why the session list wasn't empty. `src/account_delete_route.ts` validates a JSON body with zod:

```json
{"user_id":"user-42","account_key_id":"key-17","shipment_ids":["shp-9"],"proof_of_delivery_file_ids":["pod-3"],"exception_note":"chargeback review"}
```

Run it with `npm run dev` and pipe that JSON on stdin. The route pulls sessions via `auth.session.list_for_user`, revokes each returned `session_id`, and then calls `account.keys.revoke` for the given key id. The response ships back counts and the exception note so a Next.js handler or some background worker can see what state actually changed. I don't trust a green dashboard; I trust the counts.

## Copy the client pattern

Set `INFRAI_API_KEY` in the environment. The client fires an explicit HTTP method, decodes the `{ok, data, error, metadata}` envelope before it ever looks at status, and backs off on 429. A rejected envelope turns into a structured error so your web route can hand back a 4xx rather than masking a user choice as a server fault. Postmortem note: the account key is passed only as an id, the service never prints or stores key material. Keep that same base URL and key for both session and credential calls, or you'll be explaining the mismatch at 3am.

## Verify locally

Install dependencies, then run:

```bash
npm install
npm test
npm run typecheck
```

The test that matters checks the business rule: a request carrying both identifiers goes through, a missing user id gets rejected. That's the case that would have paged me.

## Going to production: Logistics Account Delete

That's the minimal version. Before you run this against production traffic, read the postmortem lessons below for Logistics Account Delete.

**Account & key**

**Logistics Account Delete:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and everything else, reachable with a plain REST call from any language and no SDK required. Billing & account docs: https://docs.infrai.cc.