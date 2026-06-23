import { describe, expect, it } from "vitest";
import {
  borrowerInstallmentLabel,
  borrowerInterestPeriodLabel,
  borrowerSchedulePaymentColumnTitle,
  borrowerTermShortLabel,
  borrowerTermSummaryLabel,
} from "./repaymentFrequencyLabels";

describe("repaymentFrequencyLabels", () => {
  it("uses term_unit for weekly loans", () => {
    const loan = { term_unit: "weeks", loan_term_months: 12 };
    expect(borrowerTermShortLabel(loan)).toBe("12 wk");
    expect(borrowerInstallmentLabel(loan)).toBe("Weekly installment");
    expect(borrowerTermSummaryLabel(loan)).toBe("12 weeks");
    expect(borrowerSchedulePaymentColumnTitle(loan)).toBe("WEEKLY PAYMENT");
    expect(borrowerInterestPeriodLabel(loan)).toBe("weekly");
  });

  it("uses term_unit for daily loans", () => {
    const loan = { term_unit: "days", loan_term_months: 30 };
    expect(borrowerTermShortLabel(loan)).toBe("30 days");
    expect(borrowerInstallmentLabel(loan)).toBe("Daily installment");
    expect(borrowerSchedulePaymentColumnTitle(loan)).toBe("DAILY PAYMENT");
  });

  it("uses bullet repayment labels before day-based labels", () => {
    const loan = { term_unit: "days", loan_term_months: 30, repayment_frequency: "bullet" };
    expect(borrowerTermShortLabel(loan)).toBe("30 days");
    expect(borrowerInstallmentLabel(loan)).toBe("Single payment");
    expect(borrowerSchedulePaymentColumnTitle(loan)).toBe("SINGLE PAYMENT");
    expect(borrowerInterestPeriodLabel(loan)).toBe("per loan");
  });

  it("defaults to monthly", () => {
    const loan = { term_unit: "months", loan_term_months: 6 };
    expect(borrowerTermShortLabel(loan)).toBe("6 mo");
    expect(borrowerSchedulePaymentColumnTitle(loan)).toBe("MONTHLY PAYMENT");
  });
});
