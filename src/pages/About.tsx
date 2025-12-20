import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Target, Eye, Users, Award } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Mission",
      description: "To provide accessible, fast, and transparent financial solutions to every Zambian, empowering them to achieve their goals.",
    },
    {
      icon: Eye,
      title: "Vision",
      description: "To become Zambia's most trusted digital lending platform, bridging the gap between financial need and opportunity.",
    },
    {
      icon: Users,
      title: "Customer First",
      description: "We put our customers at the heart of everything we do, ensuring fair practices and excellent service.",
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We strive for excellence in our technology, processes, and customer experience every single day.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="gradient-hero py-20 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                About <span className="text-gradient">Phindu Credit Solutions</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                We're on a mission to make financial services accessible to every Zambian. 
                Founded with the belief that everyone deserves access to quick, fair, and transparent loans.
              </p>
            </div>
          </div>
        </section>

        {/* Story */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="glass rounded-3xl p-8 md:p-12">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                  Our Story
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Phindu Credit Solutions was born from a simple observation: too many hardworking Zambians 
                    struggle to access credit when they need it most. Traditional banks have lengthy processes, 
                    strict requirements, and often can't serve those who need help urgently.
                  </p>
                  <p>
                    We built Phindu to change that. Using modern technology, we've created a lending platform 
                    that can assess and approve loans within 24 hours. Our digital-first approach means less 
                    paperwork, faster decisions, and money delivered directly to your mobile money account.
                  </p>
                  <p>
                    Today, we're proud to serve thousands of Zambians across the country, from civil servants 
                    to small business owners. Our commitment remains the same: provide money when you need it, 
                    with fair terms and complete transparency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Our <span className="text-gradient">Values</span>
              </h2>
              <p className="text-muted-foreground">
                The principles that guide everything we do at Phindu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="p-8 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all duration-300"
                >
                  <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6">
                    <value.icon className="text-primary-foreground" size={28} />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Ready to Experience the{" "}
                <span className="text-gradient">Phindu Difference?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of satisfied customers who trust us with their financial needs.
              </p>
              <Button variant="hero" size="lg" asChild>
                <Link to="/apply">
                  Apply for a Loan
                  <ArrowRight size={20} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
