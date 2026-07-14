"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables } from "@/lib/types/database";
import type { Permissions } from "@/lib/permissions";

export type Invite = Tables<"invites">;

const QUERY_KEY = ["invites"];

export function usePendingInvites() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    },
  });
}

export function useCreateInvite() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      role,
      permissions,
    }: {
      email: string;
      role: "owner" | "member";
      permissions: Permissions;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase
        .from("invites")
        .insert({ business_id: businessId, email: email.trim().toLowerCase(), role, permissions, invited_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as Invite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRevokeInvite() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
