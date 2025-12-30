import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PMICConfig {
  id: string;
  payroll_authority: string | null;
  deduction_code: string | null;
  deduction_code_assigned_date: string | null;
  max_deduction_percent: number;
  min_net_pay_percent: number;
  max_loan_multiplier: number;
  default_loan_term_months: number;
  max_concurrent_loans: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PMICEmployer {
  id: string;
  employer_code: string;
  employer_name: string;
  employer_type: 'government' | 'parastatal' | 'private' | 'ngo';
  payroll_cycle: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMICEnrollment {
  id: string;
  borrower_id: string;
  employer_id: string | null;
  employee_number: string;
  department: string | null;
  gross_salary: number | null;
  net_salary: number | null;
  existing_deductions: number;
  available_deduction_capacity: number | null;
  enrollment_status: 'pending' | 'active' | 'suspended' | 'terminated';
  enrolled_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  borrower?: { full_name: string | null; email: string; phone: string | null };
  employer?: PMICEmployer;
}

export interface PMICSubmission {
  id: string;
  submission_reference: string;
  submission_type: 'deduction_request' | 'stop_order' | 'variation' | 'reconciliation';
  payroll_period_start: string;
  payroll_period_end: string;
  total_amount: number | null;
  total_records: number | null;
  status: 'draft' | 'pending' | 'submitted' | 'processing' | 'completed' | 'failed' | 'rejected';
  submitted_at: string | null;
  submitted_by: string | null;
  processed_at: string | null;
  file_url: string | null;
  response_file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMICException {
  id: string;
  enrollment_id: string | null;
  submission_id: string | null;
  exception_type: 'insufficient_salary' | 'employment_terminated' | 'duplicate_deduction' | 'invalid_employee' | 'exceeded_limit' | 'payroll_error';
  exception_status: 'open' | 'investigating' | 'resolved' | 'closed';
  description: string | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  enrollment?: PMICEnrollment;
}

export function usePMIC() {
  const { toast } = useToast();
  const [config, setConfig] = useState<PMICConfig | null>(null);
  const [employers, setEmployers] = useState<PMICEmployer[]>([]);
  const [enrollments, setEnrollments] = useState<PMICEnrollment[]>([]);
  const [submissions, setSubmissions] = useState<PMICSubmission[]>([]);
  const [exceptions, setExceptions] = useState<PMICException[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pmic_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching PMIC config:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // Update Config
  const updateConfig = useCallback(async (updates: Partial<PMICConfig>) => {
    try {
      if (!config?.id) {
        throw new Error('No config found');
      }

      const { data, error } = await supabase
        .from('pmic_config')
        .update(updates)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      setConfig(data);
      toast({ title: 'Success', description: 'PMIC configuration updated' });
      return data;
    } catch (err: any) {
      console.error('Error updating PMIC config:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [config, toast]);

  // Fetch Employers
  const fetchEmployers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pmic_employers')
        .select('*')
        .order('employer_name');

      if (error) throw error;
      setEmployers((data || []) as PMICEmployer[]);
      return data as PMICEmployer[];
    } catch (err: any) {
      console.error('Error fetching PMIC employers:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Add Employer
  const addEmployer = useCallback(async (employer: Omit<PMICEmployer, 'id' | 'created_at' | 'updated_at' | 'is_verified' | 'verified_at' | 'verified_by'>) => {
    try {
      const { data, error } = await supabase
        .from('pmic_employers')
        .insert(employer as any)
        .select()
        .single();

      if (error) throw error;
      const typedData = data as PMICEmployer;
      setEmployers(prev => [...prev, typedData]);
      toast({ title: 'Success', description: 'Employer added successfully' });
      return typedData;
    } catch (err: any) {
      console.error('Error adding employer:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Update Employer
  const updateEmployer = useCallback(async (id: string, updates: Partial<PMICEmployer>) => {
    try {
      const { data, error } = await supabase
        .from('pmic_employers')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const typedData = data as PMICEmployer;
      setEmployers(prev => prev.map(e => e.id === id ? typedData : e));
      toast({ title: 'Success', description: 'Employer updated successfully' });
      return typedData;
    } catch (err: any) {
      console.error('Error updating employer:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Delete Employer
  const deleteEmployer = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('pmic_employers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEmployers(prev => prev.filter(e => e.id !== id));
      toast({ title: 'Success', description: 'Employer deleted' });
      return true;
    } catch (err: any) {
      console.error('Error deleting employer:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return false;
    }
  }, [toast]);

  // Verify Employer
  const verifyEmployer = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('pmic_employers')
        .update({ 
          is_verified: true, 
          verified_at: new Date().toISOString(),
          verified_by: user?.id 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const typedData = data as PMICEmployer;
      setEmployers(prev => prev.map(e => e.id === id ? typedData : e));
      toast({ title: 'Success', description: 'Employer verified' });
      return typedData;
    } catch (err: any) {
      console.error('Error verifying employer:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Fetch Enrollments
  const fetchEnrollments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pmic_borrower_enrollments')
        .select(`
          *,
          borrower:profiles!pmic_borrower_enrollments_borrower_id_fkey(full_name, email, phone),
          employer:pmic_employers(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnrollments((data || []) as PMICEnrollment[]);
      return data as PMICEnrollment[];
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Create Enrollment
  const createEnrollment = useCallback(async (enrollment: {
    borrower_id: string;
    employer_id?: string;
    employee_number: string;
    department?: string;
    gross_salary?: number;
    net_salary?: number;
    existing_deductions?: number;
  }) => {
    try {
      // Calculate available deduction capacity
      const maxDeductionPercent = config?.max_deduction_percent || 33;
      const netSalary = enrollment.net_salary || 0;
      const existingDeductions = enrollment.existing_deductions || 0;
      const availableCapacity = (netSalary * maxDeductionPercent / 100) - existingDeductions;

      const { data, error } = await supabase
        .from('pmic_borrower_enrollments')
        .insert({
          ...enrollment,
          available_deduction_capacity: Math.max(0, availableCapacity)
        })
        .select(`
          *,
          borrower:profiles!pmic_borrower_enrollments_borrower_id_fkey(full_name, email, phone),
          employer:pmic_employers(*)
        `)
        .single();

      if (error) throw error;
      const typedData = data as PMICEnrollment;
      setEnrollments(prev => [typedData, ...prev]);
      toast({ title: 'Success', description: 'Enrollment created successfully' });
      return typedData;
    } catch (err: any) {
      console.error('Error creating enrollment:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [config, toast]);

  // Update Enrollment
  const updateEnrollment = useCallback(async (id: string, updates: Partial<PMICEnrollment>) => {
    try {
      // Recalculate capacity if salary or deductions changed
      if (updates.net_salary !== undefined || updates.existing_deductions !== undefined) {
        const enrollment = enrollments.find(e => e.id === id);
        const maxDeductionPercent = config?.max_deduction_percent || 33;
        const netSalary = updates.net_salary ?? enrollment?.net_salary ?? 0;
        const existingDeductions = updates.existing_deductions ?? enrollment?.existing_deductions ?? 0;
        updates.available_deduction_capacity = Math.max(0, (netSalary * maxDeductionPercent / 100) - existingDeductions);
      }

      const { data, error } = await supabase
        .from('pmic_borrower_enrollments')
        .update(updates as any)
        .eq('id', id)
        .select(`
          *,
          borrower:profiles!pmic_borrower_enrollments_borrower_id_fkey(full_name, email, phone),
          employer:pmic_employers(*)
        `)
        .single();

      if (error) throw error;
      const typedData = data as PMICEnrollment;
      setEnrollments(prev => prev.map(e => e.id === id ? typedData : e));
      toast({ title: 'Success', description: 'Enrollment updated successfully' });
      return typedData;
    } catch (err: any) {
      console.error('Error updating enrollment:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [config, enrollments, toast]);

  // Update Enrollment Status
  const updateEnrollmentStatus = useCallback(async (id: string, status: PMICEnrollment['enrollment_status']) => {
    const updates: Partial<PMICEnrollment> = { enrollment_status: status };
    if (status === 'active') {
      updates.enrolled_at = new Date().toISOString();
    }
    return updateEnrollment(id, updates);
  }, [updateEnrollment]);

  // Fetch Submissions
  const fetchSubmissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pmic_payroll_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions((data || []) as PMICSubmission[]);
      return data as PMICSubmission[];
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Create Submission
  const createSubmission = useCallback(async (submission: {
    submission_type: PMICSubmission['submission_type'];
    payroll_period_start: string;
    payroll_period_end: string;
    total_amount?: number;
    total_records?: number;
    notes?: string;
  }) => {
    try {
      // Generate reference
      const prefix = submission.submission_type === 'deduction_request' ? 'DR' :
                     submission.submission_type === 'stop_order' ? 'SO' :
                     submission.submission_type === 'variation' ? 'VAR' : 'REC';
      const timestamp = Date.now().toString(36).toUpperCase();
      const reference = `${prefix}-${timestamp}`;

      const { data, error } = await supabase
        .from('pmic_payroll_submissions')
        .insert({
          ...submission,
          submission_reference: reference
        })
        .select()
        .single();

      if (error) throw error;
      const typedData = data as PMICSubmission;
      setSubmissions(prev => [typedData, ...prev]);
      toast({ title: 'Success', description: 'Submission created successfully' });
      return typedData;
    } catch (err: any) {
      console.error('Error creating submission:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Process Submission
  const processSubmission = useCallback(async (id: string, status: PMICSubmission['status']) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updates: any = { status };
      if (status === 'submitted') {
        updates.submitted_at = new Date().toISOString();
        updates.submitted_by = user?.id;
      } else if (status === 'completed' || status === 'failed') {
        updates.processed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('pmic_payroll_submissions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const typedData = data as PMICSubmission;
      setSubmissions(prev => prev.map(s => s.id === id ? typedData : s));
      toast({ title: 'Success', description: `Submission ${status}` });
      return typedData;
    } catch (err: any) {
      console.error('Error processing submission:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Fetch Exceptions
  const fetchExceptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pmic_exceptions')
        .select(`
          *,
          enrollment:pmic_borrower_enrollments(
            *,
            borrower:profiles!pmic_borrower_enrollments_borrower_id_fkey(full_name, email, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExceptions((data || []) as PMICException[]);
      return data as PMICException[];
    } catch (err: any) {
      console.error('Error fetching exceptions:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // Resolve Exception
  const resolveException = useCallback(async (id: string, resolution: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('pmic_exceptions')
        .update({
          exception_status: 'resolved',
          resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq('id', id)
        .select(`
          *,
          enrollment:pmic_borrower_enrollments(
            *,
            borrower:profiles!pmic_borrower_enrollments_borrower_id_fkey(full_name, email, phone)
          )
        `)
        .single();

      if (error) throw error;
      const typedData = data as PMICException;
      setExceptions(prev => prev.map(e => e.id === id ? typedData : e));
      toast({ title: 'Success', description: 'Exception resolved' });
      return typedData;
    } catch (err: any) {
      console.error('Error resolving exception:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  // Refresh All
  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchConfig(),
        fetchEmployers(),
        fetchEnrollments(),
        fetchSubmissions(),
        fetchExceptions()
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchConfig, fetchEmployers, fetchEnrollments, fetchSubmissions, fetchExceptions]);

  // Stats
  const stats = {
    activeEnrollments: enrollments.filter(e => e.enrollment_status === 'active').length,
    pendingEnrollments: enrollments.filter(e => e.enrollment_status === 'pending').length,
    totalDeductionCapacity: enrollments
      .filter(e => e.enrollment_status === 'active')
      .reduce((sum, e) => sum + (e.available_deduction_capacity || 0), 0),
    pendingSubmissions: submissions.filter(s => s.status === 'pending' || s.status === 'draft').length,
    completedSubmissions: submissions.filter(s => s.status === 'completed').length,
    totalSubmissionAmount: submissions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.total_amount || 0), 0),
    openExceptions: exceptions.filter(e => e.exception_status === 'open').length,
    investigatingExceptions: exceptions.filter(e => e.exception_status === 'investigating').length,
    resolvedExceptions: exceptions.filter(e => e.exception_status === 'resolved').length,
    verifiedEmployers: employers.filter(e => e.is_verified).length,
    totalEmployers: employers.length
  };

  return {
    // State
    config,
    employers,
    enrollments,
    submissions,
    exceptions,
    loading,
    error,
    stats,
    // Config
    fetchConfig,
    updateConfig,
    // Employers
    fetchEmployers,
    addEmployer,
    updateEmployer,
    deleteEmployer,
    verifyEmployer,
    // Enrollments
    fetchEnrollments,
    createEnrollment,
    updateEnrollment,
    updateEnrollmentStatus,
    // Submissions
    fetchSubmissions,
    createSubmission,
    processSubmission,
    // Exceptions
    fetchExceptions,
    resolveException,
    // Utility
    refreshAll
  };
}
