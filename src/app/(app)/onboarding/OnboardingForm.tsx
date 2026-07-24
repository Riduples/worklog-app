"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/businessTypes";
import { useTaxRates } from "@/lib/taxRates";
import { fmt } from "@/lib/format";

const NAVY = "#0C4A6E";
const MUTED = "#64748b";

const STEPS = [
  { title: "Your business", subtitle: "The basics — you can change everything later." },
  { title: "Contact details", subtitle: "Optional. These show on your quotes and invoices." },
  { title: "How customers pay you", subtitle: "Optional. Prints your bank details on invoices so customers know where to pay." },
  { title: "Tax & SARS", subtitle: "Optional. Leave blank whatever you're not registered for." },
];

const DONE = STEPS.length; // the success step index

export function OnboardingForm({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const { SDL_ANNUAL_THRESHOLD } = useTaxRates();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [vatPeriod, setVatPeriod] = useState("Bi-monthly");
  const [payeRef, setPayeRef] = useState("");
  const [sdlRegistered, setSdlRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const go = (href: string) => {
    router.push(href);
    router.refresh();
  };

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    // The plan is NOT inserted — a trigger starts a 14-day Structured trial for
    // every new business (migration 0066) and the subscription drives the plan.
    const { error } = await supabase.from("business_profiles").insert({
      user_id: userId,
      name: name.trim(),
      business_type: businessType || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      bank_name: bankName.trim() || null,
      bank_account: bankAccount.trim() || null,
      bank_branch: bankBranch.trim() || null,
      bank_ref: bankRef.trim() || null,
      vat_number: vatNumber.trim() || null,
      vat_period: vatPeriod,
      paye_ref: payeRef.trim() || null,
      sdl_registered: sdlRegistered,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep(DONE);
  };

  // ── Success step ──
  if (step === DONE) {
    return (
      <div style={{ textAlign: "center", paddingTop: 8 }}>
        <div style={{ fontSize: 46, marginBottom: 10 }}>🎉</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>You&apos;re all set up!</h1>
        <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, marginBottom: 8 }}>
          Your 14-day free trial has started — everything unlocked, no card needed.
        </p>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 22 }}>
          A couple of things you can set up now (or anytime, from your <strong>Business Hub</strong>):
        </p>

        <NextStep
          icon="💳"
          title="Add your bank accounts"
          desc="Track balances and see money per account."
          onClick={() => go("/accounts")}
        />
        <NextStep
          icon="👥"
          title="Invite your team"
          desc="Add people and choose what each can access."
          onClick={() => go("/team")}
        />

        <button
          onClick={() => go("/dashboard")}
          style={{ width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 14, padding: 15, fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 10 }}
        >
          Go to my dashboard →
        </button>
      </div>
    );
  }

  const meta = STEPS[step]!;
  const canContinue = step !== 0 || name.trim().length > 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div>
      {/* Progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= step ? NAVY : "#e2e8f0" }} />
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Step {step + 1} of {STEPS.length}</div>
      <h1 style={{ fontSize: 21, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{meta.title}</h1>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 18 }}>{meta.subtitle}</p>

      {/* Step 0 — basics */}
      {step === 0 && (
        <>
          <Field label="Business / trading name">
            <Input value={name} onChange={setName} placeholder="e.g. Thabo's Plumbing" required autoFocus />
          </Field>
          <Field label="What kind of business is it?">
            <Chips
              options={BUSINESS_TYPES.map((t) => t.label)}
              selected={BUSINESS_TYPES.find((t) => t.id === businessType)?.label ?? ""}
              onSelect={(label) => setBusinessType(BUSINESS_TYPES.find((t) => t.label === label)?.id ?? "")}
            />
            <p style={{ fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
              We&apos;ll start you with the tools this kind of business usually needs — you can switch every tool on later.
            </p>
          </Field>
        </>
      )}

      {/* Step 1 — contact */}
      {step === 1 && (
        <>
          <Field label="Address">
            <Input value={address} onChange={setAddress} placeholder="Street, suburb, city" autoFocus />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={setPhone} placeholder="082 123 4567" type="tel" />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          </Field>
        </>
      )}

      {/* Step 2 — getting paid */}
      {step === 2 && (
        <>
          <Field label="Bank">
            <Input value={bankName} onChange={setBankName} placeholder="e.g. FNB, Capitec, Standard Bank" autoFocus />
          </Field>
          <Field label="Account number">
            <Input value={bankAccount} onChange={setBankAccount} placeholder="Your business account number" />
          </Field>
          <Field label="Branch code (optional)">
            <Input value={bankBranch} onChange={setBankBranch} placeholder="e.g. 250655" />
          </Field>
          <Field label="Payment reference (optional)">
            <Input value={bankRef} onChange={setBankRef} placeholder="e.g. your trading name" />
          </Field>
        </>
      )}

      {/* Step 3 — tax */}
      {step === 3 && (
        <>
          <Field label="VAT number">
            <Input value={vatNumber} onChange={setVatNumber} placeholder="Leave blank if not VAT registered" autoFocus />
          </Field>
          {vatNumber.trim() && (
            <Field label="VAT period">
              <Chips options={["Monthly", "Bi-monthly"]} selected={vatPeriod} onSelect={(v) => v && setVatPeriod(v)} />
            </Field>
          )}
          <Field label="PAYE reference number">
            <Input value={payeRef} onChange={setPayeRef} placeholder="From SARS eFiling — needed for EMP201" />
          </Field>
          <Field label="SDL (Skills Development Levy)">
            <button
              type="button"
              onClick={() => setSdlRegistered((p) => !p)}
              style={{ width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${sdlRegistered ? NAVY : "#e2e8f0"}`, background: sdlRegistered ? "#F0F9FF" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={{ fontSize: 18 }}>{sdlRegistered ? "✅" : "⬜"}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: sdlRegistered ? NAVY : "#111" }}>Registered for SDL</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{`Required once your annual payroll exceeds ${fmt(SDL_ANNUAL_THRESHOLD)}`}</div>
              </div>
            </button>
          </Field>
        </>
      )}

      {step === 0 && (
        <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "12px 14px", margin: "14px 0 4px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0369A1", marginBottom: 3 }}>🎁 Your 14-day free trial starts when you finish</div>
          <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.55 }}>Everything unlocked, no card needed.</div>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        {step > 0 && (
          <button
            onClick={() => { setError(""); setStep((s) => s - 1); }}
            style={{ flex: "0 0 auto", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "13px 20px", fontSize: 14, fontWeight: 700, color: MUTED, cursor: "pointer" }}
          >
            Back
          </button>
        )}
        {isLast ? (
          <div style={{ flex: 1 }}>
            <SaveBtn label={loading ? "Setting up..." : "Finish setup"} icon="✅" onClick={handleFinish} disabled={loading || !name.trim()} />
          </div>
        ) : (
          <button
            onClick={() => { setError(""); setStep((s) => s + 1); }}
            disabled={!canContinue}
            style={{ flex: 1, background: canContinue ? NAVY : "#94a3b8", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 800, cursor: canContinue ? "pointer" : "default" }}
          >
            Continue →
          </button>
        )}
      </div>

      {step > 0 && !isLast && (
        <button
          onClick={() => { setError(""); setStep((s) => s + 1); }}
          style={{ width: "100%", background: "none", border: "none", color: MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 12, textDecoration: "underline" }}
        >
          Skip for now
        </button>
      )}

      <p style={{ textAlign: "center", fontSize: 11.5, color: "#94a3b8", marginTop: 16, lineHeight: 1.5 }}>
        Only your business name is needed — everything else you can add later in your{" "}
        <Link href="/business" style={{ color: NAVY, fontWeight: 700 }}>Business Hub</Link>.
      </p>
    </div>
  );
}

function NextStep({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: "100%", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: MUTED, marginTop: 1 }}>{desc}</span>
      </span>
      <span style={{ color: "#cbd5e1", fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}
