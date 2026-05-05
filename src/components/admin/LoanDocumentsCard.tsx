import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Eye, Download, FolderOpen, ShieldCheck, IdCard, Receipt, Paperclip, FileCheck2, Upload, Trash2, Users, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { getSignedUrl } from "@/utils/storageHelpers";

type DocItem = {
  key: string;
  label: string;
  path: string;
  kind: "image" | "pdf" | "file";
  group: "collateral" | "identity" | "income" | "contract" | "co_borrower" | "absolute_owner" | "other";
  /** Source row ids so we know how to delete. */
  appDocId?: string;
  vaultDocId?: string;
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
  co_borrower: { label: "Co-borrower", icon: Users, tint: "text-fuchsia-500" },
  absolute_owner: { label: "Absolute owner", icon: UserCheck, tint: "text-cyan-500" },
  other: { label: "Other", icon: Paperclip, tint: "text-muted-foreground" },
};

const UPLOAD_CATEGORIES: { value: DocItem["group"]; label: string }[] = [
  { value: "collateral", label: "Collateral" },
  { value: "identity", label: "Identity (NRC)" },
  { value: "income", label: "Income / Payslip" },
  { value: "contract", label: "Contract" },
  { value: "co_borrower", label: "Co-borrower" },
  { value: "absolute_owner", label: "Absolute owner" },
  { value: "other", label: "Other" },
];

function inferKind(path: string): DocItem["kind"] {
  const p = path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(p)) return "image";
  if (/\.pdf$/i.test(p)) return "pdf";
  return "file";
}

function normalizeDocKey(path: string): string {
  const s = path.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return u.pathname + u.search;
    } catch {
      return s.split("?")[0].split("#")[0];
    }
  }
  return s.split("?")[0].split("#")[0];
}

function inferGroupFromDocMeta(docType: string, label: string): DocItem["group"] {
  const t = `${docType} ${label}`.toLowerCase();
  if (t.includes("co_borrower") || t.includes("co-borrower") || t.includes("coborrower")) return "co_borrower";
  if (t.includes("absolute_owner") || t.includes("absolute owner") || t.includes("owner")) return "absolute_owner";
  if (t.includes("collateral") || t.includes("title") || t.includes("deed")) return "collateral";
  if (t.includes("nrc") || t.includes("selfie") || t.includes("identity")) return "identity";
  if (t.includes("payslip") || t.includes("bank") || t.includes("income")) return "income";
  if (t.includes("contract")) return "contract";
  return "other";
}

