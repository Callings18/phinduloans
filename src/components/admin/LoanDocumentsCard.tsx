import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Eye, Download, FolderOpen, ShieldCheck, IdCard, Receipt, Paperclip, FileCheck2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DocItem = {
  key: string;
  label: string;
  path: string;
  kind: "image" | "pdf" | "file";
  group: "collateral" | "identity" | "income" | "contract" | "other";
};

interface Props {
  loan: any;
  /** Defaults to the private loan-documents bucket. */
  bucket?: string;
}

const groupMeta: Record<DocItem["group"], { label: string; icon: any; tint: string }> = {
  collateral: { label: "Collateral", icon: ShieldCheck, tint: "text-amber-500" },
  identity: { label: "Identity (NRC)", icon: IdCard, tint: "text-blue-500" },
  income: { label: "Income / Payslips", icon: Receipt, tint: "text-emerald-500" },
  contract: { label: "Contract", icon: FileCheck2, tint: "text-primary" },
  other: { label: "Other", icon: Paperclip, tint: "text-muted-foreground" },
};

function inferKind(path: string): DocItem["kind"] {
  const p = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(p)) return "image";
  if (/\.pdf$/i.test(p)) return "pdf";
  return "file";
}

function buildDocs(loan: any): DocItem[] {
  const out: DocItem[] = [];
  const push = (key: string, label: string, value: any, group: DocItem["group"]) => {
    if (typeof value === "string" && value.trim()) {
      out.push({ key, label, path: value, kind: inferKind(value), group });
    }
  };
  push("collateral_image_url", "Collateral photo 1", loan?.collateral_image_url, "collateral");
  push("collateral_image_2_url", "Collateral photo 2", loan?.collateral_image_2_url, "collateral");
  push("collateral_image_3_url", "Collateral photo 3", loan?.collateral_image_3_url, "collateral");
  push("nrc_front_url", "NRC – Front", loan?.nrc_front_url, "identity");
  push("nrc_back_url", "NRC – Back", loan?.nrc_back_url, "identity");
  push("payslip_url", "Payslip 1", loan?.payslip_url, "income");
  push("payslip_2_url", "Payslip 2", loan?.payslip_2_url, "income");
  push("payslip_3_url", "Payslip 3", loan?.payslip_3_url, "income");
  push("contract_url", "Generated contract", loan?.contract_url, "contract");
  push("signed_contract_url", "Signed contract", loan?.signed_contract_url, "contract");

  // product_specific_data may carry extra docs (business loan, motor vehicle, etc.)
  const extra = loan?.product_specific_data;
  if (extra && typeof extra === "object") {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (typeof v === "string" && /^(loan-documents\/|kyc\/|borrowers\/|public\/)/i.test(v)) {
        push(`psd_${k}`, k.replace(/_/g, " "), v, "other");
      }
    }
  }
  return out;
}

export default function LoanDocumentsCard({ loan, bucket = "loan-documents" }: Props) {
  const docs = buildDocs(loan);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string>("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const imgDocs = docs.filter((d) => d.kind === "image");
      if (imgDocs.length === 0) return;
      const next: Record<string, string> = {};
      await Promise.all(
        imgDocs.map(async (d) => {
          try {
            const { data } = await supabase.storage.from(bucket).createSignedUrl(d.path, 3600);
            if (data?.signedUrl) next[d.key] = data.signedUrl;
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  const openDoc = async (doc: DocItem) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.path, 3600);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL");
      if (doc.kind === "image") {
        setPreviewLabel(doc.label);
        setPreviewUrl(data.signedUrl);
      } else {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(`Could not open ${doc.label}: ${e?.message ?? "unknown error"}`);
    }
  };

  const downloadDoc = async (doc: DocItem) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.path, 3600, { download: true });
      if (error || !data?.signedUrl) throw error || new Error("No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(`Could not download ${doc.label}: ${e?.message ?? "unknown error"}`);
    }
  };

  // Group docs
  const grouped = docs.reduce<Record<string, DocItem[]>>((acc, d) => {
    (acc[d.group] ||= []).push(d);
    return acc;
  }, {});

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen size={16} className="text-primary" /> Loan Documents
              </CardTitle>
              <CardDescription>Collateral, identity, income & contract files</CardDescription>
            </div>
            <Badge variant="outline">{docs.length} file{docs.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 opacity-50" />
              No documents uploaded for this loan yet.
            </div>
          ) : (
            <div className="space-y-5">
              {(Object.keys(grouped) as DocItem["group"][]).map((g) => {
                const meta = groupMeta[g];
                const items = grouped[g];
                const Icon = meta.icon;
                return (
                  <div key={g} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={meta.tint} />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {meta.label}
                      </p>
                      <span className="text-xs text-muted-foreground">· {items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {items.map((doc) => (
                        <div
                          key={doc.key}
                          className="group rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => openDoc(doc)}
                            className="block w-full aspect-square bg-background relative"
                          >
                            {doc.kind === "image" && thumbs[doc.key] ? (
                              <img
                                src={thumbs[doc.key]}
                                alt={doc.label}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                {doc.kind === "image" ? (
                                  <ImageIcon size={28} />
                                ) : (
                                  <FileText size={28} />
                                )}
                                <span className="mt-1 text-[10px] uppercase">{doc.kind}</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition" />
                          </button>
                          <div className="p-2 space-y-1.5">
                            <p className="text-xs font-medium truncate" title={doc.label}>
                              {doc.label}
                            </p>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 flex-1"
                                onClick={() => openDoc(doc)}
                              >
                                <Eye size={12} className="mr-1" /> View
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => downloadDoc(doc)}
                                title="Download"
                              >
                                <Download size={12} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(previewUrl)} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewLabel}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex flex-col items-center gap-3">
              <img src={previewUrl} alt={previewLabel} className="max-h-[70vh] w-auto rounded-md" />
              <Button asChild size="sm" variant="outline">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Download size={14} className="mr-1" /> Open in new tab
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
