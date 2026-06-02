import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Repayment {
    id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    status: string;
}

interface LoanStatementData {
    id: string;
    full_name: string;
    loan_amount: number;
    loan_term_months: number;
    monthly_payment: number;
    total_repayment: number;
    interest_rate: number;
    created_at: string;
    repayments: Repayment[];
}

export const generateAccountStatement = (data: LoanStatementData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header - App theme color
    doc.setFontSize(22);
    doc.setTextColor(244, 36, 140); // Brand magenta (matches loan schedule)
    doc.text("PHINDU FINANCE", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Financial Services Zambia", 14, 28);
    doc.text("Lusaka, Zambia", 14, 33);

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Loan Account Statement", pageWidth - 14, 22, { align: "right" });

    doc.setFontSize(9);
    doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: "right" });
    doc.text(`Reference: ${data.id.substring(0, 8).toUpperCase()}`, pageWidth - 14, 33, { align: "right" });

    // Divider
    doc.setDrawColor(230);
    doc.line(14, 40, pageWidth - 14, 40);

    // Borrower Info
    doc.setFontSize(12);
    doc.text("Account Holder", 14, 50);
    doc.setFontSize(10);
    doc.text(data.full_name, 14, 57);

    // Loan Summary Card (Simulated)
    doc.setFillColor(248, 249, 250);
    doc.rect(14, 65, pageWidth - 28, 35, "F");

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Principal Amount", 20, 75);
    doc.text("Interest Rate", 70, 75);
    doc.text("Term", 120, 75);
    doc.text("Status", 160, 75);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`K${data.loan_amount.toLocaleString()}`, 20, 82);
    doc.text(`${data.interest_rate}%`, 70, 82);
    doc.text(`${data.loan_term_months} Months`, 120, 82);
    doc.text("ACTIVE", 160, 82);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Monthly Installment", 20, 92);
    doc.text("Total Repayable", 120, 92);

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`K${data.monthly_payment.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 20, 98);
    doc.text(`K${data.total_repayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 120, 98);

    // Repayment Table
    doc.setFontSize(12);
    doc.text("Transaction History", 14, 115);

    const tableData = data.repayments.map((r, index) => [
        index + 1,
        new Date(r.payment_date).toLocaleDateString(),
        r.payment_method.replace('_', ' ').toUpperCase(),
        `K${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        r.status.toUpperCase()
    ]);

    if (tableData.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("No repayments recorded yet.", 14, 125);
    } else {
        autoTable(doc, {
            startY: 120,
            head: [["#", "Date", "Method", "Amount", "Status"]],
            body: tableData,
            theme: "striped",
            headStyles: { fillColor: [244, 36, 140], textColor: [255, 255, 255] },
            margin: { left: 14, right: 14 }
        });
    }

    // Summary Footer
    const finalY = (doc as any).lastAutoTable?.finalY + 10 || 135;
    const totalPaid = data.repayments.reduce((sum, r) => sum + Number(r.amount), 0);
    const remaining = Math.max(0, data.total_repayment - totalPaid);

    doc.setFontSize(10);
    doc.text(`Total Amount Paid: K${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY, { align: "right" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Outstanding Balance: K${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - 14, finalY + 7, { align: "right" });

    // Footer Note
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text("This is a computer generated statement and does not require a signature.", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

    doc.save(`Statement_${data.id.substring(0, 8)}.pdf`);
};
