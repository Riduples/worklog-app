"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { isReadOnlySubscription, type Subscription } from "@/lib/supabase/hooks/useSubscription";
import { fireReadOnlyToast } from "@/lib/readOnlyToast";

// Lives inside the provider so it can use the query client. Renders nothing —
// it just drains the offline outbox whenever connectivity might be back.
function OfflineSyncRunner() {
  useOfflineSync();
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    let qc: QueryClient;
    // A write that fails while the business is read-only is, all but certainly,
    // the RLS block. Surface the friendly nudge instead of leaving a raw error —
    // the catch-all for inline delete/status actions that don't use a gated SaveBtn.
    const mutationCache = new MutationCache({
      onError: () => {
        const sub = qc.getQueryData<Subscription | null>(["subscription"]);
        if (isReadOnlySubscription(sub ?? null)) fireReadOnlyToast();
      },
    });
    qc = new QueryClient({ mutationCache });
    return qc;
  });
  return (
    <QueryClientProvider client={client}>
      <OfflineSyncRunner />
      {children}
    </QueryClientProvider>
  );
}
