import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, CheckCircle } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen gradient-hero overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 pt-32 pb-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 animate-fade-in">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Fast Loan Approvals in 24 Hours</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 animate-slide-up">
            Money When You{" "}
            <span className="text-gradient">Need It</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Get quick, hassle-free personal and salary loans with competitive rates. 
            Apply online in minutes and receive funds directly to your mobile money.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="lg" asChild>
              <Link to="/apply">
                Apply Now
                <ArrowRight size={20} />
              </Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link to="/calculator">
                Calculate Your Loan
              </Link>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <Clock className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">24hr Approval</p>
                <p className="text-muted-foreground text-sm">Quick decisions</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <Shield className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">100% Secure</p>
                <p className="text-muted-foreground text-sm">Your data is safe</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 glass px-6 py-4 rounded-xl">
              <CheckCircle className="text-primary" size={24} />
              <div className="text-left">
                <p className="text-foreground font-semibold">Easy Process</p>
                <p className="text-muted-foreground text-sm">Apply online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { value: "K50M+", label: "Loans Disbursed" },
            { value: "5000+", label: "Happy Customers" },
            { value: "24hrs", label: "Avg. Approval Time" },
            { value: "98%", label: "Approval Rate" },
          ].map((stat, index) => (
            <div key={index} className="text-center animate-slide-up" style={{ animationDelay: `${0.4 + index * 0.1}s` }}>
              <p className="text-3xl md:text-4xl font-bold text-gradient">{stat.value}</p>
              <p className="text-muted-foreground text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
