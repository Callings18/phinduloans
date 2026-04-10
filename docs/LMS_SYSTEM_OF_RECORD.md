# LMS system of record

**Decision (default):** The **Supabase Postgres database** behind this repository, together with the **Vite/React borrower and staff applications** and **Supabase Edge Functions**, is the **system of record** for loan origination, servicing, HR/payroll data stored in this schema, and operational workflows implemented here.

**Legacy or external LMS:** There is **no separate integration adapter** in this codebase. If the business must keep a **legacy LMS or third-party product** in sync, treat that as an explicit **Phase 2** workstream: define entities, direction of sync (read-only mirror vs migration), conflict rules, and an **ETL job or API bridge**—then implement it as a dedicated module. Until that is scoped and approved, **no “integration with existing LMS” deliverable should be assumed complete**.

**Mobile clients:** Android/iOS shells (e.g. Capacitor) are **clients** of the same APIs and Supabase project; they do not constitute a second LMS.
