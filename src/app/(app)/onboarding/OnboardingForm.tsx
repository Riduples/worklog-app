"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/businessTypes";

export function OnboardingForm({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
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
    router.push("/dashboard");
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
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn type="submit" label={loading ? "Saving..." : "Save and continue"} disabled={loading} />
    </form>
  );
}
