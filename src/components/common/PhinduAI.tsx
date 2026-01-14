import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Sparkles,
    X,
    Send,
    Bot,
    User,
    MessageCircle,
    Loader2,
    RefreshCcw,
    Copy,
    Check,
    Minimize2,
    Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Message {
    id: string;
    role: "assistant" | "user";
    content: string;
    timestamp: Date;
    isLoading?: boolean;
}

// Enhanced knowledge base with comprehensive loan information
const PHINDU_KNOWLEDGE = {
    general: {
        about: "Phindu Credit Solutions is a leading micro-lending platform in Zambia, offering personal and business loans with competitive rates and flexible terms. We're part of HOKMA INCS ZAMBIA LIMITED.",
        contact: "You can reach us via email at info@phindu.com or call +260 967 713 001. Our office is located in Lusaka, Zambia.",
        hours: "Our customer service is available Monday to Friday, 8:00 AM to 5:00 PM Central Africa Time.",
    },
    loans: {
        types: "We offer Personal Loans, Salary Advance Loans, Business Loans, Emergency Loans, and Asset Financing.",
        requirements: "To apply for a loan, you need: Valid NRC, Proof of income (payslip/bank statement), Proof of residence, Employment verification, and at least 3 months employment history.",
        process: "Our loan process: 1) Apply online or in-person, 2) Submit required documents, 3) Wait for approval (usually 24-48 hours), 4) Sign digital contract, 5) Receive funds via bank or mobile money.",
        rates: "Interest rates vary by loan product, typically ranging from 10% to 25% per annum. The exact rate depends on the loan type, amount, and your credit profile.",
        terms: "Loan terms range from 1 to 36 months depending on the product and your needs.",
    },
    admin: {
        applications: "Navigate to 'Applications' to review pending loans. You can filter by status, assign to officers, and perform risk assessments.",
        collections: "The 'Collections' module helps track overdue payments. You can log follow-up activities and manage recovery.",
        reports: "Access PAR (Portfolio at Risk) analytics, disbursement trends, and collection reports in the 'Reports' section.",
        settings: "Configure lending rules, company info, and API integrations in 'Settings'. This includes Tumeny, Lenco payment gateways.",
        staff: "Manage staff roles and permissions in the 'Staff' section. You can invite new staff and assign specific roles.",
    },
    borrower: {
        apply: "Click 'Apply Now' on your dashboard to start a new loan application. You'll need to provide personal details, employment info, and upload documents.",
        track: "Your dashboard shows all your loan applications and their current status. You can download statements for active loans.",
        repayments: "View upcoming repayments on your dashboard. We support mobile money (MTN, Airtel) and bank transfers.",
        documents: "Upload required documents like NRC, payslips, and bank statements through the application form.",
        calculator: "Use our loan calculator to estimate your monthly repayments before applying.",
    }
};

