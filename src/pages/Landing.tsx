import { Button } from "@/components/ui/button";
import { Check, Loader2, Users, Calendar, TrendingUp, CreditCard, Award, Clock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-platform-checkout-session",
        {
          body: { isAnonymous: true },
        }
      );

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      toast.error(error.message || "Failed to start subscription");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Users,
      title: "Student Management",
      description: "Track unlimited students with detailed profiles, belt ranks, and progress history all in one place.",
    },
    {
      icon: Calendar,
      title: "Attendance Tracking",
      description: "Smart check-in system that automatically detects current classes based on your schedule.",
    },
    {
      icon: Award,
      title: "Belt Promotions",
      description: "Visual belt system from White to Black to easily track and celebrate student achievements.",
    },
    {
      icon: TrendingUp,
      title: "Financial Reports",
      description: "Comprehensive insights into revenue trends, membership growth, and payment history.",
    },
    {
      icon: CreditCard,
      title: "Stripe Integration",
      description: "Seamless payment processing with automatic recurring billing for student memberships.",
    },
    {
      icon: Clock,
      title: "Schedule Management",
      description: "Set up weekly class schedules with automatic timezone support for accurate tracking.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create Your Academy",
      description: "Sign up and set up your academy profile with name, logo, and timezone settings.",
    },
    {
      number: "02",
      title: "Add Students",
      description: "Import or manually add students with their details, belt ranks, and membership plans.",
    },
    {
      number: "03",
      title: "Set Schedule",
      description: "Configure your weekly class schedule with specific times and class types.",
    },
    {
      number: "04",
      title: "Start Managing",
      description: "Track attendance, process payments, and monitor your academy's growth effortlessly.",
    },
  ];

  const benefits = [
    "Save hours of administrative work every week",
    "Never miss a membership payment again",
    "Gain insights into your academy's performance",
    "Professional image with automated systems",
    "Focus more on teaching, less on paperwork",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Jiu-Jitsu Manager
          </h1>
          <Button variant="ghost" onClick={() => navigate("/login")}>
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
              <span className="text-sm font-medium text-primary">🥋 Built for BJJ Academies</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6">
              Manage Your Academy
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">Like a Black Belt</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
              The all-in-one platform for Brazilian Jiu-Jitsu academies. Track students, manage memberships, 
              monitor attendance, and handle payments—all from one beautiful dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg h-14 px-8 bg-gradient-primary hover:opacity-90 transition-opacity"
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Your Subscription"
                )}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg h-14 px-8 border-2"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need to Run Your Academy
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed specifically for Brazilian Jiu-Jitsu academy management
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-card p-8 rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">{feature.title}</h4>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-bold mb-4">
              Get Started in Minutes
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple setup process to get your academy up and running
            </p>
          </div>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
                      {step.number}
                    </div>
                  </div>
                  <div className="pt-2">
                    <h4 className="text-2xl font-semibold mb-3">{step.title}</h4>
                    <p className="text-muted-foreground text-lg">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-5xl font-bold mb-4">
                Why Academy Owners Love Us
              </h3>
              <p className="text-xl text-muted-foreground">
                Focus on what matters most—teaching and growing your academy
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg border">
              <ul className="space-y-5">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-4">
                    <div className="h-7 w-7 rounded-full bg-green-600/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              One affordable plan with everything included. No hidden fees.
            </p>
          </div>
          <div className="max-w-lg mx-auto">
            <div className="bg-card border-2 border-primary rounded-2xl p-8 md:p-10 shadow-xl relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  BEST VALUE
                </div>
              </div>
              
              <div className="text-center mb-8">
                <h4 className="text-3xl font-bold mb-2">Standard Plan</h4>
                <p className="text-muted-foreground">Everything you need to grow</p>
              </div>
              
              <div className="flex items-baseline justify-center gap-2 mb-10">
                <span className="text-6xl font-bold">$29</span>
                <span className="text-2xl text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-4 mb-10">
                {[
                  "Unlimited Students",
                  "Attendance Tracking",
                  "Belt Promotions",
                  "Financial Reports",
                  "Stripe Integration",
                  "Schedule Management",
                  "Email Support",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-lg">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                size="lg" 
                className="w-full text-lg h-14 bg-gradient-primary hover:opacity-90 transition-opacity" 
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Your Subscription"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-6">
                Secure payment via Stripe • Cancel anytime • No setup fees
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <h3 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Academy?
            </h3>
            <p className="text-xl md:text-2xl mb-10 opacity-90">
              Join hundreds of BJJ academies already using Jiu-Jitsu Manager to streamline 
              their operations and focus on what they do best—teaching.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg h-14 px-10"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Get Started Today"
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <h4 className="text-xl font-bold mb-2">Jiu-Jitsu Manager</h4>
              <p className="text-sm text-muted-foreground">
                Empowering BJJ academies worldwide
              </p>
            </div>
            <div className="flex gap-6">
              <button 
                onClick={() => navigate("/login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => navigate("/signup")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Up
              </button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Jiu-Jitsu Manager. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
