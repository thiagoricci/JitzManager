import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Book, Users, Calendar, Award, CreditCard, Settings, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Documentation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold truncate">Documentation</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>
              Login
            </Button>
            <Button onClick={() => navigate("/")}>Get Started</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-12">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
              <Book className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
              Introduction
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Welcome to the JitzManager documentation. Our platform is designed to help BJJ academy owners streamline their operations, manage students, track attendance, and handle payments efficiently. Whether you're running a small club or a large academy, this guide will help you get the most out of our features.
            </p>
          </section>

          {/* Features */}
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-8">Core Features</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Student Management</h3>
                <p className="text-muted-foreground">
                  Maintain a comprehensive directory of all your students. Track their personal details, belt ranks, stripes, and membership status. Easily add new students and update their profiles as they progress.
                </p>
              </div>

              <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Attendance Tracking</h3>
                <p className="text-muted-foreground">
                  Our smart check-in system automatically detects the current class based on your schedule. Monitor attendance trends and identify your most dedicated students.
                </p>
              </div>

              <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Belt Promotions</h3>
                <p className="text-muted-foreground">
                  Visually track student progress from White Belt to Black Belt. The system helps you keep track of time-in-grade and readiness for promotions.
                </p>
              </div>

              <div className="bg-card p-6 rounded-xl border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Payments & Memberships</h3>
                <p className="text-muted-foreground">
                  Integrated with Stripe for secure payment processing. Set up recurring memberships, track payment history, and manage subscription statuses automatically.
                </p>
              </div>
            </div>
          </section>

          {/* Getting Started */}
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
              <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
              Getting Started Guide
            </h2>
            <div className="space-y-6">
              <div className="border-l-4 border-primary pl-6 py-2">
                <h3 className="text-xl font-semibold mb-2">1. Create Your Account</h3>
                <p className="text-muted-foreground">
                  Sign up for a new account and provide your academy's basic information, including name and location.
                </p>
              </div>
              <div className="border-l-4 border-primary pl-6 py-2">
                <h3 className="text-xl font-semibold mb-2">2. Configure Settings</h3>
                <p className="text-muted-foreground">
                  Go to the Settings page to set your timezone and connect your Stripe account for payments. This is crucial for accurate scheduling and billing.
                </p>
              </div>
              <div className="border-l-4 border-primary pl-6 py-2">
                <h3 className="text-xl font-semibold mb-2">3. Set Up Schedule</h3>
                <p className="text-muted-foreground">
                  Define your weekly class schedule. This enables the smart check-in feature to work correctly.
                </p>
              </div>
              <div className="border-l-4 border-primary pl-6 py-2">
                <h3 className="text-xl font-semibold mb-2">4. Add Students</h3>
                <p className="text-muted-foreground">
                  Start adding your students to the system. You can enter their details manually and assign them to membership plans.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
              <HelpCircle className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
              Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>How does the payment system work?</AccordionTrigger>
                <AccordionContent>
                  We use Stripe Connect to handle payments securely. When you sign up, you'll connect your own Stripe account. Student payments go directly to you, minus our platform fee.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Can I manage multiple locations?</AccordionTrigger>
                <AccordionContent>
                  Currently, each account is tied to a single academy location. For multiple locations, we recommend creating separate accounts for each to keep data organized.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Is my data secure?</AccordionTrigger>
                <AccordionContent>
                  Yes, we use industry-standard encryption and security practices. Your data is stored securely, and we use Row Level Security to ensure only you can access your academy's information.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>How do I cancel my subscription?</AccordionTrigger>
                <AccordionContent>
                  You can manage your subscription settings directly from the dashboard. If you decide to leave, you can export your student data before cancelling.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 mt-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Still have questions? <a href="mailto:support@jiujitsumanager.com" className="text-primary hover:underline">Contact Support</a>
          </p>
        </div>
      </footer>
    </div>
  );
}