// Smart response generator with contextual understanding
const generateSmartResponse = (userMessage: string, isAdmin: boolean): string => {
    const msg = userMessage.toLowerCase();

    // Greeting patterns
    if (msg.match(/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/)) {
        return isAdmin
            ? "Hello! 👋 I'm PHINDU AI, your intelligent system assistant. I can help you navigate the LMS, analyze loan data, process applications, and answer any questions about the system. What would you like to do today?"
            : "Hello! 👋 I'm PHINDU, your personal loan assistant. I'm here to help you with loan applications, track your repayments, answer questions about our services, and guide you through the process. How can I assist you today?";
    }

    // Help/capability questions
    if (msg.match(/what can you do|help|capabilities|features|how do you work/)) {
        return isAdmin
            ? `As your AI assistant, I can help you with:
      
📋 **Loan Management**
• Process and review applications
• Perform risk assessments
• Track disbursements

📊 **Analytics**
• Generate PAR reports
• Analyze collection trends
• Monitor portfolio health

⚙️ **System Navigation**
• Find features quickly
• Explain workflows
• Guide through processes

Just ask me anything about the system!`
            : `I'm here to help you with:

💰 **Loan Applications**
• Guide you through the application process
• Explain requirements and documents needed
• Check application status

📱 **Account Management**
• View your active loans
• Download statements
• Track repayments

❓ **Information**
• Explain loan products
• Answer questions about terms and rates
• Provide support

What would you like to know?`;
    }

    // Application-related queries
    if (msg.match(/apply|application|how to apply|start application|new loan/)) {
        return isAdmin
            ? `To add a new loan application:
      
1. Go to **'Applications'** in the sidebar
2. Click **'Add Loan'** button
3. Select the borrower from the system
4. Fill in employment details
5. Choose loan product and amount
6. Submit for processing

You can also assign applications to specific loan officers for review.`
            : `To apply for a loan:

1. Click **'Apply Now'** on your dashboard
2. Fill in your personal information
3. Enter employment details
4. Upload required documents (NRC, payslip)
5. Select loan amount and term
6. Review and submit

📋 **Required Documents:**
• Valid NRC (front & back)
• Recent payslip or income proof
• Proof of residence

Most applications are processed within 24-48 hours!`;
    }

    // Repayment queries
    if (msg.match(/repay|payment|pay back|installment|due date|schedule/)) {
        return isAdmin
            ? `Manage repayments in the **'Repayments'** module:

• View all scheduled and recorded payments
• Record manual payments
• Track payment history
• Generate payment reports
• Reverse erroneous payments

For overdue accounts, use the **'Collections'** module to log follow-up activities.`
            : `Managing your repayments is easy:

📅 **View Schedule**: Your dashboard shows upcoming payments
💳 **Payment Methods**: 
• Mobile Money (MTN, Airtel)
• Bank Transfer
• Cash at our office

📄 **Statements**: Download your loan statement anytime from the dashboard

⏰ Tips for on-time payments:
• Set up calendar reminders
• Pay a few days before due date
• Contact us early if you have issues`;
    }

    // Status check
    if (msg.match(/status|track|where is my|pending|approved|rejected/)) {
        return isAdmin
            ? `Track application statuses in the Applications list. Filter by:

• **Pending**: New applications awaiting review
• **Under Review**: Being assessed by an officer
• **Approved**: Ready for disbursement
• **Disbursed**: Funds released
• **Active**: Loan in repayment
• **Completed**: Fully repaid
• **Defaulted**: Overdue accounts`
            : `You can check your loan status on your **Dashboard**:

🔵 **Pending** - Application submitted, awaiting review
🔵 **Under Review** - Being assessed by our team
🟢 **Approved** - Congratulations! Ready for disbursement
🟣 **Disbursed** - Funds sent to your account
🟢 **Active** - Loan is being repaid
⚫ **Completed** - Fully paid off

Your dashboard shows real-time status updates!`;
    }

    // Interest/rates
    if (msg.match(/interest|rate|percentage|how much|cost/)) {
        return `Our interest rates vary by loan product:

💰 **Personal Loans**: 15-20% per annum
💼 **Business Loans**: 18-25% per annum
⚡ **Salary Advance**: 10-15% per annum
🏠 **Asset Financing**: 12-18% per annum

The exact rate depends on:
• Loan amount and term
• Your credit profile
• Employment stability

Use our **Loan Calculator** to see exact repayment amounts before applying!`;
    }

    // Documents
    if (msg.match(/document|upload|nrc|payslip|required|need/)) {
        return `Documents required for loan applications:

📄 **Mandatory:**
• National Registration Card (NRC) - front & back
• Recent Payslip or Income Proof (last 3 months)
• Proof of Residence (utility bill or lease)

📎 **Additional (may be required):**
• Employment Letter
• Bank Statements (last 3 months)
• Business Registration (for business loans)
• Collateral documents (for secured loans)

📤 **How to Upload:**
During application, you'll find upload sections for each document type. Accepted formats: PDF, JPG, PNG (max 10MB each)`;
    }

    // Collections/overdue (admin)
    if (isAdmin && msg.match(/collect|overdue|default|recovery|follow up/)) {
        return `The **Collections** module helps manage overdue accounts:

📊 **Dashboard Features:**
• PAR (Portfolio at Risk) metrics
• Aging analysis
• Recovery targets

📞 **Collection Actions:**
• Log call attempts
• Record promises to pay
• Schedule follow-ups
• Send SMS reminders

📝 **Recovery Options:**
• Payment arrangements
• Restructuring
• Write-off recommendations

Navigate to Collections from the sidebar to get started.`;
    }

    // Reports (admin)
    if (isAdmin && msg.match(/report|analytics|analysis|data|metrics|par/)) {
        return `Access comprehensive reports in the **Reports** section:

📈 **Available Reports:**
• PAR (Portfolio at Risk) Analysis
• Disbursement Trends
• Collection Performance
• Loan Officer Productivity
• Repayment Analysis

📊 **Key Metrics:**
• Total active portfolio
• Default rate
• Recovery rate
• Average loan size

You can export reports to PDF or Excel for further analysis.`;
    }

    // Calculator
    if (msg.match(/calculator|calculate|estimate|monthly payment/)) {
        return `Use our **Loan Calculator** to estimate repayments:

📱 **Access Options:**
• Main menu → Calculator
• During loan application
• Dashboard quick link

🧮 **How it works:**
1. Enter loan amount
2. Select term (months)
3. See monthly payment
4. View total repayment

The calculator uses real interest rates from our active loan products for accurate estimates!`;
    }

    // Thank you / bye
    if (msg.match(/thank|thanks|bye|goodbye|appreciate/)) {
        return isAdmin
            ? "You're welcome! If you need any more help navigating the system or have questions, I'm always here. Have a productive day! 🌟"
            : "You're welcome! If you have any more questions about loans or need assistance, feel free to ask anytime. Good luck with your financial goals! 🌟";
    }

    // Default contextual response
    const generalInfo = PHINDU_KNOWLEDGE.general;
    const loanInfo = PHINDU_KNOWLEDGE.loans;

    // Try to find relevant info based on keywords
    if (msg.match(/about|company|who are you|phindu/)) {
        return generalInfo.about;
    }
    if (msg.match(/contact|phone|email|reach|call/)) {
        return generalInfo.contact + "\n\n" + generalInfo.hours;
    }
    if (msg.match(/type|product|option|offer/)) {
        return loanInfo.types + "\n\n" + loanInfo.terms;
    }
    if (msg.match(/process|step|how long|timeline/)) {
        return loanInfo.process;
    }
    if (msg.match(/require|need|eligible|qualification/)) {
        return loanInfo.requirements;
    }

    // Fallback response
    return isAdmin
        ? `I understand you're asking about "${userMessage.slice(0, 50)}...". Let me help you with that:

🔍 Try navigating to:
• **Applications** - For loan management
• **Reports** - For analytics
• **Settings** - For configuration

Or ask me specific questions like:
• "How do I approve a loan?"
• "Show me PAR metrics"
• "How to add staff?"

What would you like to know more about?`
        : `Thanks for your question! Here's what I can help with:

📋 **Loan Information**
• "How do I apply for a loan?"
• "What documents do I need?"
• "What are the interest rates?"

💳 **Account Help**
• "How do I check my loan status?"
• "How do I make a repayment?"
• "Can I download my statement?"

Would you like me to explain any of these?`;
};

