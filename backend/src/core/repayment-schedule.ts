import type { SupabaseClient } from "@supabase/supabase-js";

export type LoanForSchedule = {
  id: string;
  user_id: string;
  loan_term_months: number;
  total_repayment: number;
  monthly_payment?: number | null;
  loan_product_id?: string | null;
  term_unit?: string | null;
  repayment_start_date?: string | null;
  disbursed_at?: string | null;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function atNoonUtc(iso: string | Date): Date {
  const raw = typeof iso === "string" ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
  return new Date(`${raw}T12:00:00.000Z`);
}

function addUtcDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function addUtcMonths(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCMonth(next.getUTCMonth() + n);
  return next;
}

function skipSunday(d: Date): Date {
  return d.getUTCDay() === 0 ? addUtcDays(d, 1) : d;
}

/**
 * Admin-client schedule insert. Mirrors the staff-web helper (cadence + regenerate)
 * with Sunday skip only — holiday calendars stay in the UI regenerate button.
 */
export async function insertRepaymentSchedule(
  admin: SupabaseClient,
  loan: LoanForSchedule,
  options: { regenerateRemaining?: boolean } = {},
): Promise<void> {
  const regenerate = options.regenerateRemaining === true;

  const { data: keepRows, error: keepErr } = await admin
    .from("loan_repayments")
    .select("id, installment_number, status, amount, original_amount, principal_paid, penalty_amount, penalty_paid")
    .eq("loan_id", loan.id)
    .in("status", ["paid", "partial", "pending", "overdue"]);
  if (keepErr) throw new Error(keepErr.message);

  const normalizedRows = [...(keepRows || [])];
  if (regenerate) {
    for (const row of normalizedRows) {
      if (row.status !== "partial") continue;
      const paid = Number(row.principal_paid || 0);
      const unpaidPenalty = Math.max(0, Number(row.penalty_amount || 0) - Number(row.penalty_paid || 0));
      if (unpaidPenalty > 0.01) {
        throw new Error(
          "Cannot regenerate schedule while a partial installment has unpaid penalties. Clear penalties first.",
        );
      }
      if (paid <= 0.01) continue;
      const today = new Date().toISOString().slice(0, 10);
      const { error: normalizeErr } = await admin
        .from("loan_repayments")
        .update({
          status: "paid",
          amount: paid,
          original_amount: paid,
          principal_paid: paid,
          paid_date: today,
        })
        .eq("id", row.id);
      if (normalizeErr) throw new Error(normalizeErr.message);
      row.status = "paid";
      row.amount = paid;
      row.original_amount = paid;
      row.principal_paid = paid;
    }
  }

  const lockedNumbers = new Set<number>(
    normalizedRows
      .filter((r) => r.status === "paid" || r.status === "partial")
      .map((r) => Number(r.installment_number)),
  );
  const activeRemaining = normalizedRows.filter(
    (r) => r.status === "pending" || r.status === "overdue",
  ).length;

  if (!regenerate) {
    if (normalizedRows.length > 0) {
      await admin.from("loan_applications").update({ status: "active" }).eq("id", loan.id).neq("status", "active");
      return;
    }
  } else if (activeRemaining > 0) {
    throw new Error("Cannot regenerate schedule while pending/overdue installments still exist. Cancel them first.");
  }

  let termUnit = loan.term_unit ?? "months";
  let interestPeriod = "monthly";
  let repaymentFrequency = "monthly";
  let productCode: string | null = null;

  if (loan.loan_product_id) {
    const { data: product } = await admin
      .from("loan_products")
      .select("term_unit, interest_period, repayment_frequency, product_code")
      .eq("id", loan.loan_product_id)
      .maybeSingle();
    if (product) {
      termUnit = product.term_unit ?? termUnit;
      interestPeriod = product.interest_period ?? interestPeriod;
      repaymentFrequency = product.repayment_frequency ?? repaymentFrequency;
      productCode = product.product_code ?? null;
    }
  }

  const isMarketeer = productCode === "MARKETEER";
  const isPaydaySoft = productCode === "PAYDAY_SOFT";
  const isBullet = isPaydaySoft || repaymentFrequency === "bullet";
  const isDaily =
    !isBullet &&
    (termUnit === "days" ||
      (termUnit === "months" && (interestPeriod === "daily" || repaymentFrequency === "daily")));
  const isWeekly =
    !isBullet &&
    (termUnit === "weeks" ||
      (termUnit === "months" && (interestPeriod === "weekly" || repaymentFrequency === "weekly")));

  let paymentAmount: number;
  let numInstallments: number;

  if (isBullet) {
    numInstallments = 1;
    paymentAmount = Number(loan.total_repayment);
  } else if (isDaily) {
    if (termUnit === "days") {
      numInstallments = Number(loan.loan_term_months);
      paymentAmount = Number(loan.total_repayment) / numInstallments;
    } else {
      numInstallments = Number(loan.loan_term_months) * 30;
      paymentAmount =
        (Number(loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months)) / 30;
    }
  } else if (isWeekly) {
    if (termUnit === "weeks") {
      numInstallments = Number(loan.loan_term_months);
      paymentAmount = Number(loan.total_repayment) / numInstallments;
    } else {
      numInstallments = Number(loan.loan_term_months) * 4;
      paymentAmount =
        (Number(loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months)) / 4.33;
    }
  } else {
    numInstallments = Number(loan.loan_term_months);
    paymentAmount = Number(loan.monthly_payment ?? loan.total_repayment / loan.loan_term_months);
  }

  if (regenerate) {
    const alreadyPaidTotal = normalizedRows.reduce((sum, row) => {
      if (row.status !== "paid" && row.status !== "partial") return sum;
      const explicitPaid = Number(row.principal_paid || 0);
      return sum + (explicitPaid > 0 ? explicitPaid : Number(row.original_amount ?? row.amount ?? 0));
    }, 0);
    const remainingTotal = Math.max(0, Number(loan.total_repayment) - alreadyPaidTotal);
    const remainingInstallments = Array.from({ length: numInstallments }, (_, index) => index + 1).filter(
      (n) => !lockedNumbers.has(n),
    ).length;
    if (remainingInstallments <= 0) {
      if (remainingTotal > 0.01) {
        throw new Error("Cannot regenerate schedule: no open installment slots remain for the unpaid balance.");
      }
    } else {
      paymentAmount = remainingTotal / remainingInstallments;
    }
  }

  const startSource =
    loan.repayment_start_date && !Number.isNaN(new Date(loan.repayment_start_date).getTime())
      ? loan.repayment_start_date
      : loan.disbursed_at && !Number.isNaN(new Date(loan.disbursed_at).getTime())
        ? loan.disbursed_at
        : new Date().toISOString();
  let startDate = atNoonUtc(startSource);

  if (isMarketeer) {
    const today = atNoonUtc(new Date().toISOString());
    if (startDate.getTime() <= today.getTime()) {
      startDate = addUtcDays(today, 1);
    }
  }
  if (isDaily || isWeekly) {
    startDate = skipSunday(startDate);
  }

  const hasExplicitStartDate =
    Boolean(loan.repayment_start_date) &&
    !Number.isNaN(new Date(String(loan.repayment_start_date)).getTime());
  const anchorOnStart = (hasExplicitStartDate && (isDaily || isWeekly)) || isMarketeer;

  const repaymentRecords: Array<{
    loan_id: string;
    user_id: string;
    amount: number;
    original_amount: number;
    due_date: string;
    installment_number: number;
    status: string;
  }> = [];

  for (let i = 1; i <= numInstallments; i++) {
    if (lockedNumbers.has(i)) continue;
    const offset = anchorOnStart ? i - 1 : i;
    let dueDate: Date;
    if (isBullet) {
      dueDate = addUtcDays(startDate, isPaydaySoft ? 30 : Number(loan.loan_term_months || 30));
    } else if (isDaily) {
      dueDate = skipSunday(addUtcDays(startDate, offset));
    } else if (isWeekly) {
      dueDate = skipSunday(addUtcDays(startDate, offset * 7));
    } else {
      dueDate = skipSunday(addUtcMonths(startDate, offset));
    }
    repaymentRecords.push({
      loan_id: loan.id,
      user_id: loan.user_id,
      amount: paymentAmount,
      original_amount: paymentAmount,
      due_date: ymd(dueDate),
      installment_number: i,
      status: "pending",
    });
  }

  if (repaymentRecords.length > 0) {
    const { error: insertError } = await admin.from("loan_repayments").insert(repaymentRecords);
    if (insertError) throw new Error(insertError.message);
  }

  const { error: updateError } = await admin.from("loan_applications").update({ status: "active" }).eq("id", loan.id);
  if (updateError) throw new Error(updateError.message);
}
