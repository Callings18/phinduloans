-- Product house reports posted into central Admin Reports feed.

CREATE TABLE IF NOT EXISTS public.product_house_report_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL,
  product_name TEXT,
  report_type TEXT NOT NULL DEFAULT 'house_summary',
  report_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  csv_content TEXT,
  posted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_house_report_posts_created_at
  ON public.product_house_report_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_house_report_posts_product_code
  ON public.product_house_report_posts (product_code);

ALTER TABLE public.product_house_report_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_report_posts_select" ON public.product_house_report_posts;
CREATE POLICY "house_report_posts_select"
  ON public.product_house_report_posts
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_permission(auth.uid(), 'reports', 'view')
    OR public.has_permission(auth.uid(), 'reports', 'export')
  );

DROP POLICY IF EXISTS "house_report_posts_insert" ON public.product_house_report_posts;
CREATE POLICY "house_report_posts_insert"
  ON public.product_house_report_posts
  FOR INSERT
  WITH CHECK (
    posted_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_permission(auth.uid(), 'house', 'reports_export')
      OR public.has_permission(auth.uid(), 'reports', 'export')
    )
  );
