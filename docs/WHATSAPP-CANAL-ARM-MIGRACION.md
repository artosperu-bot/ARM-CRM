# STECH ARM-CRM — WhatsApp webhook migration from legacy CRM (2026-11-02)

## Verified
- Existing Meta app: \`Wp_Test_N8N_001\`. Do not recreate its WhatsApp Business webhook subscription.
- Existing Cloudflare \`ARTOS-N8N\` ingress: \`whatsapp.artos.pe\` → \`http://127.0.0.1:3000\`.
- Legacy backend in \`C:\DESAROLLO\n8n\backend\`: \`GET/POST /webhooks/whatsapp\`, \`WhatsAppWebhookAdapter.ts\`, \`WhatsAppInboundProcessor.ts\`, \`WhatsAppCloudApiClient.ts\`.
- Legacy backend's \`POST\` did not check \`X-Hub-Signature-256\`. It also sent messages via Graph and ran automated follow-ups, so starting the old service as-is risks duplicate or unexpected replies.
- ARM's new \`server/whatsapp-gateway.mjs\` is the **only** process on local port 3000 and accepts the same Meta subscription URL.
- Public \`https://whatsapp.artos.pe/health\` HTTP 200; public Meta GET verification accepted the correct challenge HTTP 200. This does not imply real message handling is enabled.
- App Secret is **not** present in the old runtime config. Inbound therefore remains fail-closed (HTTP 503), not silently accepted.
- New gateway has **no outbound WhatsApp send logic**, no n8n worker, no existing chatbot engine and no write to legacy CRM.
- Test phoneNumberId \`1283086411554196\` is registered in \`arm_meta_accounts\` with \`inbound_enabled=false\`.
- Backend unit tests cover HMAC, tamper rejection, verification, QA allowlist, accepted events, dedup, and server-side Supabase RPC.

## How to enable signed inbound safely (secrets must never be pasted into chat or GitHub)

1. In Meta Developers, open the **same** Meta app, App Settings → Basic → App Secret. Copy using secure local controls only.
2. Store it on PC020 in a private environment file read by the ARM gateway as \`ARM_META_APP_SECRET\`. Keep existing \`WHATSAPP_VERIFY_TOKEN\`, \`WHATSAPP_PHONE_NUMBER_ID\`, \`SUPABASE_URL\`, and \`SUPABASE_SERVICE_ROLE_KEY\` in the private legacy \`.env\`. Never put any service-role key or Meta secret in \`VITE_*\` or GitHub.
3. Set \`ARM_WHATSAPP_TEST_NUMBERS\` to **only** the explicitly authorized test recipient(s), comma-separated digits including country code, e.g. \`51XXXXXXXXX\`. Do not use a customer's number without verifying approval.
4. Restart only the ARM gateway and check \`https://whatsapp.artos.pe/health\`: \`webhookVerifiedReady=true\`, \`inboundConnected=true\` and \`testNumbersConfigured>0\`. Outbound remains false.
5. Only after signed test delivery and account checks, enable \`public.arm_meta_accounts.inbound_enabled=true\` and set \`inbound_since=now()\` for the matching workspace, channel=\`whatsapp\`, account_ref=\`1283086411554196\`. Use an authenticated admin change with audit controls. Never backfill old messages.
6. Send a harmless message from the authorized WhatsApp test number, verify a new \`arm_inbound_events\` / \`arm_messages\` record, and confirm no duplicate event on retransmission.
7. Next phase: attach the OpenAI-only sales engine and the Meta Graph reply adapter, behind a distinct explicit \`test-only\` send flag, per-account human handoff and an idempotent outbound log. Do not enable outbound before a full end-to-end test.

## Operational safety
- \`npm run whatsapp:gateway\` on PC020 operates only on \`127.0.0.1:3000\`. Do not start the old \`n8n\backend\` while this process is running.
- If App Secret or an authorized test recipient is missing, the gateway does not write messages or reply.
- The receiver acknowledges a signed event only after durable CRM acceptance; never incorrectly 200-ACK a message that failed to persist.
- Old automations, customer history and tokens are not copied into GitHub or imported to ARM-CRM.
- Simulated prices in \`arm_offer_simulations\` must never appear on public WhatsApp: live channel mode can use only verified commercial prices.
- External tunnel remains the existing Cloudflare tunnel; no new subscription or monthly paid service was created.
