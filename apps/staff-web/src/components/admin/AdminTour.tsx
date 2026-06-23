import { useEffect, useState } from "react";
import Joyride, { Step, CallBackProps, STATUS } from "react-joyride";
import { useLocation } from "react-router-dom";

const AdminTour = () => {
    const [run, setRun] = useState(false);
    const location = useLocation();

    const steps: Step[] = [
        {
            target: "body",
            content: "Welcome to Phindu Loans Admin! Let's take a quick look at how to manage your operations.",
            placement: "center",
            disableBeacon: true,
        },
        {
            target: "#nav-dashboard",
            content: "Your main dashboard shows Portfolio At Risk (PAR) and key financial metrics.",
        },
        {
            target: "#nav-applications",
            content: "New loan requests appear here. You can manually add loans or review customer submissions.",
        },
        {
            target: "#nav-loans",
            content: "Track your active portfolio here. This shows all disbursed loans and their current status.",
        },
        {
            target: "#nav-collections",
            content: "Manage overdue accounts and recovery activities. You can log phone calls and 'Promise to Pay' dates here.",
        },
        {
            target: "#nav-staff",
            content: "Add your team members and assign roles (Loan Officer, Credit Officer, etc.) for internal workflows.",
        },
        {
            target: "#nav-settings",
            content: "Finally, configure your interest rates, loan products, and API keys for LENCO, SMS, and Email.",
        },
    ];

    useEffect(() => {
        // Show tour if it hasn't been seen yet
        const hasSeenTour = localStorage.getItem("phindu_admin_tour_seen");
        if (!hasSeenTour) {
            setRun(true);
        }
    }, []);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            setRun(false);
            localStorage.setItem("phindu_admin_tour_seen", "true");
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
                    primaryColor: "#0EA5E9",
                    backgroundColor: "#1E293B",
                    textColor: "#F8FAFC",
                    arrowColor: "#1E293B",
                },
                buttonNext: {
                    backgroundColor: "linear-gradient(to right, #0EA5E9, #2563EB)",
                    borderRadius: "8px",
                },
            }}
        />
    );
};

export default AdminTour;
