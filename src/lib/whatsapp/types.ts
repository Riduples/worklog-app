// The slice of Meta's inbound webhook payload the handler actually reads. Meta
// sends a great deal more; we type only what we touch and leave the rest.
// Shape ref: WhatsApp Cloud API "messages" webhook.

export type WhatsAppInboundMessage = {
  from: string; // sender wa_id: digits, country code, no '+'
  id: string; // message id (Phase 1 will use this to dedupe re-deliveries)
  timestamp?: string;
  type: string; // "text" | "image" | "document" | "audio" | "button" | ...
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
};

export type WhatsAppInboundValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id: string }[];
  messages?: WhatsAppInboundMessage[];
  statuses?: unknown[]; // delivery / read receipts — ignored
};

export type WhatsAppWebhookBody = {
  object?: string;
  entry?: { id?: string; changes?: { value?: WhatsAppInboundValue; field?: string }[] }[];
};
