
-- Borrower KYC information (financial, next of kin)
CREATE TABLE public.borrower_kyc_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  
  -- Bank Account
  bank_name text,
  bank_account_number text,
  bank_account_holder_name text,
  bank_branch text,
  account_type text DEFAULT 'savings',
  
  -- Mobile Money
  airtel_money_number text,
  mtn_mobile_money_number text,
  zamtel_kwacha_number text,
  mobile_money_account_name text,
  
  -- Next of Kin
  nok_full_name text,
  nok_relationship text,
  nok_nrc_number text,
  nok_phone text,
  nok_alt_phone text,
  nok_address text,
  nok_district text,
  
  -- Verification
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  admin_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT borrower_kyc_info_borrower_unique UNIQUE (borrower_id)
);

ALTER TABLE public.borrower_kyc_info ENABLE ROW LEVEL SECURITY;

-- Borrowers can manage their own KYC info
CREATE POLICY "Borrowers can insert own kyc info"
ON public.borrower_kyc_info FOR INSERT TO authenticated
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can select own kyc info"
ON public.borrower_kyc_info FOR SELECT TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can update own kyc info"
ON public.borrower_kyc_info FOR UPDATE TO authenticated
USING (auth.uid() = borrower_id);

-- Staff can view and manage all
CREATE POLICY "Staff can view all kyc info"
ON public.borrower_kyc_info FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role) OR 
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Staff can update all kyc info"
ON public.borrower_kyc_info FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_borrower_kyc_info_updated_at
BEFORE UPDATE ON public.borrower_kyc_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Borrower references table
CREATE TABLE public.borrower_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL,
  
  full_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  alt_phone text,
  address text,
  years_known integer,
  occupation text,
  
  is_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.borrower_references ENABLE ROW LEVEL SECURITY;

-- Borrowers can manage their own references
CREATE POLICY "Borrowers can insert own references"
ON public.borrower_references FOR INSERT TO authenticated
WITH CHECK (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can select own references"
ON public.borrower_references FOR SELECT TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can update own references"
ON public.borrower_references FOR UPDATE TO authenticated
USING (auth.uid() = borrower_id);

CREATE POLICY "Borrowers can delete own references"
ON public.borrower_references FOR DELETE TO authenticated
USING (auth.uid() = borrower_id);

-- Staff can view and manage all references
CREATE POLICY "Staff can view all references"
ON public.borrower_references FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role) OR 
  has_role(auth.uid(), 'credit_officer'::app_role)
);

CREATE POLICY "Staff can update all references"
ON public.borrower_references FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'loan_officer'::app_role)
);
