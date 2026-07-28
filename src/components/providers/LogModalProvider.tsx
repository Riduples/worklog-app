"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useWriteAccess } from "@/lib/writeAccess";
import { IncomeModal } from "@/components/modals/IncomeModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";

// The structured income/expense capture forms used to open from the dashboard's
// "Money In" / "Money Out" buttons. The home now leads with Quick Log, so those
// buttons are gone — but the forms still need a home: the desktop sidebar's Money
// group and the mobile "More" sheet. Hosting the modals here, above the whole app
// shell, lets any of those surfaces open them over the current page with no
// navigation and no duplicated modal state.
type LogKind = "income" | "expense";

const LogModalContext = createContext<{ openLog: (kind: LogKind) => void } | null>(null);

export function useLogModal() {
  const ctx = useContext(LogModalContext);
  if (!ctx) throw new Error("useLogModal must be used within LogModalProvider");
  return ctx;
}

export function LogModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<LogKind | null>(null);
  const router = useRouter();
  const { isReadOnly } = useWriteAccess();

  // A lapsed/expired account can look but not write, so opening a capture form it
  // can't save from is a dead end — send it to checkout, exactly as the Quick Log
  // button already does.
  const openLog = (kind: LogKind) => {
    if (isReadOnly) {
      router.push("/billing/checkout");
      return;
    }
    setOpen(kind);
  };

  return (
    <LogModalContext.Provider value={{ openLog }}>
      {children}
      {open === "income" && <IncomeModal onClose={() => setOpen(null)} />}
      {open === "expense" && <ExpenseModal onClose={() => setOpen(null)} />}
    </LogModalContext.Provider>
  );
}
