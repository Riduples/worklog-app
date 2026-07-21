"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { BackButton } from "@/components/ui/BackLink";
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_MAP,
  DEFAULT_PERMISSIONS,
  PERMISSION_PRESETS,
  TOOL_CATEGORIES,
  TOOL_LABELS,
  getCatLevel,
  matchesPreset,
  type AccessLevel,
  type Permissions,
  type ToolId,
} from "@/lib/permissions";

type PickerTarget = { toolId: ToolId } | { toolId: `__cat__${string}`; catRef: (typeof TOOL_CATEGORIES)[number] };

export function PermissionsEditor({
  memberName,
  initialPermissions,
  onSave,
  onBack,
}: {
  memberName: string;
  initialPermissions: Permissions;
  onSave: (perms: Permissions) => void;
  onBack: () => void;
}) {
  const [localPerms, setLocalPerms] = useState<Permissions>(() => ({ ...DEFAULT_PERMISSIONS(), ...initialPermissions }));
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [pickerTool, setPickerTool] = useState<PickerTarget | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activePresetId = PERMISSION_PRESETS.find((p) => matchesPreset(localPerms, p.build()))?.id ?? null;

  const setAllInCat = (cat: (typeof TOOL_CATEGORIES)[number], level: AccessLevel) => {
    setLocalPerms((p) => {
      const u = { ...p };
      cat.tools.forEach((t) => { u[t] = level; });
      return u;
    });
  };

  const activeCount = Object.values(localPerms).filter((v) => v !== "off").length;

  if (pickerTool) {
    const isCat = pickerTool.toolId.startsWith("__cat__");
    const cat = isCat ? (pickerTool as { catRef: (typeof TOOL_CATEGORIES)[number] }).catRef : null;
    const toolLabel = !isCat ? TOOL_LABELS[pickerTool.toolId as ToolId] : null;
    const currentLevel = isCat && cat ? getCatLevel(localPerms, cat) : localPerms[pickerTool.toolId as ToolId] || "off";
    return (
      <Modal title="Set access level" onClose={() => setPickerTool(null)}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 4 }}>
            {isCat && cat ? `${cat.icon} ${cat.label} — all ${cat.tools.length} tools` : `${toolLabel?.icon} ${toolLabel?.label}`}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            {isCat ? "Sets the same level for every tool in this category at once" : "Sets access for this specific tool only"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACCESS_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                if (isCat && cat) setAllInCat(cat, l.id);
                else setLocalPerms((p) => ({ ...p, [pickerTool.toolId as ToolId]: l.id }));
                setPickerTool(null);
              }}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                border: `2px solid ${currentLevel === l.id ? l.color : l.border}`,
                borderRadius: 12,
                background: currentLevel === l.id ? l.bg : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 24, width: 30, textAlign: "center", flexShrink: 0 }}>{l.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: currentLevel === l.id ? l.color : "#111" }}>{l.label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{l.desc}</div>
              </div>
              {currentLevel === l.id && <span style={{ fontSize: 18, color: l.color, flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
        <BackButton onClick={() => setPickerTool(null)} block />
      </Modal>
    );
  }

  return (
    <Modal title={`Permissions — ${memberName}`} onClose={onBack}>
      <div style={{ background: "#F0F9FF", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#0369A1", lineHeight: 1.5 }}>
        Pick what {memberName} should be able to do. Most people only need one of these three.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {PERMISSION_PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setLocalPerms(preset.build())}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                border: `2px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                borderRadius: 12,
                background: active ? "#F0F9FF" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 24, width: 30, textAlign: "center", flexShrink: 0 }}>{preset.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#0C4A6E" : "#111" }}>{preset.label}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{preset.desc}</div>
              </div>
              {active && <span style={{ fontSize: 18, color: "#0C4A6E", flexShrink: 0 }}>✓</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setShowAdvanced((p) => !p)}
        style={{ width: "100%", background: "none", border: "none", borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "12px 0 6px", textAlign: "center" }}
      >
        {showAdvanced ? "▲ Hide advanced options" : "▾ Customize per tool instead"}
      </button>

      {showAdvanced && (
        <>
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12, padding: "10px 14px", marginBottom: 12, marginTop: 8, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
            <strong>{activeCount} tool{activeCount !== 1 ? "s" : ""} active</strong> for {memberName}. Tap a category to expand, then set the level per tool. Or use the buttons below to set all at once.
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {ACCESS_LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  const all: Permissions = {};
                  TOOL_CATEGORIES.forEach((c) => c.tools.forEach((t) => { all[t] = l.id; }));
                  setLocalPerms(all);
                }}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${l.border}`, background: l.bg, color: l.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                {l.icon} All {l.label}
              </button>
            ))}
          </div>

          {TOOL_CATEGORIES.map((cat) => {
            const catLevel = getCatLevel(localPerms, cat);
            const catMeta = ACCESS_LEVEL_MAP[catLevel] || ACCESS_LEVEL_MAP.off;
            const isOpen = !!expandedCats[cat.id];
            const activeInCat = cat.tools.filter((t) => (localPerms[t] || "off") !== "off").length;
            return (
              <div key={cat.id} style={{ border: `1.5px solid ${isOpen ? "#0C4A6E" : "#e2e8f0"}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", background: isOpen ? "#F0F9FF" : "#f8fafc" }}>
                  <div
                    onClick={() => setExpandedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{cat.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {activeInCat > 0 ? `${activeInCat}/${cat.tools.length} tools active` : `${cat.tools.length} tools — all off`}
                      </div>
                    </div>
                    <span style={{ fontSize: 16, color: isOpen ? "#0C4A6E" : "#94a3b8", marginRight: 8 }}>{isOpen ? "▲" : "▾"}</span>
                  </div>
                  <div
                    onClick={() => setPickerTool({ toolId: `__cat__${cat.id}`, catRef: cat })}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 14px", borderLeft: "1px solid #e2e8f0", background: catMeta.bg, cursor: "pointer", flexShrink: 0, minWidth: 90 }}
                  >
                    <span style={{ fontSize: 16 }}>{catMeta.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: catMeta.color }}>{catMeta.label}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderTop: "1.5px solid #0C4A6E" }}>
                    {cat.tools.map((toolId) => {
                      const level = localPerms[toolId] || "off";
                      const meta = ACCESS_LEVEL_MAP[level] || ACCESS_LEVEL_MAP.off;
                      const tl = TOOL_LABELS[toolId];
                      if (!tl) return null;
                      return (
                        <div key={toolId} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #F0F9FF", background: level !== "off" ? "#F0F9FF" : "#fff" }}>
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{tl.icon}</span>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{tl.label}</div>
                              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{tl.desc}</div>
                            </div>
                          </div>
                          <div
                            onClick={() => setPickerTool({ toolId })}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 14px", borderLeft: "1px solid #F0F9FF", background: meta.bg, cursor: "pointer", flexShrink: 0, minWidth: 90 }}
                          >
                            <span style={{ fontSize: 16 }}>{meta.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <SaveBtn label="Save permissions" icon="✅" onClick={() => onSave(localPerms)} allowInReadOnly />
      <BackButton onClick={onBack} label="Back to team" block />
    </Modal>
  );
}
