-- Fix RLS policies - change RESTRICTIVE to PERMISSIVE

-- Drop existing policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

DROP POLICY IF EXISTS "Anyone can view verified employers" ON public.employers;
DROP POLICY IF EXISTS "Admins can manage employers" ON public.employers;

DROP POLICY IF EXISTS "Users can view their own applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.loan_applications;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.loan_applications;

DROP POLICY IF EXISTS "Users can view their own repayments" ON public.loan_repayments;
DROP POLICY IF EXISTS "Admins can manage repayments" ON public.loan_repayments;

DROP POLICY IF EXISTS "Users can view their loan disbursements" ON public.disbursements;
DROP POLICY IF EXISTS "Admins can manage disbursements" ON public.disbursements;

-- Recreate profiles policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Recreate user_roles policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate employers policies as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view verified employers" ON public.employers;
CREATE POLICY "Anyone can view verified employers"
  ON public.employers FOR SELECT
  USING (is_verified = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert employers" ON public.employers;
CREATE POLICY "Admins can insert employers"
  ON public.employers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update employers" ON public.employers;
CREATE POLICY "Admins can update employers"
  ON public.employers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete employers" ON public.employers;
CREATE POLICY "Admins can delete employers"
  ON public.employers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate loan_applications policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own applications" ON public.loan_applications;
CREATE POLICY "Users can view their own applications"
  ON public.loan_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create applications" ON public.loan_applications;
CREATE POLICY "Users can create applications"
  ON public.loan_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their pending applications" ON public.loan_applications;
CREATE POLICY "Users can update their pending applications"
  ON public.loan_applications FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id AND status = 'pending') OR public.has_role(auth.uid(), 'admin'));

-- Recreate loan_repayments policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own repayments" ON public.loan_repayments;
CREATE POLICY "Users can view their own repayments"
  ON public.loan_repayments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert repayments" ON public.loan_repayments;
CREATE POLICY "Admins can insert repayments"
  ON public.loan_repayments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update repayments" ON public.loan_repayments;
CREATE POLICY "Admins can update repayments"
  ON public.loan_repayments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete repayments" ON public.loan_repayments;
CREATE POLICY "Admins can delete repayments"
  ON public.loan_repayments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Recreate disbursements policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their loan disbursements" ON public.disbursements;
CREATE POLICY "Users can view their loan disbursements"
  ON public.disbursements FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loan_applications la 
    WHERE la.id = loan_id AND la.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert disbursements" ON public.disbursements;
CREATE POLICY "Admins can insert disbursements"
  ON public.disbursements FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update disbursements" ON public.disbursements;
CREATE POLICY "Admins can update disbursements"
  ON public.disbursements FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete disbursements" ON public.disbursements;
CREATE POLICY "Admins can delete disbursements"
  ON public.disbursements FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));