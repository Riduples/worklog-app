"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Chips } from "@/components/ui/Chips";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BUSINESS_TYPES, coreToolsFor, type BusinessType } from "@/lib/businessTypes";
import { LOGO_BUCKET, MAX_LOGO_BYTES, storagePathFromUrl } from "@/lib/logo";
import { useUpdateBusinessProfile, type BusinessProfile } from "@/lib/supabase/hooks/useBusinessProfile";

export function BusinessDetailsModal({ business, onClose }: { business: BusinessProfile; onClose: () => void }) {
  const updateProfile = useUpdateBusinessProfile();
  const [name, setName] = useState(business.name ?? "");
  const [businessType, setBusinessType] = useState<BusinessType | "">((business.business_type as BusinessType) ?? "");
  const [showAllTools, setShowAllTools] = useState(business.show_all_tools ?? false);
  const [address, setAddress] = useState(business.address ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [email, setEmail] = useState(business.email ?? "");
  const [bankName, setBankName] = useState(business.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(business.bank_account ?? "");
  const [bankBranch, setBankBranch] = useState(business.bank_branch ?? "");
  const [bankRef, setBankRef] = useState(business.bank_ref ?? "");
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoPick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("That image is larger than 2MB — try a smaller one.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    // {business_id}/logo.{ext} — the first folder segment is what the bucket's
    // RLS checks, and a fixed name means re-uploading replaces rather than
    // piling up orphans nobody ever deletes.
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${business.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Cache-bust: the path is stable, so a replaced logo would otherwise keep
    // showing the old image from cache.
    setLogoUrl(`${data.publicUrl}?v=${Date.now()}`);
    setUploading(false);
  };

  /**
   * Removes the file as well as the reference.
   *
   * Clearing logo_url alone would leave the image sitting in a public bucket,
   * still fetchable by anyone with the URL, after the owner had been told it
   * was removed. A button that says Remove has to remove.
   */
  const handleLogoRemove = async () => {
    const path = storagePathFromUrl(logoUrl, business.id);
    setLogoUrl("");
    if (!path) return;
    const supabase = createClient();
    // Best-effort: the reference is already gone, so a failure here leaves an
    // unreferenced file rather than a broken letterhead. Not worth blocking on.
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
  };

  // Preview the effect of the current choices rather than making the owner save
  // and go hunting. coreToolsFor is the same function the dashboard filters on,
  // so this can't claim something the home screen won't do.
  const preview = coreToolsFor({ business_type: businessType || null, show_all_tools: showAllTools });

  const handleSave = () => {
    setError("");
    updateProfile.mutate(
      {
        id: business.id,
        changes: {
          name: name.trim(),
          business_type: businessType || null,
          show_all_tools: showAllTools,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          bank_name: bankName.trim() || null,
          bank_account: bankAccount.trim() || null,
          bank_branch: bankBranch.trim() || null,
          bank_ref: bankRef.trim() || null,
          logo_url: logoUrl.trim() || null,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(e instanceof Error ? e.message : "Couldn't save."),
      }
    );
  };

  return (
    <Modal title="Business details" onClose={onClose}>
      <Field label="Your logo">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              flexShrink: 0,
              border: "1.5px solid #e2e8f0",
              background: logoUrl ? "#fff" : "#F59E0B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a user-uploaded
              // logo from Storage; next/image would need the host allow-listed and
              // buys nothing for a 56px preview.
              <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 24, fontWeight: 900, color: "#1B4332", fontFamily: "monospace" }}>
                {(name || "W").trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleLogoPick(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ flex: 1, background: "#f0fdf4", color: "#166534", border: "1.5px solid #d1fae5", borderRadius: 10, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {uploading ? "Uploading..." : logoUrl ? "Change" : "⬆ Upload logo"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  style={{ background: "#fff", color: "#b45309", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
              Appears on your quotes and invoices. PNG or JPG, up to 2MB. Without one we use your initial.
            </p>
          </div>
        </div>
      </Field>

      <Field label="Business / trading name">
        <Input value={name} onChange={setName} placeholder="e.g. Thabo's Plumbing" />
      </Field>

      <Field label="What kind of business is it?">
        <Chips
          options={BUSINESS_TYPES.map((t) => t.label)}
          selected={BUSINESS_TYPES.find((t) => t.id === businessType)?.label ?? ""}
          onSelect={(label) => setBusinessType(BUSINESS_TYPES.find((t) => t.label === label)?.id ?? "")}
        />
      </Field>

      <Field label="Tools on your home screen">
        <button
          type="button"
          onClick={() => setShowAllTools((p) => !p)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "12px 14px",
            borderRadius: 12,
            border: `1.5px solid ${showAllTools ? "#0C4A6E" : "#e2e8f0"}`,
            background: showAllTools ? "#F0F9FF" : "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>{showAllTools ? "✅" : "⬜"}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: showAllTools ? "#0C4A6E" : "#111" }}>Show every tool</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Turn this on to see everything WORKLOG can do, whatever your business type
            </div>
          </div>
        </button>

        <div style={{ marginTop: 8, padding: "9px 12px", background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 10, fontSize: 11, color: "#0C4A6E", lineHeight: 1.6 }}>
          {/* Deliberately no count: the core list counts tools, but the home
              screen draws tiles — Contacts is one tile for two tools, and the
              tax tools sit inside the Tax & SARS hub. A number here wouldn't
              match what the owner counts on screen. */}
          {preview === null
            ? "Your home screen will show every tool your plan and permissions allow."
            : "Your home screen will show the tools this kind of business usually needs. The rest stay switched on — nothing is locked or deleted, and none of your records are affected."}
        </div>
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

      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 10px" }}>
        How customers pay you
      </div>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #BAE6FD", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        These print on your invoices and quotes so a customer knows where to send the money. Fill in at least the bank and
        account number, or the block is left off.
      </div>

      <Field label="Bank">
        <Input value={bankName} onChange={setBankName} placeholder="e.g. FNB, Capitec, Standard Bank" />
      </Field>
      <Field label="Account number">
        <Input value={bankAccount} onChange={setBankAccount} placeholder="Your business account number" />
      </Field>
      <Field label="Branch code (optional)">
        <Input value={bankBranch} onChange={setBankBranch} placeholder="e.g. 250655" />
      </Field>
      <Field label="Payment reference (optional)">
        <Input value={bankRef} onChange={setBankRef} placeholder="e.g. your trading name" />
        <p style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
          {bankRef.trim()
            ? `Customers will be asked to use "${bankRef.trim()} / INV-2026-0001" so you can match the payment.`
            : "Leave blank and the document number alone is used as the reference."}
        </p>
      </Field>

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn
        label={updateProfile.isPending ? "Saving..." : "Save details"}
        icon="💾"
        onClick={handleSave}
        disabled={updateProfile.isPending}
      />
    </Modal>
  );
}
