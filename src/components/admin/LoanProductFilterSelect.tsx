import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: string | null;
  onChange: (productId: string | null) => void;
  id?: string;
  className?: string;
};

export function LoanProductFilterSelect({ value, onChange, id = "loan-product-filter", className }: Props) {
  const { data: products, isLoading } = useQuery({
    queryKey: ["active-loan-products-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_products")
        .select("id, name, product_code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; product_code: string | null }[];
    },
  });

  return (
    <div className={`flex flex-col gap-1.5 min-w-[200px] max-w-xs ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Loan product
      </Label>
      <Select
        disabled={isLoading}
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={isLoading ? "Loading…" : "All products"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All products</SelectItem>
          {(products || []).map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.product_code ? `${p.name} (${p.product_code})` : p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
