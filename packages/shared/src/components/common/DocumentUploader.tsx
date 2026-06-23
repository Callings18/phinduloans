import { useState, useRef, useCallback } from 'react';
import { Button } from '@phinduloans/shared/components/ui/button';
import { Upload, X, FileText, Image, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@phinduloans/shared/lib/utils';

interface DocumentUploaderProps {
    label: string;
    description?: string;
    required?: boolean;
    accept?: string;
    maxSize?: number; // in MB
    value?: File | null;
    onChange: (file: File | null) => void;
    error?: string;
    className?: string;
}

const DocumentUploader = ({
    label,
    description,
    required = false,
    accept = "image/*,.pdf",
    maxSize = 5, // 5MB default
    value,
    onChange,
    error,
    className,
}: DocumentUploaderProps) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): string | null => {
        // Check file size
        const maxBytes = maxSize * 1024 * 1024;
        if (file.size > maxBytes) {
            return `File size must be less than ${maxSize}MB`;
        }

        // Check file type
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

        const isValidType = acceptedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileExtension === type.toLowerCase();
            }
            if (type.endsWith('/*')) {
                return fileType.startsWith(type.replace('/*', '/'));
            }
            return fileType === type;
        });

        if (!isValidType) {
            return 'Invalid file type. Please upload an accepted format.';
        }

        return null;
    }, [accept, maxSize]);

    const generatePreview = useCallback((file: File) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
            setIsLoading(false);
        }
    }, []);

    const handleFile = useCallback((file: File | null) => {
        setLocalError(null);

        if (!file) {
            onChange(null);
            setPreview(null);
            return;
        }

        const validationError = validateFile(file);
        if (validationError) {
            setLocalError(validationError);
            return;
        }

        setIsLoading(true);
        onChange(file);
        generatePreview(file);
    }, [onChange, validateFile, generatePreview]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        handleFile(file);
    }, [handleFile]);

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleFile(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, [handleFile]);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
        }
    }, []);

    const displayError = error || localError;
    const isImage = value?.type.startsWith('image/');
    const isPdf = value?.type === 'application/pdf';

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className={cn("space-y-2", className)}>
            <label className={cn(
                "text-sm font-medium",
                displayError ? "text-destructive" : "text-foreground"
            )}>
                {label} {required && <span className="text-destructive">*</span>}
            </label>

            <div
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    value && !displayError
                        ? "border-primary bg-primary/5"
                        : displayError
                            ? "border-destructive bg-destructive/5"
                            : isDragOver
                                ? "border-primary bg-primary/10 scale-[1.02]"
                                : "border-border hover:border-primary/50 hover:bg-secondary/50"
                )}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    onChange={handleInputChange}
                    className="hidden"
                    aria-label={label}
                />

                {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Processing...</span>
                    </div>
                ) : value ? (
                    <div className="flex flex-col items-center gap-3 w-full">
                        {/* Preview Section */}
                        {preview && isImage ? (
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                <img
                                    src={preview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : isPdf ? (
                            <div className="w-16 h-16 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <FileText className="text-red-500" size={32} />
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
                                <Check className="text-primary" size={32} />
                            </div>
                        )}

                        {/* File Info */}
                        <div className="text-center">
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                                {value.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {formatFileSize(value.size)}
                            </p>
                        </div>

                        {/* Remove Button */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemove}
                            className="gap-1"
                        >
                            <X size={14} />
                            Remove
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        {displayError ? (
                            <AlertCircle className="text-destructive" size={32} />
                        ) : (
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                isDragOver ? "bg-primary/20" : "bg-secondary"
                            )}>
                                <Upload className={cn(
                                    "transition-colors",
                                    isDragOver ? "text-primary" : "text-muted-foreground"
                                )} size={24} />
                            </div>
                        )}

                        <div className="text-center">
                            <p className={cn(
                                "text-sm font-medium",
                                displayError ? "text-destructive" : "text-foreground"
                            )}>
                                {isDragOver ? "Drop file here" : "Click or drag to upload"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {description || `Max size: ${maxSize}MB`}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {displayError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle size={14} />
                    {displayError}
                </p>
            )}
        </div>
    );
};

export default DocumentUploader;
