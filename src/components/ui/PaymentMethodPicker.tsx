import { Field } from "@/components/ui/Field";
import { ALL_PAYMENT_METHODS } from "@/lib/sarsCategories";

export function PaymentMethodPicker({
  selected,
  onSelect,
  methods = ALL_PAYMENT_METHODS,
}: {
  selected: string;
  onSelect: (v: string) => void;
  /** Which chips to show. Defaults to the union of both directions. */
  methods?: readonly string[];
}) {
  return (
    <Field label="Payment method">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {methods.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m === selected ? "" : m)}
            style={{
              padding: "9px 14px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              border: `1.5px solid ${selected === m ? "#0C4A6E" : "#e2e8f0"}`,
              background: selected === m ? "#0C4A6E" : "#fff",
              color: selected === m ? "#fff" : "#374151",
              cursor: "pointer",
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </Field>
  );
}