function buildLegacyDocs(loan: any): DocItem[] {
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
  const { data: appDocuments } = useQuery({
    queryKey: ["application-documents", loan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", loan.id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loan?.id,
  });

  const { data: vaultDocs } = useQuery({
    queryKey: ["borrower-kyc-vault", loan?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("borrower_document_vault")
        .select("*")
        .eq("borrower_id", loan.user_id)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!loan?.user_id,
  });

  const docs = useMemo(() => {
    const merged: DocItem[] = [];
    const seen = new Set<string>();

    const pushUnique = (item: DocItem) => {
      const k = normalizeDocKey(item.path);
      if (!k || seen.has(k)) return;
      seen.add(k);
      merged.push(item);
    };

    if (appDocuments?.length) {
      for (const doc of appDocuments) {
        const url = (doc.file_url as string)?.trim();
        if (!url) continue;
        pushUnique({
          key: `adb_${doc.id}`,
          label: doc.doc_label || doc.doc_type,
          path: url,
          kind: inferKind(doc.file_name || url),
          group: inferGroupFromDocMeta(doc.doc_type, doc.doc_label || ""),
          appDocId: doc.id,
        });
      }
    }

    for (const row of buildLegacyDocs(loan)) {
      pushUnique(row);
    }

    if (vaultDocs?.length) {
      for (const v of vaultDocs) {
        const url = v.file_url?.trim();
        if (!url) continue;
        pushUnique({
          key: `vault_${v.id}`,
          label: v.doc_label || v.doc_type,
          path: url,
          kind: inferKind(v.file_name || url),
          group: inferGroupFromDocMeta(v.doc_type, v.doc_label || ""),
          vaultDocId: v.id,
        });
      }
    }

    return merged;
  }, [appDocuments, vaultDocs, loan]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string>("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const imgDocs = docs.filter((d) => d.kind === "image");
      if (imgDocs.length === 0) {
        setThumbs({});
        return;
      }
      const next: Record<string, string> = {};
      await Promise.all(
        imgDocs.map(async (d) => {
          try {
            if (/^https?:\/\//i.test(d.path)) {
              next[d.key] = d.path;
              return;
            }
            const signed = await getSignedUrl(d.path, bucket);
            if (signed) next[d.key] = signed;
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
  }, [docs, bucket]);

  const resolveOpenUrl = async (doc: DocItem): Promise<string | null> => {
    if (/^https?:\/\//i.test(doc.path)) return doc.path;
    return getSignedUrl(doc.path, bucket);
  };

  const openDoc = async (doc: DocItem) => {
    try {
      const url = await resolveOpenUrl(doc);
      if (!url) throw new Error("No signed URL");
      if (doc.kind === "image") {
        setPreviewLabel(doc.label);
        setPreviewUrl(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(`Could not open ${doc.label}: ${e?.message ?? "unknown error"}`);
    }
  };

  const downloadDoc = async (doc: DocItem) => {
    try {
      if (/^https?:\/\//i.test(doc.path)) {
        window.open(doc.path, "_blank", "noopener,noreferrer");
        return;
      }
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(doc.path, 3600, { download: true });
      if (error || !data?.signedUrl) throw error || new Error("No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(`Could not download ${doc.label}: ${e?.message ?? "unknown error"}`);
    }
  };

  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocItem["group"]>("collateral");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);

  const refreshDocs = () => {
    qc.invalidateQueries({ queryKey: ["application-documents", loan?.id] });
    qc.invalidateQueries({ queryKey: ["borrower-kyc-vault", loan?.user_id] });
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!loan?.id || !loan?.user_id) {
      toast.error("Loan or borrower missing — cannot upload.");
      return;
    }
    setUploading(true);
    try {
      const baseLabel = (uploadLabel || UPLOAD_CATEGORIES.find((c) => c.value === uploadCategory)?.label || "Document").trim();
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;
        const ext = file.name.split(".").pop() || "bin";
        const slug = `${uploadCategory}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        const path = `loan-docs/${loan.user_id}/${loan.id}/${slug}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const docLabel = files.length === 1 ? baseLabel : `${baseLabel} ${i + 1}`;
        await supabase.from("application_documents").insert({
          application_id: loan.id,
          borrower_id: loan.user_id,
          doc_type: slug,
          doc_label: docLabel,
          file_url: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
          loan_product_id: loan.loan_product_id ?? null,
          uploaded_by: user?.id ?? null,
        });
        await supabase.from("borrower_document_vault").insert({
          borrower_id: loan.user_id,
          doc_type: slug,
          doc_label: docLabel,
          file_url: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        });
      }
      toast.success(`${files.length} file${files.length === 1 ? "" : "s"} uploaded`);
      setUploadLabel("");
      refreshDocs();
    } catch (e: any) {
      toast.error(`Upload failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteDoc = async (doc: DocItem) => {
    try {
      // Best-effort storage delete (skip absolute URLs/legacy columns)
      if (!/^https?:\/\//i.test(doc.path)) {
        await supabase.storage.from(bucket).remove([doc.path]);
      }
      if (doc.appDocId) {
        await supabase.from("application_documents").delete().eq("id", doc.appDocId);
      } else {
        await supabase.from("application_documents").delete().eq("application_id", loan.id).eq("file_url", doc.path);
      }
      if (doc.vaultDocId) {
        await supabase.from("borrower_document_vault").delete().eq("id", doc.vaultDocId);
      }
      toast.success(`Deleted ${doc.label}`);
      refreshDocs();
    } catch (e: any) {
      toast.error(`Delete failed: ${e?.message ?? "unknown error"}`);
    } finally {
      setDeleteTarget(null);
    }
  };

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
              <CardDescription>Application uploads, vault files, and legacy loan columns</CardDescription>
            </div>
            <Badge variant="outline">{docs.length} file{docs.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload bar */}
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Upload size={14} />
              <p className="text-xs font-semibold uppercase tracking-wide">Add documents</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Category</Label>
                <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as DocItem["group"])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UPLOAD_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Label (optional)</Label>
                <Input
                  className="h-9"
                  placeholder="e.g. NRC of co-borrower 2"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1 flex flex-col justify-end">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadFiles(e.target.files)}
                />
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> {uploading ? "Uploading..." : "Choose files"}
                </Button>
              </div>
            </div>
          </div>

          {docs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 opacity-50" />
              No documents uploaded for this loan yet.
            </div>
          ) : (
            <div className="space-y-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
                          <div className="p-2 space-y-1">
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
