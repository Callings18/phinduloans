import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 bg-card relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Get{" "}
            <span className="text-gradient">Started?</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join thousands of Zambians who trust Phindu for their financial needs.
            Apply today and get funds within 24 hours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/apply">
                Apply Now
                <ArrowRight size={20} />
              </Link>
            </Button>
            <Button variant="glass" size="lg">
              <Phone size={20} />
              Call Us: +260 967 713 001
            </Button>
          </div>

          <p className="mt-8 text-muted-foreground text-sm">
            No credit score? No problem. We consider your employment and income.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
