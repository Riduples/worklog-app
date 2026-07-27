// The five price-list item types. Stored lowercase (DB CHECK); shown with the
// icon + label from the meta map below. One source of truth for the type's look
// and its type-matched form copy.

export const ITEM_TYPES = ["service", "product", "labour", "material", "package"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

type ItemTypeMeta = { icon: string; label: string; color: string; bg: string; placeholder: string; hint: string };

export const ITEM_TYPE_META: Record<ItemType, ItemTypeMeta> = {
  service: { icon: "🛎️", label: "Service", color: "#6d28d9", bg: "#f5f3ff", placeholder: "e.g. Full groom, Haircut, 30min consultation", hint: "Something you do — haircut, groom, consultation, repair" },
  product: { icon: "📦", label: "Product", color: "#1e40af", bg: "#eff6ff", placeholder: "e.g. Shampoo 500ml, Relaxer cream, Spare part", hint: "Something you sell — shampoo, parts, goods" },
  labour: { icon: "⚒️", label: "Labour", color: "#0369A1", bg: "#F0F9FF", placeholder: "e.g. Plumbing labour, Hourly rate, Call-out fee", hint: "Your time — hourly rate, day rate, call-out fee" },
  material: { icon: "🧱", label: "Material", color: "#b45309", bg: "#fff7ed", placeholder: "e.g. Copper pipe 15mm, Cement 50kg, Paint 5L", hint: "Raw materials you buy and use on jobs" },
  package: { icon: "📋", label: "Package", color: "#0f766e", bg: "#f0fdfa", placeholder: "e.g. Starter package, Monthly retainer", hint: "A bundle of services or products sold together" },
};

export function itemTypeMeta(t: string | null | undefined): ItemTypeMeta {
  return ITEM_TYPE_META[t as ItemType] ?? ITEM_TYPE_META.product;
}

/** Normalise a free-text CSV value to a valid item type, defaulting to product. */
export function normaliseItemType(raw: string | null | undefined): ItemType {
  const v = (raw ?? "").trim().toLowerCase();
  return (ITEM_TYPES as readonly string[]).includes(v) ? (v as ItemType) : "product";
}
