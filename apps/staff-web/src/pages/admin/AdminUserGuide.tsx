import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Input } from "@phinduloans/shared/components/ui/input";
import { Badge } from "@phinduloans/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@phinduloans/shared/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@phinduloans/shared/components/ui/accordion";
import {
  Search,
  BookOpen,
  Users,
  CreditCard,
  FileText,
  Shield,
  BarChart3,
  Bell,
  Settings,
  DollarSign,
  AlertTriangle,
  Landmark,
  Wallet,
  Scale,
  UserCircle,
  Building2,
  Layers,
  Receipt,
  History,
  FileSignature,
  
  Package,
  Banknote,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

const LAST_UPDATED = "February 11, 2026";
const VERSION = "2.5.0";

interface GuideSection {
  id: string;
  icon: any;
  title: string;
  badge?: string;
  description: string;
  subsections: {
    title: string;
    content: string;
  }[];
}

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    description: "First-time setup and system overview for new administrators.",
    subsections: [
      {
        title: "Logging In",
        content: `1. Navigate to the admin login page.\n2. Enter your staff credentials (email and password) provided by the Super Admin.\n3. If you're using OTP login, enter your phone number and verify with the code sent to you.\n4. On first login, the system will walk you through a guided tour of the admin panel.`,
      },
      {
        title: "Understanding Roles & Permissions",
        content: `The system uses Role-Based Access Control (RBAC). Each staff member is assigned a role that determines what they can see and do:\n\n• **Super Admin** – Full access to all modules, settings, and staff management.\n• **Loan Officer** – Manages applications, borrower verification, and document review.\n• **Credit Officer** – Handles loan recommendations and credit risk assessment.\n• **Finance Officer** – Processes disbursements, records repayments, and manages accounts.\n• **Collections Officer** – Manages overdue accounts, PTP tracking, and escalation.\n• **Auditor** – Read-only access to audit logs and reports.\n• **Support** – Basic access to borrower queries and status lookups.\n\nPermissions are configured in **Administration → Staff** by the Super Admin.`,
      },
      {
        title: "Dashboard Overview",
        content: `The Admin Dashboard provides real-time KPIs at a glance:\n\n• **Portfolio Value** – Total outstanding loan balance.\n• **PAR 30** – Percentage of loans overdue by 30+ days (target: below 5%).\n• **Collection Rate** – Percentage of expected payments collected this month.\n• **Active Loans** – Count of currently disbursed, active loans.\n\nBelow the KPIs you'll find:\n• **Disbursement Trends** – 6-month volume and value chart.\n• **Repayment Performance** – On-time vs. late vs. missed breakdown.\n• **Product Mix** – Donut chart of loan products.\n• **Loan Officer Performance** – Top 10 officers ranked by quality metrics.`,
      },
    ],
  },
  {
    id: "borrower-journey",
    icon: Users,
    title: "Borrower Journey (Customer Side)",
    description: "How borrowers interact with the system from signup to loan completion.",
    subsections: [
      {
        title: "Borrower Registration",
        content: `Borrowers sign up through the public website:\n\n1. Click **Apply** on the homepage → redirected to login/signup.\n2. Register with phone number (verified via OTP) and then set up email & password.\n3. After signup, borrower lands on their **Dashboard**.\n4. The system sends a **Welcome Notification** (SMS + Email + WhatsApp if enabled).`,
      },
      {
        title: "KYC Verification",
        content: `Before applying for a loan, borrowers must complete KYC:\n\n1. **Personal Information** – Full name, NRC number, date of birth, address.\n2. **Financial Information** – Bank account details and/or mobile money numbers (Airtel, MTN, Zamtel).\n3. **Next of Kin** – Emergency contact with NRC and phone number.\n4. **Personal References** – Two non-family references (colleagues, friends, neighbors).\n5. **Identity Documents** – Upload NRC (front & back), Selfie for face verification.\n\n**Important:** Account holder name must match the NRC name for disbursement. KYC data follows a "verify once, reuse always" model — once verified, borrowers don't need to re-submit for future loans.`,
      },
      {
        title: "Loan Application",
        content: `The borrower applies from their Dashboard:\n\n1. Click **Apply for Loan** → Select a loan product.\n2. Fill in loan amount, term, and purpose.\n3. Upload product-specific documents (payslips, bank statements, etc.).\n4. Payslip upload supports PDF password entry for protected documents.\n5. Submit the application → Status changes to **Submitted**.\n6. Borrower receives **Application Submitted** notification.\n7. Borrower can track progress via the **Document Checklist** on their dashboard.`,
      },
      {
        title: "Contract & Disbursement",
        content: `Once approved:\n\n1. Borrower receives **Loan Approval** notification.\n2. Admin generates and sends the contract → status moves to **Contract Signing**.\n3. Borrower reviews contract (sent via Email/WhatsApp/SMS).\n4. Borrower signs using the **Signature Pad** in their dashboard.\n5. Admin counter-signs → status moves to **Awaiting Disbursement**.\n6. Finance officer disburses funds → **Disbursement Confirmation** notification sent.\n7. Loan status changes to **Active** and repayment schedule begins.`,
      },
      {
        title: "Repayments & Completion",
        content: `During the loan term:\n\n• Borrowers receive **Payment Reminders** before each due date.\n• After making a payment, they can submit a **Payment Claim** with receipt/reference.\n• Admin verifies the claim against bank statements before recording it.\n• If payment is late, borrower receives **Overdue Notices** with escalating urgency.\n• When all payments are made and balance is zero, the loan moves to **Completed**.\n• Borrower receives a **Loan Completion** congratulations message.`,
      },
    ],
  },
  {
    id: "applications",
    icon: FileText,
    title: "Applications Management",
    badge: "Core",
    description: "Processing new loan applications and managing the approval workflow.",
    subsections: [
      {
        title: "Viewing Applications",
        content: `Navigate to **Lending → Applications** to see all submitted applications.\n\n• Filter by status: Pending, Under Review, Approved, Rejected.\n• Search by borrower name, NRC, or reference number.\n• Click on any application to open the **Loan Details Modal**.`,
      },
      {
        title: "Application Review Workflow",
        content: `The approval process follows 4 stages:\n\n**Stage 1 – Document Review**\nLoan Officer checks all uploaded documents, verifies identity (NRC match with selfie), and confirms employment details.\n→ Permission required: \`loans:verify_documents\`\n\n**Stage 2 – Recommendation**\nCredit Officer reviews financial data, runs CRB check, and makes a recommendation (Approve / Reject with notes).\n→ Permission required: \`loans:recommend\`\n\n**Stage 3 – Final Approval**\nSenior staff or Super Admin gives final approval based on the recommendation.\n→ Permission required: \`loans:approve\`\n\n**Stage 4 – Disbursement**\nFinance Officer processes the payout after contract signing is complete.\n→ Permission required: \`disbursement:create\``,
      },
      {
        title: "Adding a Loan Manually",
        content: `For walk-in customers or phone applications:\n\n1. Go to **Lending → Loans** and click **Add Loan**.\n2. Select an existing borrower from the dropdown.\n3. Fill in loan details: product, amount, term, purpose.\n4. The loan is created with **Pending** status and enters the normal workflow.\n\n**Quick Disbursement:** For pre-approved returning borrowers, use the **Quick Disbursement** option to bypass the approval workflow and immediately activate the loan with optional backdating.`,
      },
      {
        title: "Internal Notes",
        content: `Staff can add notes to any application for internal communication:\n\n• **Internal Notes** – Visible only to staff (for credit assessments, red flags, etc.).\n• **Borrower-Visible Notes** – Can be seen by the borrower (for document requests, status updates).\n\nNotes are timestamped and attributed to the staff member who created them.`,
      },
    ],
  },
  {
    id: "loans",
    icon: CreditCard,
    title: "Loan Portfolio Management",
    badge: "Core",
    description: "Managing active loans, repayments, and the full loan lifecycle.",
    subsections: [
      {
        title: "Loan Statuses",
        content: `The full loan lifecycle:\n\n| Status | Description |\n|---|---|\n| **Submitted** | Application received from borrower |\n| **Under Review** | Documents uploaded, staff reviewing |\n| **Approved** | Loan approved, awaiting contract |\n| **Contract Signing** | Contract sent, awaiting signatures |\n| **Awaiting Disbursement** | Both parties signed, pending funds release |\n| **Disbursed** | Funds released to borrower |\n| **Active** | Repayment schedule live |\n| **Completed** | Fully paid, balance zero |\n| **Rejected** | Application denied |\n| **Defaulted** | Unrecoverable, sent to collections/write-off |`,
      },
      {
        title: "Recording Repayments",
        content: `Go to **Payments → Repayments**:\n\n1. Select the loan from the list.\n2. Enter payment amount, date, and payment method.\n3. The system supports: Full payment, Partial payment, and Overpayment (applies to next installment).\n4. If borrower submitted a **Payment Claim**, verify against bank statement before approving.\n5. Upon recording, borrower receives a **Payment Confirmation** notification.\n6. If partial, they also receive a **Partial Payment** notice showing remaining balance.`,
      },
      {
        title: "Bulk Repayments",
        content: `For processing multiple payments at once (e.g., payroll deductions):\n\n1. Go to **Payments → Bulk Repayments**.\n2. Upload a CSV/Excel file with columns: Loan ID, Amount, Date, Reference.\n3. Review the preview → confirm batch.\n4. All valid payments are recorded simultaneously.`,
      },
      {
        title: "Loan Products",
        content: `Configure your lending products under **Lending → Loan Products**:\n\n• **Product Name** – e.g., "Salary Advance", "Business Loan", "Emergency Loan".\n• **Interest Rate** – Monthly rate applied to the loan.\n• **Term Range** – Min/max months.\n• **Amount Range** – Min/max loan amounts.\n• **Required Documents** – Configured per product (KYC, payslips, bank statements, etc.).\n• **Processing Fee** – Percentage or flat fee deducted at disbursement.\n\nEach product can have its own **Contract Template** (see Contracts section).`,
      },
    ],
  },
  {
    id: "contracts",
    icon: FileSignature,
    title: "Contracts & Signatures",
    description: "Generating, sending, and managing loan contracts.",
    subsections: [
      {
        title: "Contract Templates",
        content: `Manage templates under **Administration → Contracts**:\n\n• Create product-specific templates with merge fields (borrower name, amount, interest rate, schedule, etc.).\n• Templates support HTML content that gets converted to PDF.\n• Upload custom templates if needed.\n• Only **active** templates are used for contract generation.`,
      },
      {
        title: "Generating & Sending Contracts",
        content: `From the Loan Details modal:\n\n1. Once a loan is **Approved**, click **Generate & Send Contract**.\n2. The system auto-populates the contract with loan details.\n3. Contract is sent to the borrower via all enabled channels (Email with PDF attachment, WhatsApp, SMS with link).\n4. Loan status changes to **Contract Signing**.\n5. Borrower receives a **Contract Sent** notification.`,
      },
      {
        title: "Dual-Signature Requirement",
        content: `Disbursement requires both parties to sign:\n\n1. **Borrower** signs via the Signature Pad in their dashboard, or uploads a signed copy.\n2. **Admin** counter-signs using the **Sign & Verify** button in the loan details.\n3. Both signatures are embedded into the final PDF.\n4. Once both signatures are captured, loan moves to **Awaiting Disbursement**.\n5. Timestamps for all signatures are recorded for audit purposes.`,
      },
    ],
  },
  {
    id: "disbursements",
    icon: Banknote,
    title: "Disbursements",
    description: "Processing fund releases to borrowers.",
    subsections: [
      {
        title: "Disbursement Process",
        content: `Go to **Lending → Disbursements**:\n\n1. View all loans awaiting disbursement.\n2. Select the loan → verify borrower identity and bank/mobile money details.\n3. Choose disbursement method: Bank Transfer, Mobile Money (Airtel/MTN/Zamtel), or Cash.\n4. Select the **Source Account** (the company account funds will be drawn from).\n5. Enter transaction reference from the actual transfer.\n6. Click **Disburse** → loan status changes to **Disbursed/Active**.\n7. Borrower receives **Disbursement Confirmation** notification with reference number.\n\n**Important:** The system verifies source account balance before allowing disbursement.`,
      },
      {
        title: "Backdated Disbursement",
        content: `For loans that were disbursed offline or in the past:\n\n• Use the **Quick Disbursement** option when creating the loan.\n• Set the actual disbursement date and first repayment date.\n• The repayment schedule will be generated from the backdated start date.\n• This is useful when migrating existing loans into the system.`,
      },
    ],
  },
  {
    id: "collections",
    icon: AlertTriangle,
    title: "Collections & Recovery",
    badge: "Core",
    description: "Managing overdue accounts, escalation, and debt recovery.",
    subsections: [
      {
        title: "Overdue Accounts",
        content: `Navigate to **Recovery → Collections** to see all overdue loans.\n\n• Loans automatically appear here when a repayment passes its due date.\n• View days overdue, outstanding amount, and contact details.\n• Sort by amount, days overdue, or priority level.`,
      },
      {
        title: "Collection Activities",
        content: `Log every interaction with the borrower:\n\n1. Click on an overdue loan → **Log Activity**.\n2. Record: Contact method (Phone, SMS, Visit, Email), outcome, and notes.\n3. Set follow-up dates for each account.\n4. Track **Promise-to-Pay (PTP)** commitments: date, amount, and fulfillment status.`,
      },
      {
        title: "Escalation Workflow",
        content: `Collections follow a 5-level escalation:\n\n| Level | Action | Timeline |\n|---|---|---|\n| 1 | SMS/Call reminder | 1–7 days overdue |\n| 2 | Follow-up call + formal notice | 8–14 days |\n| 3 | Demand letter (First Notice) | 15–30 days |\n| 4 | Final demand + legal warning | 31–60 days |\n| 5 | Legal action / Write-off | 60+ days |\n\nAt each level, the borrower receives an **Escalation Notification** with increasing urgency.`,
      },
      {
        title: "Demand Letters",
        content: `Generate professional demand letters:\n\n1. From the loan details, click **Generate Demand Letter**.\n2. Select the letter type (First Notice, Second Notice, Final Notice, Pre-Legal).\n3. The system generates a branded PDF with loan details and legal language.\n4. Send via Email/WhatsApp/SMS.\n5. Track delivery status and borrower response.`,
      },
      {
        title: "Write-Offs",
        content: `For unrecoverable debts:\n\n1. Go to **Recovery → Write-Offs**.\n2. Submit a write-off request with justification.\n3. Write-offs require Super Admin approval.\n4. Written-off amounts are tracked separately for accounting.\n5. Even after write-off, recovery attempts can continue and any recovered amounts are logged.`,
      },
      {
        title: "Court Cases",
        content: `Track legal proceedings under **Recovery → Court Cases**:\n\n• Create a case linked to a loan with case number, court details, and lawyer info.\n• Log case events: Filing, Hearing, Judgment, Enforcement.\n• Track legal fees, judgment amounts, and recovered amounts.\n• When a court case is created, borrower receives a **Court Case** notification.`,
      },
    ],
  },
  {
    id: "finance",
    icon: Wallet,
    title: "Finance & Accounts",
    description: "Managing company accounts, expenses, and financial tracking.",
    subsections: [
      {
        title: "Company Accounts",
        content: `Manage under **Finance → Accounts**:\n\n• Set up company bank accounts and mobile money floats.\n• Track balances in real-time as disbursements and repayments are processed.\n• View transaction history for each account.\n• Source accounts are used during disbursement to draw funds.\n\n**Important:** Always reconcile account balances with actual bank statements.`,
      },
      {
        title: "Expense Management",
        content: `Track operational expenses under **Finance → Expenses**:\n\n• Record expenses with: Date, Category, Amount, Vendor, Payment Method.\n• Attach receipts or invoices.\n• Expenses follow a workflow: Draft → Approved → Paid.\n• Categories include: Rent, Salaries, Marketing, Legal Fees, Transport, Office Supplies, etc.\n• Link expenses to specific loans when applicable (e.g., legal costs for defaulted loans).`,
      },
    ],
  },
  {
    id: "pmic",
    icon: Landmark,
    title: "PMIC (Payroll Deduction)",
    description: "Managing employer payroll deduction arrangements.",
    subsections: [
      {
        title: "Overview",
        content: `PMIC enables direct salary deductions for loan repayments:\n\n1. **Employer Setup** – Register employers with contact details and verification status.\n2. **Eligibility Check** – Verify if a borrower's employer participates in PMIC.\n3. **Enrollment** – Register borrowers for payroll deduction.\n4. **Monthly Submissions** – Generate deduction lists for employers.\n5. **Exception Handling** – Manage cases where deductions fail (employee left, insufficient salary, etc.).`,
      },
      {
        title: "PMIC Configuration",
        content: `Configure PMIC settings:\n\n• Maximum deduction percentage of salary (typically 30-40%).\n• Auto-enrollment for eligible borrowers.\n• Notification settings for employers and borrowers.\n• Exception handling rules and retry policies.`,
      },
    ],
  },
  {
    id: "hr-payroll",
    icon: UserCircle,
    title: "HR & Payroll (Internal Staff)",
    badge: "New",
    description: "Managing internal employees and processing monthly payroll.",
    subsections: [
      {
        title: "Employee Management",
        content: `Manage staff under **HR & Payroll → HR Management**:\n\n• Add employees with: Name, Employee Number, NRC, TPIN, NAPSA Number, NHIMA Number.\n• Set salary, allowances (Housing, Transport, Lunch, Other), and commission rates.\n• Configure bank details for salary payment.\n• Track employment type (Full-time, Part-time, Contract) and department.`,
      },
      {
        title: "Payroll Processing",
        content: `Monthly payroll under **HR & Payroll → Payroll**:\n\n1. Click **Generate Payroll** → Select month and year.\n2. The system calculates for each employee:\n   - **Gross Pay** = Basic Salary + All Allowances + Commission\n   - **PAYE** = Progressive tax (0% up to K5,100; 20% K5,101–K7,100; 30% K7,101–K9,200; 37.5% above K9,200)\n   - **NAPSA** = 5% employee + 5% employer (capped at K30,408.80 per year)\n   - **NHIMA** = 1% employee + 1% employer\n   - **Net Pay** = Gross Pay - PAYE - NAPSA (employee) - NHIMA (employee)\n3. Review all calculations → **Approve** the payroll run.\n4. Mark as **Paid** once bank transfers are complete.\n5. Download individual **Payslip PDFs** with full Zambian compliance details.`,
      },
      {
        title: "Commission Tracking",
        content: `Loan officers earn commissions on processed loans:\n\n• Commission rate is set per employee (e.g., 1%, 2%).\n• Calculated automatically based on loans disbursed during the payroll period.\n• Included in the monthly payroll as part of gross earnings.\n• Tracked separately in commission reports for transparency.`,
      },
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports & Analytics",
    badge: "New",
    description: "Generating insights and exporting data for decision-making.",
    subsections: [
      {
        title: "Available Reports",
        content: `Navigate to **Reports & Logs → Reports**:\n\n| Report | What It Shows |\n|---|---|\n| **Loan Book** | Full portfolio with aging analysis (Current, 1-30, 31-60, 61-90, 90+ days) |\n| **Collections** | Weekly breakdown, top/bottom performers, product-level detail |\n| **Disbursements** | Daily/weekly trends, product and officer breakdowns |\n| **Performance** | Officer comparison, monthly trends, commission tracking |\n\nAll reports support:\n• Date range filtering\n• Branded **PDF export** with company logo\n• **Excel export** for further analysis\n• Summary metrics cards at the top`,
      },
      {
        title: "Audit Logs",
        content: `Track every action in the system under **Reports & Logs → Audit Logs**:\n\n• Who did what, when, and from which IP address.\n• Filter by: User, Action Type, Module, Date Range.\n• Covers: Login events, loan status changes, payment recordings, settings updates.\n• Audit logs cannot be deleted (immutable for compliance).`,
      },
    ],
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications System",
    description: "How automated communications work across all channels.",
    subsections: [
      {
        title: "Notification Channels",
        content: `The system supports 2 channels:\n\n• **SMS** – Via ExciteSMS (primary provider) for text messages.\n• **WhatsApp** – Via Brevo/Twilio for WhatsApp Business messages.\n\nAll channels can be enabled/disabled independently in **Settings → Notifications**.`,
      },
      {
        title: "Automated Notification Events",
        content: `The following events trigger automatic notifications:\n\n| Event | Trigger | Channels |\n|---|---|---|\n| **Welcome** | New user signup | SMS, WhatsApp |\n| **Application Submitted** | Borrower submits loan form | SMS |\n| **Under Review** | Admin starts reviewing | SMS |\n| **KYC Verification** | Identity verified/failed | SMS |\n| **Document Request** | Admin requests more docs | SMS |\n| **Loan Approved** | Final approval granted | SMS, WhatsApp |\n| **Loan Rejected** | Application denied | SMS |\n| **Contract Sent** | Contract generated & sent | SMS, WhatsApp |\n| **Disbursement** | Funds released | SMS, WhatsApp |\n| **Payment Reminder** | 3 days before due date | SMS |\n| **Payment Received** | Full payment recorded | SMS |\n| **Partial Payment** | Incomplete payment | SMS |\n| **Overdue Notice** | Payment past due date | SMS, WhatsApp |\n| **Collection Escalation** | Escalation level increased | SMS |\n| **Court Case** | Legal action initiated | SMS |\n| **Loan Completed** | All payments done | SMS, WhatsApp |\n| **Loan Restructured** | Terms modified | SMS |\n| **Statement Available** | Monthly statement ready | SMS |\n| **Promotion** | Marketing message | SMS |`,
      },
      {
        title: "Notification Settings",
        content: `Configure under **Administration → Settings → Notifications**:\n\n1. **Provider Credentials** – API keys for each SMS/WhatsApp provider.\n2. **Channel Toggle** – Enable/disable each channel globally.\n3. **Event Toggle** – Enable/disable notifications per event type.\n4. **Admin Notifications** – Real-time popup notifications with sound on the admin dashboard for critical events (new applications, payments, overdue alerts).\n\n**Tip:** Start with SMS only, then add WhatsApp once configured and tested.`,
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "System Settings",
    description: "Configuring the platform for your business needs.",
    subsections: [
      {
        title: "General Settings",
        content: `Under **Administration → Settings**:\n\n• **Company Info** – Name, logo, address, phone.\n• **Currency** – Default is ZMW (Zambian Kwacha).\n• **Business Hours** – Used for reminder scheduling.\n• **Interest Calculation** – Method and default rates.`,
      },
      {
        title: "Integration Settings",
        content: `Configure third-party integrations:\n\n• **ExciteSMS** – API key and sender ID for SMS delivery.\n• **Brevo** – WhatsApp Business API credentials.\n• **CRB** – Credit Reference Bureau API for credit checks.\n• **PMIC** – Payroll deduction integration settings.\n\nAll API keys are stored securely and never exposed in the frontend.`,
      },
      {
        title: "Staff Management",
        content: `Under **Administration → Staff**:\n\n1. Click **Add Staff** → Enter name, email, phone.\n2. The system creates a secure login via the backend.\n3. A temporary password is generated and displayed once.\n4. Assign a role (Loan Officer, Finance Officer, etc.).\n5. The new staff member can log in and change their password.\n\n**Important:** Only Super Admins can create and manage staff accounts.`,
      },
    ],
  },
  {
    id: "troubleshooting",
    icon: Shield,
    title: "Troubleshooting & FAQs",
    description: "Common issues and how to resolve them.",
    subsections: [
      {
        title: "Common Issues",
        content: `**Q: Borrower can't sign up?**\nA: Check if OTP delivery is working. Verify ExciteSMS API key is configured correctly in Settings.\n\n**Q: Loan application stuck on "Submitted"?**\nA: A Loan Officer needs to start the review process. Check Applications page.\n\n**Q: Can't disburse a loan?**\nA: Both borrower and admin signatures are required. Check the Contract Signing status. Also verify the source account has sufficient balance.\n\n**Q: Notifications not sending?**\nA: Check Settings → Notifications. Verify:\n1. The channel (SMS/Email/WhatsApp) is enabled.\n2. Provider credentials are correct.\n3. The specific event type is not disabled.\n\n**Q: Wrong PAYE calculation?**\nA: Verify the employee's gross salary and allowances. The system uses 2026 Zambian tax bands. Check that NAPSA ceiling (K30,408.80/year) is being applied correctly.\n\n**Q: Payslip shows zero commission?**\nA: Commission is based on loans processed during the payroll period. Verify the employee has a commission rate set and has processed loans in that month.`,
      },
      {
        title: "Data Security",
        content: `The system follows strict security practices:\n\n• **Row-Level Security (RLS)** – Users can only access their own data.\n• **Role-Based Access** – Staff see only what their role permits.\n• **Encrypted Storage** – All API keys and passwords are encrypted.\n• **Audit Trail** – Every action is logged with user ID, timestamp, and IP.\n• **Secure File Storage** – Documents are stored in private buckets with signed URLs.\n• **Session Management** – Auto-logout after inactivity, JWT-based authentication.`,
      },
      {
        title: "Getting Help",
        content: `For technical support:\n\n• Contact the development team at **tech@phindu.com**.\n• For urgent issues, call the support hotline.\n• Use the **Phindu AI** chatbot (bottom-right corner) for quick answers.\n• Check the Audit Logs if something seems off — it tracks everything.\n\n**For feature requests:** Document the requirement and submit to the Super Admin who will coordinate with the development team.`,
      },
    ],
  },
];

const AdminUserGuide = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = guideSections.filter((section) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(q) ||
      section.description.toLowerCase().includes(q) ||
      section.subsections.some(
        (sub) =>
          sub.title.toLowerCase().includes(q) ||
          sub.content.toLowerCase().includes(q)
      )
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-primary" />
              System User Guide
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete operations manual for Phindu Credit Management System
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              v{VERSION}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Updated: {LAST_UPDATED}
            </Badge>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search the guide... (e.g., 'disbursement', 'PAYE', 'notifications')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table of Contents */}
        {!searchQuery && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Table of Contents</CardTitle>
              <CardDescription>Click a section to jump directly to it</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {guideSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id);
                      document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
                  >
                    <section.icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1">{section.title}</span>
                    {section.badge && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {section.badge}
                      </Badge>
                    )}
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {filteredSections.map((section) => (
            <Card key={section.id} id={`section-${section.id}`} className="scroll-mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                      {section.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {section.subsections.map((sub, idx) => (
                    <AccordionItem key={idx} value={`${section.id}-${idx}`}>
                      <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                        {sub.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-line leading-relaxed">
                          {sub.content.split('\n').map((line, i) => {
                            // Handle markdown-style bold
                            const parts = line.split(/(\*\*[^*]+\*\*)/g);
                            return (
                              <span key={i}>
                                {parts.map((part, j) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="text-foreground">{part.slice(2, -2)}</strong>;
                                  }
                                  // Handle inline code
                                  const codeParts = part.split(/(`[^`]+`)/g);
                                  return codeParts.map((cp, k) => {
                                    if (cp.startsWith('`') && cp.endsWith('`')) {
                                      return <code key={k} className="px-1 py-0.5 rounded bg-muted text-xs font-mono text-foreground">{cp.slice(1, -1)}</code>;
                                    }
                                    return cp;
                                  });
                                })}
                                {i < sub.content.split('\n').length - 1 && <br />}
                              </span>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <Card className="bg-muted/30">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>
              Phindu Credit Management System — User Guide v{VERSION} — Last updated: {LAST_UPDATED}
            </p>
            <p className="mt-1">
              For feature requests or corrections, contact the development team.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUserGuide;
