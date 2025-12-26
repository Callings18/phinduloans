import React, { useState, useEffect } from "react";
import Joyride, { Step, CallBackProps, STATUS, ACTIONS, Events } from "react-joyride";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface GuidedTourProps {
    steps: Step[];
    tourKey: string;
    externalRun?: boolean;
    onFinish?: () => void;
}

const GuidedTour: React.FC<GuidedTourProps> = ({ steps, tourKey, externalRun, onFinish }) => {
    const [run, setRun] = useState(false);
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (externalRun) {
            setRun(true);
            return;
        }

        if (!isLoading && user) {
            const hasSeenTour = localStorage.getItem(`tour_${tourKey}_${user.id}`);
            if (!hasSeenTour) {
                const timer = setTimeout(() => {
                    setRun(true);
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [user, isLoading, tourKey, externalRun]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            if (user) {
                localStorage.setItem(`tour_${tourKey}_${user.id}`, "true");
            }
            if (onFinish) onFinish();
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            scrollToFirstStep
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    arrowColor: "hsl(var(--card))",
                    backgroundColor: "hsl(var(--card))",
                    overlayColor: "rgba(0, 0, 0, 0.75)",
                    primaryColor: "hsl(var(--primary))",
                    textColor: "hsl(var(--foreground))",
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: "1rem",
                    padding: "1.5rem",
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border) / 0.5)",
                    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                },
                tooltipContainer: {
                    textAlign: "left",
                },
                buttonNext: {
                    backgroundColor: "hsl(var(--primary))",
                    borderRadius: "0.5rem",
                    padding: "0.5rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                },
                buttonBack: {
                    marginRight: "0.75rem",
                    color: "hsl(var(--muted-foreground))",
                },
                buttonSkip: {
                    color: "hsl(var(--muted-foreground))",
                },
            }}
            locale={{
                last: "Finish",
                next: "Next",
                skip: "Skip Tour",
                back: "Back",
            }}
        />
    );
};

export default GuidedTour;
