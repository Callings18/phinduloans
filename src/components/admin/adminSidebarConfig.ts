import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Banknote,
  Wallet,
  FileSignature,
  Settings,
  Shield,
  UserCog,
  BookOpen,
  Building2,
  ListOrdered,
  Link2,
  BarChart3,
  LayoutGrid,
  ScrollText,
  Scale,
  Ban,
  Mail,
  Briefcase,
  Coins,
  Receipt,
  ClipboardList,
} from "lucide-react";

/** Optional permission gate: item visible if can(module, action) or admin fallback handled in sidebar. */
export interface SidebarMenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  children?: SidebarMenuItem[];
  /** If set, require this permission (or isAdmin in sidebar). */
  perm?: { module: string; action: string };
  /** Restrict to admin / super_admin only (e.g. settings). */
  adminOnly?: boolean;
  /** When set and VITE_BETA_MODULES contains this key, sidebar shows a Beta badge. */
  betaKey?: string;
}

export interface SidebarMenuGroup {
  label: string;
  items: SidebarMenuItem[];
}

export const adminMenuGroups: SidebarMenuGroup[] = [
  {
    label: "Overview",
    items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/admin" }],
  },
  {
    label: "Lending",
    items: [
      { icon: FileText, label: "Applications", path: "/admin/applications", perm: { module: "loans", action: "view" } },
      { icon: Users, label: "Borrowers", path: "/admin/borrowers", perm: { module: "borrowers", action: "view" } },
      { icon: Building2, label: "Employers", path: "/admin/employers", perm: { module: "borrowers", action: "view" } },
      {
        icon: CreditCard,
        label: "Loans",
        path: "/admin/loans",
        perm: { module: "loans", action: "view" },
        betaKey: "loans_by_product",
        children: [
          { icon: LayoutGrid, label: "Product Houses", path: "/admin/houses", perm: { module: "loans", action: "view" }, betaKey: "house_routes_enabled" },
          { icon: FileText, label: "Create Salary Advance", path: "/admin/loans/create/salary-advance", perm: { module: "loans", action: "view" }, betaKey: "loan_create_salary_advance" },
          { icon: FileText, label: "Create Payday Soft", path: "/admin/loans/create/payday-soft", perm: { module: "loans", action: "view" }, betaKey: "loan_create_payday_soft" },
          { icon: FileText, label: "Create Collateral Loan", path: "/admin/loans/create/collateral", perm: { module: "loans", action: "view" }, betaKey: "loan_create_collateral" },
          { icon: FileText, label: "Create Business Loan", path: "/admin/loans/create/business", perm: { module: "loans", action: "view" }, betaKey: "loan_create_business" },
          { icon: FileText, label: "Create Motor Vehicle", path: "/admin/loans/create/motor-vehicle", perm: { module: "loans", action: "view" }, betaKey: "loan_create_motor_vehicle" },
          { icon: FileText, label: "Create Marketeer", path: "/admin/loans/create/marketeer", perm: { module: "loans", action: "view" }, betaKey: "marketeer" },
          { icon: LayoutGrid, label: "Loan Product Dashboards", path: "/admin/loan-product-dashboards", perm: { module: "loans", action: "view" }, betaKey: "product_dashboards" },
        ],
      },
    ],
  },
  {
    label: "Credit & risk",
    items: [
      { icon: Link2, label: "PMIC", path: "/admin/pmic", perm: { module: "loans", action: "view" } },
      { icon: ClipboardList, label: "CRB queue", path: "/admin/crb-queue", perm: { module: "loans", action: "view" } },
    ],
  },
  {
    label: "Finance",
    items: [
      { icon: CreditCard, label: "Disbursements", path: "/admin/disbursements", perm: { module: "disbursement", action: "view" } },
      { icon: Banknote, label: "Repayments", path: "/admin/repayments", perm: { module: "repayments", action: "view" } },
      { icon: ListOrdered, label: "Bulk repayments", path: "/admin/bulk-repayments", perm: { module: "repayments", action: "view" } },
      { icon: Wallet, label: "Accounts", path: "/admin/accounts", perm: { module: "disbursement", action: "view" } },
      { icon: Wallet, label: "Wallets", path: "/admin/wallets", perm: { module: "wallets", action: "view" } },
      { icon: Receipt, label: "Expenses", path: "/admin/expenses", perm: { module: "expenses", action: "view" } },
    ],
  },
  {
    label: "Collections & legal",
    items: [
      { icon: Banknote, label: "Collections", path: "/admin/collections", perm: { module: "collections", action: "view" } },
      { icon: Ban, label: "Write-offs", path: "/admin/write-offs", perm: { module: "writeoffs", action: "view" } },
      { icon: Scale, label: "Court cases", path: "/admin/court-cases", perm: { module: "court", action: "view" } },
    ],
  },
  {
    label: "HR & payroll",
    items: [
      { icon: Briefcase, label: "HR", path: "/admin/hr", perm: { module: "hr", action: "view" } },
      { icon: Coins, label: "Payroll", path: "/admin/payroll", perm: { module: "payroll", action: "view" } },
    ],
  },
  {
    label: "Reporting & compliance",
    items: [
      { icon: BarChart3, label: "Reports", path: "/admin/reports", perm: { module: "reports", action: "view" } },
      { icon: ScrollText, label: "Audit logs", path: "/admin/audit-logs", perm: { module: "audit", action: "view" } },
    ],
  },
  {
    label: "Administration",
    items: [
      { icon: FileSignature, label: "Contract templates", path: "/admin/contract-templates", perm: { module: "loans", action: "view" } },
      { icon: UserCog, label: "Staff", path: "/admin/staff", perm: { module: "staff", action: "view" } },
      { icon: Shield, label: "Roles & permissions", path: "/admin/roles-permissions", adminOnly: true },
      { icon: Mail, label: "Email log", path: "/admin/email-log", adminOnly: true },
      { icon: BookOpen, label: "User guide", path: "/admin/user-guide" },
      { icon: Settings, label: "Settings", path: "/admin/settings", adminOnly: true },
    ],
  },
];
