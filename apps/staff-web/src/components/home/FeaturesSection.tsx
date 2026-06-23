import { 
  Smartphone, 
  CreditCard, 
  FileText, 
  Bell, 
  Calculator, 
  Users 
} from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "Mobile Money Integration",
    description: "Receive funds directly to your Airtel, MTN, or Zamtel mobile money account instantly.",
  },
  {
    icon: FileText,
    title: "Easy KYC Process",
    description: "Simple verification with NRC, payslip, and selfie. No complex paperwork required.",
  },
  {
    icon: Calculator,
    title: "Transparent Rates",
    description: "Use our loan calculator to see exactly what you'll pay. No hidden fees or surprises.",
  },
  {
    icon: Bell,
    title: "Smart Reminders",
    description: "Get SMS and push notifications for payment due dates and loan status updates.",
  },
  {
    icon: CreditCard,
    title: "Flexible Repayment",
    description: "Choose repayment terms that work for you, with options for salary deductions.",
  },
  {
    icon: Users,
    title: "Employer Partnerships",
    description: "Special rates for employees of our partner companies with payroll integration.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why Choose <span className="text-gradient">Phindu</span>?
          </h2>
          <p className="text-muted-foreground">
            We've designed our lending platform with you in mind. Simple, fast, and secure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6 group-hover:shadow-glow transition-shadow duration-300">
                <feature.icon className="text-primary-foreground" size={28} />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
