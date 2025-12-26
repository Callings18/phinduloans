import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, X, Send, Bot, User, Minimize2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface Message {
    role: "assistant" | "user";
    content: string;
}

const PHINDU_KNOWLEDGE = {
    admin: [
        "I can help you manage loan applications, check risk scores, and process disbursements.",
        "Navigate to 'Applications' to review pending loans. You can assign staff and add risk assessments there.",
        "Use 'Collections' to track overdue payments and log follow-up activities.",
        "The 'Reports' section gives you analytics on PAR (Portfolio at Risk) and disbursement trends.",
        "In 'Settings', you can configure lending rules, company info, and API integrations like Tumeny or Lenco.",
    ],
    borrower: [
        "I'm here to help you apply for a loan and track your repayments.",
        "To apply, click the 'Apply Now' button on your dashboard. You'll need your employment and KYC documents.",
        "You can use the 'Calculator' to estimate your monthly repayments before applying.",
        "Check your 'Dashboard' for real-time status of your applications.",
        "Phindu Credit Solutions offers flexible terms and competitive rates for both personal and business needs.",
    ]
};

const PhinduAI: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const { user, isAdmin } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcome = isAdmin
                ? "Hi, I am PHINDU, your system assistant. I can help you navigate the LMS, analyze reports, and manage loans. How can I assist you today?"
                : "Hi, I am PHINDU! I'm here to help you with your loan application and answer questions about our services. What's on your mind?";

            setMessages([{ role: "assistant", content: welcome }]);
        }
    }, [isOpen, isAdmin]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setInput("");

        // Simple simulated AI logic
        setTimeout(() => {
            let response = "";
            const lowerInput = userMsg.toLowerCase();
            const context = isAdmin ? PHINDU_KNOWLEDGE.admin : PHINDU_KNOWLEDGE.borrower;

            if (lowerInput.includes("help") || lowerInput.includes("what can you do")) {
                response = isAdmin
                    ? "I can guide you through loan approvals, risk management, and system configuration. I know where every feature is located!"
                    : "I can assist you with your loan application, explain our products, and show you how to download statements.";
            } else if (lowerInput.includes("apply")) {
                response = "To start an application, go to 'Apply Now'. You will need to provide personal details, employment info, and upload your NRC/Documents.";
            } else if (lowerInput.includes("repay") || lowerInput.includes("payment")) {
                response = isAdmin
                    ? "You can manage repayments in the 'Repayments' module. You can record manual payments or check automated ones."
                    : "You can see your upcoming repayments on your dashboard. We support mobile money and bank transfers.";
            } else {
                // Random knowledge pull
                response = context[Math.floor(Math.random() * context.length)];
            }

            setMessages(prev => [...prev, { role: "assistant", content: response }]);
        }, 1000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
            {isOpen ? (
                <Card className="w-80 md:w-96 h-[500px] glass shadow-2xl border-primary/20 flex flex-col mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-6">
                    <CardHeader className="gradient-primary py-4 px-6 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Bot className="text-white" size={18} />
                            </div>
                            <CardTitle className="text-white text-lg font-bold">PHINDU AI</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20 h-8 w-8">
                            <X size={18} />
                        </Button>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-background/50 backdrop-blur-md">
                        <div className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.map((m, i) => (
                                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-[80%] p-3 rounded-2xl text-sm",
                                            m.role === "user"
                                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                                : "bg-white/10 border border-border/50 text-foreground rounded-tl-none"
                                        )}>
                                            {m.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-border/20 bg-card/30">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ask me anything..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    className="bg-background/50 border-border/50"
                                />
                                <Button size="icon" onClick={handleSend} className="gradient-primary">
                                    <Send size={18} />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full gradient-primary shadow-glow hover:scale-110 transition-all duration-300 p-0"
                >
                    <MessageCircle size={28} className="text-primary-foreground" />
                </Button>
            )}
        </div>
    );
};

export default PhinduAI;
