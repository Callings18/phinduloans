import jsPDF from "jspdf";
import { format } from "date-fns";

interface DemandLetterData {
  borrowerName: string;
  borrowerAddress: string;
  borrowerPhone: string;
  borrowerEmail: string;
  loanId: string;
  loanAmount: number;
  totalRepayment: number;
  overdueAmount: number;
  overdueCount: number;
  penaltyAmount: number;
  oldestOverdueDate: string;
  letterType: "first_notice" | "second_notice" | "final_notice" | "legal_notice";
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
}

const letterTypeConfig = {
  first_notice: {
    title: "FIRST NOTICE OF OVERDUE PAYMENT",
    tone: "friendly",
    urgency: "We kindly remind you",
    deadline: 7,
    consequence: "additional penalty charges may be applied",
  },
  second_notice: {
    title: "SECOND NOTICE - PAYMENT REMINDER",
    tone: "firm",
    urgency: "We urge you to",
    deadline: 5,
    consequence: "your account may be escalated for further collection action",
  },
  final_notice: {
    title: "FINAL NOTICE - IMMEDIATE ACTION REQUIRED",
    tone: "urgent",
    urgency: "You are required to",
    deadline: 3,
    consequence: "legal action may be initiated without further notice",
  },
  legal_notice: {
    title: "NOTICE OF INTENT TO PURSUE LEGAL ACTION",
    tone: "legal",
    urgency: "You must immediately",
    deadline: 2,
    consequence: "we will proceed with legal action to recover the outstanding debt",
  },
};

