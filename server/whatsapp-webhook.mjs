import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(body, header, appSecret) {
  if (!appSecret || typeof header !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(header)) return false;
  const expected = createHmac("sha256", appSecret).update(body).digest();
  const signature = Buffer.from(header.slice(7), "hex");
  return signature.length === expected.length && timingSafeEqual(expected, signature);
}

export function parseWhatsAppEvents(payload) {
  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return [];
  const events = [];
  for (const entry of payload.entry.slice(0, 20)) {
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : []).slice(0, 20)) {
      if (change?.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = String(value?.metadata?.phone_number_id || "");
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      for (const m of (Array.isArray(value?.messages) ? value.messages : []).slice(0, 20)) {
        if (typeof m?.id !== "string" || typeof m?.from !== "string") continue;
        const sender = m.from.replace(/\D/g, "");
        const contact = contacts.find(c => String(c?.wa_id) === m.from);
        events.push({
          messageId:m.id, sender, phoneNumberId, type:String(m.type || "unknown"),
          text:m.type === "text" && typeof m.text?.body === "string" ? m.text.body.slice(0, 800) : "",
          senderName:typeof contact?.profile?.name === "string" ? contact.profile.name.slice(0, 100) : "",
          timestamp:Number(m.timestamp) || 0
        });
      }
    }
  }
  return events;
}

export function selectAuthorizedEvents(events, {phoneNumberId, authorizedNumbers, enabledSince}) {
  const allowlist = new Set((authorizedNumbers || []).map(v => String(v).replace(/\D/g, "")));
  return events.filter(e =>
    e.type === "text" &&
    Boolean(e.text?.trim()) &&
    Boolean(phoneNumberId) &&
    e.phoneNumberId === phoneNumberId &&
    allowlist.has(e.sender) &&
    Number.isFinite(e.timestamp) &&
    e.timestamp * 1000 >= enabledSince
  );
}