const PhinduAI: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { user, isAdmin } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcomeMessage = isAdmin
                ? "👋 Hi, I am **PHINDU AI**, your intelligent system assistant. I can help you navigate the LMS, analyze reports, manage loans, and answer any questions about the platform. What would you like to do today?"
                : "👋 Hi, I am **PHINDU**! I'm here to help you with your loan journey - from applications to repayments. I can answer questions about our services, guide you through processes, and provide support. How can I assist you today?";

            setMessages([
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: welcomeMessage,
                    timestamp: new Date(),
                },
            ]);
        }
    }, [isOpen, isAdmin, messages.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();

        // Add user message
        setMessages((prev) => [
            ...prev,
            {
                id: userMessageId,
                role: "user",
                content: userMsg,
                timestamp: new Date(),
            },
        ]);
        setInput("");
        setIsTyping(true);

        // Add typing indicator
        setMessages((prev) => [
            ...prev,
            {
                id: assistantMessageId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
                isLoading: true,
            },
        ]);

        // Simulate AI thinking time (realistic delay)
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

        // Generate smart response
        const response = generateSmartResponse(userMsg, isAdmin);

        // Replace loading message with actual response
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === assistantMessageId
                    ? { ...msg, content: response, isLoading: false }
                    : msg
            )
        );
        setIsTyping(false);
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleClearChat = () => {
        setMessages([]);
    };

    const suggestedQuestions = isAdmin
        ? ["How to approve loans?", "Show PAR metrics", "Add new staff"]
        : ["How to apply?", "Check loan status", "Required documents"];

    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-[60]">
                <Button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full gradient-primary shadow-glow hover:scale-110 transition-all duration-300 p-0 group"
                >
                    <div className="relative">
                        <MessageCircle
                            size={28}
                            className="text-primary-foreground group-hover:scale-110 transition-transform"
                        />
                        <Sparkles
                            size={12}
                            className="absolute -top-1 -right-1 text-yellow-300 animate-pulse"
                        />
                    </div>
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
            <Card
                className={cn(
                    "glass shadow-2xl border-primary/20 flex flex-col mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-6 transition-all duration-300",
                    isExpanded
                        ? "w-[90vw] md:w-[600px] h-[80vh]"
                        : "w-80 md:w-96 h-[500px]"
                )}
            >
                <CardHeader className="gradient-primary py-3 px-4 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Bot className="text-white" size={20} />
                        </div>
                        <div>
                            <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                                PHINDU AI
                                <Sparkles size={14} className="text-yellow-300" />
                            </CardTitle>
                            <p className="text-white/70 text-xs">
                                {isTyping ? "Typing..." : "Online"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-white hover:bg-white/20 h-8 w-8"
                        >
                            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearChat}
                            className="text-white hover:bg-white/20 h-8 w-8"
                            title="Clear chat"
                        >
                            <RefreshCcw size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsOpen(false)}
                            className="text-white hover:bg-white/20 h-8 w-8"
                        >
                            <X size={18} />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-background/50 backdrop-blur-md">
                    {/* Messages */}
                    <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={cn(
                                        "flex gap-2",
                                        m.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {m.role === "assistant" && (
                                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
                                            <Bot size={14} className="text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            "max-w-[85%] p-3 rounded-2xl text-sm relative group",
                                            m.role === "user"
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : "bg-white/10 border border-border/50 text-foreground rounded-tl-none"
                                        )}
                                    >
                                        {m.isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="whitespace-pre-wrap">{m.content}</div>
                                                {m.role === "assistant" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleCopy(m.content, m.id)}
                                                    >
                                                        {copiedId === m.id ? (
                                                            <Check size={12} className="text-green-500" />
                                                        ) : (
                                                            <Copy size={12} className="text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {m.role === "user" && (
                                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                            <User size={14} className="text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Questions */}
                    {messages.length <= 1 && (
                        <div className="px-4 pb-2">
                            <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedQuestions.map((q) => (
                                    <Button
                                        key={q}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 bg-background/50 border-border/50 hover:bg-primary/10 hover:border-primary/30"
                                        onClick={() => {
                                            setInput(q);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {q}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-border/20 bg-card/30">
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                placeholder="Ask me anything..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                className="bg-background/50 border-border/50"
                                disabled={isTyping}
                            />
                            <Button
                                size="icon"
                                onClick={handleSend}
                                className="gradient-primary shrink-0"
                                disabled={!input.trim() || isTyping}
                            >
                                {isTyping ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Send size={18} />
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PhinduAI;