export const generateDemandLetter = (data: DemandLetterData): jsPDF => {
  const doc = new jsPDF();
  const config = letterTypeConfig[data.letterType];
  const companyName = data.companyName || "Phindu Finance";
  const companyAddress = data.companyAddress || "Plot 123, Great East Road, Lusaka, Zambia";
  const companyPhone = data.companyPhone || "+260 967 713 001";

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Company Header - App theme color
  doc.setFillColor(255, 51, 153);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageWidth / 2, 18, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos = 35;

  yPos += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companyAddress, pageWidth / 2, yPos, { align: "center" });

  yPos += 5;
  doc.text(`Tel: ${companyPhone}`, pageWidth / 2, yPos, { align: "center" });

  // Divider
  yPos += 10;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // Date and Reference
  yPos += 15;
  doc.setFontSize(10);
  doc.text(`Date: ${format(new Date(), "MMMM dd, yyyy")}`, margin, yPos);
  doc.text(`Ref: DL-${data.loanId.slice(0, 8).toUpperCase()}`, pageWidth - margin, yPos, { align: "right" });

  // Recipient Address
  yPos += 15;
  doc.setFont("helvetica", "bold");
  doc.text(data.borrowerName, margin, yPos);
  yPos += 5;
  doc.setFont("helvetica", "normal");

  const addressLines = doc.splitTextToSize(data.borrowerAddress || "Address on file", contentWidth);
  addressLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  doc.text(`Phone: ${data.borrowerPhone}`, margin, yPos);
  yPos += 5;
  doc.text(`Email: ${data.borrowerEmail}`, margin, yPos);

  // Letter Title
  yPos += 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");

  const titleColor = data.letterType === "legal_notice" ? [180, 0, 0] :
    data.letterType === "final_notice" ? [200, 100, 0] : [0, 0, 0];
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  doc.text(config.title, pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Salutation
  yPos += 15;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${data.borrowerName},`, margin, yPos);

  // Body - Opening
  yPos += 10;
  const openingText = `Our records indicate that your loan account (Ref: ${data.loanId.slice(0, 8).toUpperCase()}) has ${data.overdueCount} overdue payment(s) totaling K${data.overdueAmount.toLocaleString()}. The oldest overdue payment dates back to ${format(new Date(data.oldestOverdueDate), "MMMM dd, yyyy")}.`;

  const openingLines = doc.splitTextToSize(openingText, contentWidth);
  openingLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });

  // Account Summary Box
  yPos += 5;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, contentWidth, 40, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, contentWidth, 40, "S");

  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.text("ACCOUNT SUMMARY", margin + 5, yPos);

  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Original Loan Amount:`, margin + 5, yPos);
  doc.text(`K${data.loanAmount.toLocaleString()}`, margin + contentWidth - 5, yPos, { align: "right" });

  yPos += 6;
  doc.text(`Total Contract Value:`, margin + 5, yPos);
  doc.text(`K${data.totalRepayment.toLocaleString()}`, margin + contentWidth - 5, yPos, { align: "right" });

  yPos += 6;
  doc.setTextColor(180, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(`Overdue Amount (incl. penalties):`, margin + 5, yPos);
  doc.text(`K${(data.overdueAmount + data.penaltyAmount).toLocaleString()}`, margin + contentWidth - 5, yPos, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Action Required
  yPos += 20;
  doc.setFont("helvetica", "normal");
  const actionText = `${config.urgency} settle the outstanding amount of K${(data.overdueAmount + data.penaltyAmount).toLocaleString()} within ${config.deadline} business days from the date of this letter. Failure to do so will result in ${config.consequence}.`;

  const actionLines = doc.splitTextToSize(actionText, contentWidth);
  actionLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });

  // Payment Instructions
  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Payment Options:", margin, yPos);
  yPos += 7;
  doc.setFont("helvetica", "normal");
  doc.text("• Bank Transfer: Phindu Finance - Account No: XXXX-XXXX-XXXX", margin + 5, yPos);
  yPos += 6;
  doc.text("• Mobile Money: +260 967 713 001", margin + 5, yPos);
  yPos += 6;
  doc.text("• Visit our office at the address above", margin + 5, yPos);

  // Contact for Assistance
  yPos += 12;
  const contactText = `If you are experiencing financial difficulties, we encourage you to contact us immediately at ${companyPhone} to discuss a suitable payment arrangement. We are committed to working with you to find a mutually acceptable solution.`;

  const contactLines = doc.splitTextToSize(contactText, contentWidth);
  contactLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });

  // Warning for final/legal notices
  if (data.letterType === "final_notice" || data.letterType === "legal_notice") {
    yPos += 5;
    doc.setFillColor(255, 240, 240);
    doc.rect(margin, yPos, contentWidth, 20, "F");
    doc.setDrawColor(180, 0, 0);
    doc.rect(margin, yPos, contentWidth, 20, "S");

    yPos += 8;
    doc.setTextColor(180, 0, 0);
    doc.setFont("helvetica", "bold");
    const warningText = data.letterType === "legal_notice"
      ? "WARNING: This is our final communication before legal proceedings."
      : "IMPORTANT: Immediate action is required to avoid legal consequences.";
    doc.text(warningText, pageWidth / 2, yPos, { align: "center" });
    doc.setTextColor(0, 0, 0);
    yPos += 15;
  }

  // Closing
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.text("We trust this matter will receive your urgent attention.", margin, yPos);

  yPos += 15;
  doc.text("Yours sincerely,", margin, yPos);
  yPos += 15;
  doc.setFont("helvetica", "bold");
  doc.text("Collections Department", margin, yPos);
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.text(companyName, margin, yPos);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    "This letter is computer-generated and serves as official communication from our collections department.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  doc.text(
    `Generated on ${format(new Date(), "yyyy-MM-dd HH:mm")} | Reference: DL-${data.loanId.slice(0, 8).toUpperCase()}`,
    pageWidth / 2,
    footerY + 5,
    { align: "center" }
  );

  return doc;
};

export const downloadDemandLetter = (data: DemandLetterData): void => {
  const doc = generateDemandLetter(data);
  doc.save(`demand_letter_${data.letterType}_${data.loanId.slice(0, 8)}_${format(new Date(), "yyyyMMdd")}.pdf`);
};
