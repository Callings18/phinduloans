import { FileText, UserCheck, CreditCard, Wallet } from "lucide-react";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Apply Online",
    description: "Fill out our simple application form with your personal and employment details.",
  },
  {
    icon: UserCheck,
    step: "02",
    title: "Get Verified",
    description: "Upload your NRC, payslip, and selfie for quick KYC verification.",
  },
  {
    icon: CreditCard,
    step: "03",
    title: "Approval",
    description: "Our team reviews your application and approves within 24 hours.",
  },
  {
    icon: Wallet,
    step: "04",
    title: "Receive Funds",
    description: "Get your money directly to your mobile money or bank account.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground">
            Getting a loan has never been easier. Four simple steps to financial freedom.
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-24 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative text-center group">
                {/* Step number badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-3 py-1 rounded-full border border-border z-10">
                  <span className="text-xs font-bold text-primary">{step.step}</span>
                </div>

                <div className="p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto flex items-center justify-center mb-6 group-hover:shadow-glow transition-shadow duration-300">
                    <step.icon className="text-primary-foreground" size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
