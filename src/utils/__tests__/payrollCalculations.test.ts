import { describe, it, expect } from "vitest";
import { calculatePAYE, calculateNHIMA, calculateNAPSA, calculatePayroll, type TaxBand, type TaxConfig } from "../payrollCalculations";

// 2026 Zambian tax bands from DB
const taxBands: TaxBand[] = [
  { band_min: 0, band_max: 5100, rate_percent: 0, label: "Band 1: 0%" },
  { band_min: 5100.01, band_max: 7100, rate_percent: 20, label: "Band 2: 20%" },
  { band_min: 7100.01, band_max: 9200, rate_percent: 30, label: "Band 3: 30%" },
  { band_min: 9200.01, band_max: null, rate_percent: 37.5, label: "Band 4: 37.5%" },
];

/** Legacy comparison: PAYE on full gross, no personal relief (matches pre-enhancement behaviour). */
const taxConfig: TaxConfig = {
  payeBands: taxBands,
  nhima: { employee_rate_percent: 1, employer_rate_percent: 1 },
  napsa: { employee_rate_percent: 5, employer_rate_percent: 5, ceiling_amount: 30408.80 },
  personalReliefMonthly: 0,
  payeOnChargeableAfterNapsa: false,
};

describe("PAYE Calculation", () => {
  it("should return 0 for income below tax-free threshold (K5,100)", () => {
    expect(calculatePAYE(5000, taxBands)).toBe(0);
    expect(calculatePAYE(5100, taxBands)).toBe(0);
  });

  it("should calculate correctly for Band 2 income (K5,100-K7,100 at 20%)", () => {
    // Gross = 6100 => taxable in band 2 = 6100 - 5100.01 = 999.99 * 20% = ~200
    const paye = calculatePAYE(6100, taxBands);
    expect(paye).toBeGreaterThan(0);
    expect(paye).toBeLessThan(400); // max band 2 = 2000 * 20% = 400
  });

  it("should calculate correctly for Collins (gross K18,500)", () => {
    // Collins: salary 15000 + housing 2000 + transport 1000 + lunch 500 = 18500
    // Band 1: 0-5100 = K0
    // Band 2: 5100.01-7100 = 1999.99 * 20% = K400.00
    // Band 3: 7100.01-9200 = 2099.99 * 30% = K630.00
    // Band 4: 9200.01-18500 = 9299.99 * 37.5% = K3487.50
    // Total PAYE ≈ K4517.50
    const paye = calculatePAYE(18500, taxBands);
    expect(paye).toBeCloseTo(4517.50, 0);
  });

  it("should calculate correctly for David (gross K43,500)", () => {
    // David: salary 35000 + housing 5000 + transport 2500 + lunch 1000 = 43500
    // Band 1: 0-5100 = K0
    // Band 2: 5100.01-7100 = 1999.99 * 20% = K400.00
    // Band 3: 7100.01-9200 = 2099.99 * 30% = K630.00
    // Band 4: 9200.01-43500 = 34299.99 * 37.5% = K12862.50
    // Total PAYE ≈ K13892.50
    const paye = calculatePAYE(43500, taxBands);
    expect(paye).toBeCloseTo(13892.50, 0);
  });

  it("should return 0 for zero or negative income", () => {
    expect(calculatePAYE(0, taxBands)).toBe(0);
    expect(calculatePAYE(-1000, taxBands)).toBe(0);
  });
});

describe("NHIMA Calculation", () => {
  it("should calculate 1% employee and 1% employer", () => {
    const result = calculateNHIMA(18500, 1, 1);
    expect(result.employee).toBe(185);
    expect(result.employer).toBe(185);
  });
});

describe("NAPSA Calculation", () => {
  it("should calculate 5% each, capped at ceiling", () => {
    // Collins: gross 18500 < ceiling 30408.80
    const result1 = calculateNAPSA(18500, 5, 5, 30408.80);
    expect(result1.employee).toBe(925);
    expect(result1.employer).toBe(925);
  });

  it("should cap at ceiling for high earners", () => {
    // David: gross 43500 > ceiling 30408.80
    const result = calculateNAPSA(43500, 5, 5, 30408.80);
    expect(result.employee).toBeCloseTo(1520.44, 2);
    expect(result.employer).toBeCloseTo(1520.44, 2);
  });
});

describe("Full Payroll Calculation", () => {
  it("should compute Collins payroll correctly", () => {
    const result = calculatePayroll({
      employee: {
        id: "test-1",
        full_name: "Collins Chapusha",
        salary: 15000,
        housing_allowance: 2000,
        transport_allowance: 1000,
        lunch_allowance: 500,
      },
      taxConfig,
    });

    expect(result.gross_pay).toBe(18500);
    expect(result.paye_taxable_income).toBe(18500);
    expect(result.paye_tax).toBeCloseTo(4517.50, 0);
    expect(result.nhima_employee).toBe(185);
    expect(result.nhima_employer).toBe(185);
    expect(result.napsa_employee).toBe(925);
    expect(result.napsa_employer).toBe(925);
    expect(result.total_deductions).toBeCloseTo(5627.50, 0);
    expect(result.net_pay).toBeCloseTo(12872.50, 0);
    expect(result.total_employer_cost).toBeCloseTo(19610, 0);
  });

  it("should compute Jane payroll correctly (lower bracket)", () => {
    const result = calculatePayroll({
      employee: {
        id: "test-2",
        full_name: "Jane Mulenga",
        salary: 8500,
        housing_allowance: 1000,
        transport_allowance: 500,
        lunch_allowance: 300,
      },
      taxConfig,
    });

    // Gross = 10300
    expect(result.gross_pay).toBe(10300);
    // PAYE: Band2 ~400 + Band3 ~630 + Band4 (10300-9200.01)*37.5% = 1099.99*37.5% = 412.50
    // Total PAYE ≈ 1442.50
    expect(result.paye_tax).toBeCloseTo(1442.50, 0);
    expect(result.nhima_employee).toBe(103);
    expect(result.napsa_employee).toBe(515);
  });

  it("should use chargeable income after NAPSA and personal relief when configured", () => {
    const cfg: TaxConfig = {
      ...taxConfig,
      personalReliefMonthly: 300,
      payeOnChargeableAfterNapsa: true,
    };
    const result = calculatePayroll({
      employee: {
        id: "test-3",
        full_name: "Test User",
        salary: 15000,
        housing_allowance: 2000,
        transport_allowance: 1000,
        lunch_allowance: 500,
      },
      taxConfig: cfg,
    });
    expect(result.gross_pay).toBe(18500);
    expect(result.paye_taxable_income).toBeCloseTo(17575, 2);
    expect(result.paye_tax).toBeGreaterThan(0);
    expect(result.paye_tax).toBeLessThan(4517.5);
  });
});
