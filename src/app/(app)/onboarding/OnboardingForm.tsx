"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { PlanPicker } from "@/components/billing/PlanPicker";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/businessTypes";
import type { Plan } from "@/lib/tiers";

export function OnboardingForm({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [plan, setPlan] = useState<Plan>("solo");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [vatNumber, setVatNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    // Note the plan is NOT inserted. A paid tier is only granted by a verified
    // payment (migration 0054/0065); letting signup write its own plan would
    // hand out a paid tier for free. New accounts land on the entry tier (the DB
    // default) until the 30-day trial machinery lands.
    const { error } = await supabase.from("business_profiles").insert({
      user_id: userId,
      name,
      // Decides which tools show on the home screen at first. Null is fine —
      // it just means no filtering, so skipping this can't hide anything.
      business_type: businessType || null,
      address,
      phone,
      email,
      vat_number: vatNumber || null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Starting on Solo? Go straight to work. Picked a higher tier? Carry the
    // intent to checkout.
    router.push(plan === "solo" ? "/dashboard" : `/billing/checkout?plan=${plan}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Business / trading name">
        <Input value={name} onChange={setName} placeholder="e.g. Thabo's Plumbing" required autoFocus />
      </Field>
      <Field label="What kind of business is it?">
        <Chips
          options={BUSINESS_TYPES.map((t) => t.label)}
          selected={BUSINESS_TYPES.find((t) => t.id === businessType)?.label ?? ""}
          onSelect={(label) => setBusinessType(BUSINESS_TYPES.find((t) => t.label === label)?.id ?? "")}
        />
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          We&apos;ll start you with the tools this kind of business usually needs. You can switch every tool on later in
          Business Details — nothing is locked.
        </p>
      </Field>
      <Field label="Address">
        <Input value={address} onChange={setAddress} placeholder="Street, suburb, city" />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={setPhone} placeholder="082 123 4567" type="tel" />
      </Field>
      <Field label="Email">
        <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      </Field>
      <Field label="VAT number (optional)">
        <Input value={vatNumber} onChange={setVatNumber} placeholder="Leave blank if not VAT registered" />
      </Field>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 10px" }}>
        Pick a plan
      </div>
      <PlanPicker selected={plan} onSelect={setPlan} />
      <p style={{ fontSize: 11, color: "#64748b", margin: "8px 0 16px", lineHeight: 1.5 }}>
        Not sure? Start on Solo — you can move up whenever your business is ready, and nothing you&apos;ve captured is
        lost either way.
      </p>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn
        type="submit"
        label={loading ? "Saving..." : plan === "solo" ? "Save and continue" : "Save and choose payment"}
        disabled={loading}
      />
    </form>
  );
}
