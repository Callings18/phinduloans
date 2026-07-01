import { describe, expect, it } from "vitest";
import { mapRpcToReceiptData } from "@phinduloans/shared/utils/handlePaymentReceipt";

describe("mapRpcToReceiptData", () => {
  it("maps a successful record_loan_payment envelope", () => {
    const mapped = mapRpcToReceiptData({
      success: true,
      receipt_no: "RCP-123",
      borrower_name: "Jane Doe",
      borrower_phone: "0977123456",
      loan_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      loan_amount: "5000",
      repayment_amount: "250",
      payment_method: "mobile_money",
      paid_date: "2026-07-01",
      installment_number: "2",
      total_installments: "6",
      total_paid: "750",
      outstanding_balance: "4250",
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.receipt_no).toBe("RCP-123");
    expect(mapped?.borrower_name).toBe("Jane Doe");
    expect(mapped?.loan_amount).toBe(5000);
    expect(mapped?.repayment_amount).toBe(250);
    expect(mapped?.installment_number).toBe(2);
    expect(mapped?.outstanding_balance).toBe(4250);
  });

  it("returns null when RPC did not succeed", () => {
    expect(mapRpcToReceiptData({ success: false, error: "denied" })).toBeNull();
    expect(mapRpcToReceiptData(null)).toBeNull();
  });

  it("falls back to transaction_reference for receipt number", () => {
    const mapped = mapRpcToReceiptData({
      success: true,
      transaction_reference: "PAY-999",
      borrower_name: "John",
      amount: 100,
    });
    expect(mapped?.receipt_no).toBe("PAY-999");
    expect(mapped?.repayment_amount).toBe(100);
  });
});
