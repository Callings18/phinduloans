import { useRef, useEffect, useState } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser, Check, Upload, PenTool } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignaturePadProps {
  onSave: (signatureData: string, file?: File) => void;
  disabled?: boolean;
  height?: number;
}

export default function SignaturePad({ onSave, disabled = false, height = 200 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"draw" | "upload">("draw");

  useEffect(() => {
    if (canvasRef.current && !signaturePadRef.current) {
      signaturePadRef.current = new SignaturePadLib(canvasRef.current, {
        backgroundColor: "rgba(255, 255, 255, 0)",
        penColor: "#1a1a2e",
      });

      // Handle resize
      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !signaturePadRef.current) return;
        
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const container = canvas.parentElement;
        if (!container) return;
        
        canvas.width = container.clientWidth * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${container.clientWidth}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")?.scale(ratio, ratio);
        signaturePadRef.current.clear();
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      signaturePadRef.current.addEventListener("endStroke", () => {
        setIsEmpty(signaturePadRef.current?.isEmpty() ?? true);
      });

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        signaturePadRef.current?.off();
      };
    }
  }, [height]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSaveDrawn = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL("image/png");
      onSave(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedSignature(event.target?.result as string);
        setUploadedFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUploaded = () => {
    if (uploadedSignature && uploadedFile) {
      onSave(uploadedSignature, uploadedFile);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "draw" | "upload")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw" className="flex items-center gap-2">
            <PenTool size={14} />
            Draw Signature
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload size={14} />
            Upload Signature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-4">
          <div className="space-y-3">
            <div 
              className="border-2 border-dashed border-border rounded-lg bg-card overflow-hidden"
              style={{ touchAction: "none" }}
            >
              <canvas
                ref={canvasRef}
                className="w-full cursor-crosshair"
                style={{ height: `${height}px` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Sign above using your mouse or finger
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={isEmpty || disabled}
              >
                <Eraser size={14} className="mr-1" />
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDrawn}
                disabled={isEmpty || disabled}
              >
                <Check size={14} className="mr-1" />
                Apply Signature
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="signature-upload">Upload Signature Image</Label>
              <Input
                id="signature-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={disabled}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Upload a clear image of your signature (PNG, JPG)
              </p>
            </div>
            
            {uploadedSignature && (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-card">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <img 
                    src={uploadedSignature} 
                    alt="Uploaded signature" 
                    className="max-h-24 object-contain mx-auto"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveUploaded}
                    disabled={disabled}
                  >
                    <Check size={14} className="mr-1" />
                    Use This Signature
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
