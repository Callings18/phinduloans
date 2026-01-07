import { useState, useEffect, useCallback, useRef } from 'react';

const DRAFT_STORAGE_KEY = 'phindu_loan_application_draft';
const AUTO_SAVE_DELAY = 2000; // 2 seconds

export interface ApplicationDraft {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nrc: string;
    dob: string;
    gender: string;
    address: string;
    city: string;
    employerName: string;
    employerAddress: string;
    jobTitle: string;
    employmentType: string;
    monthlyIncome: string;
    payDay: string;
    employmentDuration: string;
    loanAmount: number;
    loanPurpose: string;
    loanTerm: number;
    repaymentMethod: string;
    collateralDescription: string;
    collateralValue: string;
    selectedProductId?: string;
    currentStep: number;
    lastSaved: string;
    // Store file metadata (names only, not actual files)
    uploadedDocNames: Record<string, string>;
}

interface UseDraftReturn {
    draft: ApplicationDraft | null;
    hasDraft: boolean;
    lastSaved: Date | null;
    isSaving: boolean;
    saveDraft: (data: Partial<ApplicationDraft>) => void;
    loadDraft: () => ApplicationDraft | null;
    clearDraft: () => void;
    restoreDraft: () => ApplicationDraft | null;
}

export const useApplicationDraft = (): UseDraftReturn => {
    const [draft, setDraft] = useState<ApplicationDraft | null>(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check for existing draft on mount
    useEffect(() => {
        const existingDraft = loadDraftFromStorage();
        if (existingDraft) {
            setDraft(existingDraft);
            setHasDraft(true);
            setLastSaved(new Date(existingDraft.lastSaved));
        }
    }, []);

    const loadDraftFromStorage = (): ApplicationDraft | null => {
        try {
            const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored) as ApplicationDraft;
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
        }
        return null;
    };

    const saveDraftToStorage = useCallback((data: ApplicationDraft) => {
        try {
            const dataWithTimestamp = {
                ...data,
                lastSaved: new Date().toISOString(),
            };
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(dataWithTimestamp));
            setDraft(dataWithTimestamp);
            setHasDraft(true);
            setLastSaved(new Date(dataWithTimestamp.lastSaved));
            setIsSaving(false);
        } catch (error) {
            console.error('Failed to save draft:', error);
            setIsSaving(false);
        }
    }, []);

    const saveDraft = useCallback((data: Partial<ApplicationDraft>) => {
        // Clear any existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        setIsSaving(true);

        // Debounce save to avoid too many writes
        saveTimeoutRef.current = setTimeout(() => {
            const currentDraft = loadDraftFromStorage();
            const updatedDraft: ApplicationDraft = {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                nrc: '',
                dob: '',
                gender: '',
                address: '',
                city: '',
                employerName: '',
                employerAddress: '',
                jobTitle: '',
                employmentType: '',
                monthlyIncome: '',
                payDay: '',
                employmentDuration: '',
                loanAmount: 5000,
                loanPurpose: '',
                loanTerm: 6,
                repaymentMethod: '',
                collateralDescription: '',
                collateralValue: '',
                currentStep: 1,
                lastSaved: new Date().toISOString(),
                uploadedDocNames: {},
                ...currentDraft,
                ...data,
            };
            saveDraftToStorage(updatedDraft);
        }, AUTO_SAVE_DELAY);
    }, [saveDraftToStorage]);

    const loadDraft = useCallback((): ApplicationDraft | null => {
        return loadDraftFromStorage();
    }, []);

    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            setDraft(null);
            setHasDraft(false);
            setLastSaved(null);
        } catch (error) {
            console.error('Failed to clear draft:', error);
        }
    }, []);

    const restoreDraft = useCallback((): ApplicationDraft | null => {
        const storedDraft = loadDraftFromStorage();
        if (storedDraft) {
            setDraft(storedDraft);
            setHasDraft(true);
            setLastSaved(new Date(storedDraft.lastSaved));
            return storedDraft;
        }
        return null;
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    return {
        draft,
        hasDraft,
        lastSaved,
        isSaving,
        saveDraft,
        loadDraft,
        clearDraft,
        restoreDraft,
    };
};

export default useApplicationDraft;
