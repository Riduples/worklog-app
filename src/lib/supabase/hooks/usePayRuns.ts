"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentBusinessId } from "@/lib/supabase/currentBusiness";
import type { Tables } from "@/lib/types/database";

export type PayRun = Tables<"pay_runs">;

const QUERY_KEY = ["pay_runs"];
const LOANS_KEY = ["worker_loans"];
const LEAVE_KEY = ["worker_leave"];
const EXPENSES_KEY = ["expenses"];

export function usePayRuns() {
  const supabase = createClient();
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_runs").select("*").order("pay_date", { ascending: false });
      if (error) throw error;
      return data as PayRun[];
    },
  });
}

export type CreatePayRunInput = {
  staffId: string;
  workerName: string;
  payPeriod: "Weekly" | "Fortnightly" | "Monthly";
  payDate: string;
  unitsWorked: number;
  baseRate: number;
  overtimeAmount: number;
  allowancesAmount: number;
  grossWages: number;
  uifEmployee: number;
  uifEmployer: number;
  paye: number;
  sdl: number;
  loanDeducted: number;
  otherDeductions: number;
  otherDeductionDesc: string | null;
  leaveDays: number;
  leaveType: string | null;
  netPay: number;
  status: "prepared" | "approved";
};

export function useCreatePayRun() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePayRunInput) => {
      const businessId = await getCurrentBusinessId(supabase);
      const { data, error } = await supabase.rpc("create_pay_run", {
        p_business_id: businessId,
        p_staff_id: input.staffId,
        p_worker_name: input.workerName,
        p_pay_period: input.payPeriod,
        p_pay_date: input.payDate,
        p_units_worked: input.unitsWorked,
        p_base_rate: input.baseRate,
        p_overtime_amount: input.overtimeAmount,
        p_allowances_amount: input.allowancesAmount,
        p_gross_wages: input.grossWages,
        p_uif_employee: input.uifEmployee,
        p_uif_employer: input.uifEmployer,
        p_paye: input.paye,
        p_sdl: input.sdl,
        p_loan_deducted: input.loanDeducted,
        p_other_deductions: input.otherDeductions,
        p_other_deduction_desc: input.otherDeductionDesc ?? "",
        p_leave_days: input.leaveDays,
        p_leave_type: input.leaveType ?? "",
        p_net_pay: input.netPay,
        p_status: input.status,
      });
      if (error) throw error;
      return data as PayRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOANS_KEY });
      queryClient.invalidateQueries({ queryKey: LEAVE_KEY });
      queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
    },
  });
}
