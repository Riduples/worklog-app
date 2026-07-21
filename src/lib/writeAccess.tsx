"use client";

import { createContext, useContext } from "react";
import { useTrialState } from "@/lib/supabase/hooks/useSubscription";

// Whether the current business may write. Read-only businesses (an expired trial,
// later a lapsed/paused subscription) can view and export but not create/edit.
//
// The default is "writable" so any consumer rendered OUTSIDE the provider — the
// login/signup forms, which sit in (auth) with no react-query provider — behaves
// normally. useContext returns this default when no provider is mounted, so those
// forms never touch the subscription query and never crash.
const WriteAccessContext = createContext<{ isReadOnly: boolean }>({ isReadOnly: false });

export function WriteAccessProvider({ children }: { children: React.ReactNode }) {
  const { isReadOnly } = useTrialState();
  return <WriteAccessContext.Provider value={{ isReadOnly }}>{children}</WriteAccessContext.Provider>;
}

export function useWriteAccess() {
  return useContext(WriteAccessContext);
}
