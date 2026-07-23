"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Cross-tenant admin reads. Each goes through a SECURITY DEFINER RPC that checks
// is_platform_admin() server-side (migration 0076) — a non-admin gets an error,
// never data.

export type AdminBusiness = {
  business_id: string;
  name: string;
  plan: string;
  business_type: string | null;
  created_at: string;
  owner_email: string | null;
  member_count: number;
  sub_status: string | null;
  sub_tier: string | null;
  current_period_end: string | null;
};

export function useAdminBusinesses() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["admin-businesses"],
    queryFn: async (): Promise<AdminBusiness[]> => {
      const { data, error } = await supabase.rpc("admin_list_businesses");
      if (error) throw error;
      return (data ?? []) as AdminBusiness[];
    },
  });
}

export type AdminPaymentEvent = {
  id: string;
  business_id: string | null;
  business_name: string | null;
  event_type: string | null;
  signature_valid: boolean | null;
  source_ip: string | null;
  processed_at: string;
  raw_payload: unknown;
};

export type AdminAdmin = {
  user_id: string;
  email: string | null;
  note: string | null;
  created_at: string;
};

export function useAdminAdmins() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["admin-admins"],
    queryFn: async (): Promise<AdminAdmin[]> => {
      const { data, error } = await supabase.rpc("admin_list_admins");
      if (error) throw error;
      return (data ?? []) as AdminAdmin[];
    },
  });
}

export function useAdminPaymentEvents(businessId?: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["admin-payment-events", businessId ?? "all"],
    queryFn: async (): Promise<AdminPaymentEvent[]> => {
      const { data, error } = await supabase.rpc(
        "admin_list_payment_events",
        businessId ? { p_business_id: businessId } : {}
      );
      if (error) throw error;
      return (data ?? []) as AdminPaymentEvent[];
    },
  });
}
