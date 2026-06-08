import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Seo } from "@/lib/seo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mail,
  MessageCircle,
  FileText,
  ExternalLink,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Calendar,
  CreditCard,
  Settings,
  Rocket,
} from "lucide-react";

const quickStart = [
  {
    title: "Set up your academy",
    body: "Go to Settings to confirm your academy name, logo, contact details, and—most importantly—your timezone. The timezone drives your class schedule and attendance, so get it right first.",
  },
  {
    title: "Connect Stripe",
    body: "In Settings → Stripe Integration, click Connect Stripe to link (or create) your Stripe account. This is required before you can charge students or collect membership payments.",
  },
  {
    title: "Create membership plans",
    body: "Open Memberships and add the plans you offer (e.g. Unlimited, 2x/Week, Kids). You'll assign these to students and they drive your recurring billing.",
  },
  {
    title: "Build your class schedule",
    body: "On the Schedule page, add your weekly classes with their days and times. The schedule powers the smart check-in feature on the Attendance page.",
  },
  {
    title: "Add your students",
    body: "Head to Students and add each member with their contact info, belt rank, and a membership plan. You can edit any of this later from their profile.",
  },
  {
    title: "Start taking attendance",
    body: "Each class day, open Attendance and check students in. Once your roster grows, the Dashboard fills in with attendance, revenue, and growth insights.",
  },
];

export default function HelpCenter() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground mt-2">
          New here? Start with the quick-start guide below, then dig into the detailed guides for each part of the platform.
        </p>
      </div>

      {/* Quick start for new users */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Quick Start: Your First 6 Steps
          </CardTitle>
          <CardDescription>
            Brand new to the platform? Follow these in order to get your academy fully set up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {quickStart.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Support resources */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Contact Support
            </CardTitle>
            <CardDescription>Need direct assistance?</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is available Mon-Fri, 9am-5pm EST to help with any technical issues.
            </p>
            <Button className="w-full" variant="outline" asChild>
              <a href="mailto:support@jiujitsumanager.com">
                <Mail className="mr-2 h-4 w-4" />
                Email Support
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Documentation
            </CardTitle>
            <CardDescription>Detailed feature guides</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Browse our comprehensive documentation for in-depth tutorials and feature explanations.
            </p>
            <Button className="w-full" variant="outline" asChild>
              <a href="/documentation" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Docs
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Community
            </CardTitle>
            <CardDescription>Connect with other owners</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Join our Discord community to share tips, ask questions, and network with other academy owners.
            </p>
            <Button className="w-full" variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed guides */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-1">How-To Guides</h2>
        <p className="text-muted-foreground mb-6">
          Step-by-step instructions for every area of the platform.
        </p>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Students</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Team & Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Understanding Your Dashboard</CardTitle>
                <CardDescription>
                  The Dashboard is your academy's home base—a quick read on health and growth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Key Metrics</h3>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li><strong>Total Students:</strong> The total count of active students in your academy.</li>
                    <li><strong>Active Attendance:</strong> Percentage of students who have attended at least one class in the last 30 days.</li>
                    <li><strong>Monthly Revenue:</strong> Estimated revenue based on active memberships.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Charts &amp; Insights</h3>
                  <p className="text-muted-foreground">
                    The Dashboard shows attendance trends over time, student growth, revenue, and belt rank distribution. Use these to spot retention dips early and track whether your academy is growing.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Failed Payments</h3>
                  <p className="text-muted-foreground">
                    Any students with a failed or overdue payment surface on the Dashboard so you can follow up quickly. Click through to the student's profile to review the details and retry the charge.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Managing Students</CardTitle>
                <CardDescription>
                  How to add members, track their progress, and manage their status.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Adding a New Student</h3>
                  <p className="text-muted-foreground">
                    Open the Students page and click <strong>Add Student</strong>. Enter their name and contact info, set their belt rank, and pick a membership plan. You can fill in or change everything later from their profile.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Editing &amp; Viewing Profiles</h3>
                  <p className="text-muted-foreground">
                    Click any student in the list to open their profile. From there you can edit their details, view attendance history, and review their payment history.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Belt Promotions &amp; Stripes</h3>
                  <p className="text-muted-foreground">
                    On a student's profile, update their belt rank or add stripes when they're promoted. The system records the date of each promotion so you can track time-in-grade.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Student Statuses</h3>
                  <p className="text-muted-foreground">
                    Students can be <strong>Active</strong>, <strong>Frozen</strong> (temporarily paused—e.g. travel or injury), or <strong>Inactive</strong>. Freezing or deactivating a student keeps their history but removes them from active counts and billing.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tracking Attendance</CardTitle>
                <CardDescription>
                  Check students into class and keep an accurate record of who's training.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Smart Check-In</h3>
                  <p className="text-muted-foreground">
                    When your weekly Schedule is set up, the Attendance page automatically detects the class happening right now and lets you check students in with a single tap. Search by name to find a student fast.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Check-In Window</h3>
                  <p className="text-muted-foreground">
                    Use the settings on the Attendance page to control how many minutes <strong>before</strong> and <strong>after</strong> a class start time check-ins are allowed. This keeps your records tied to the right class.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Fixing Mistakes</h3>
                  <p className="text-muted-foreground">
                    Checked someone in by accident? You can remove an attendance entry from the day's list. All times respect your academy's timezone (set in Settings).
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Building Your Class Schedule</CardTitle>
                <CardDescription>
                  Your weekly schedule powers smart check-in and keeps members informed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Adding Classes</h3>
                  <p className="text-muted-foreground">
                    On the Schedule page, add each class with its name, day(s) of the week, and start/end time. Repeat for every class you run during a typical week.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Editing &amp; Removing Classes</h3>
                  <p className="text-muted-foreground">
                    Plans change—use the edit and delete controls on each class to keep the schedule current. Changes take effect immediately for check-in.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Why It Matters</h3>
                  <p className="text-muted-foreground">
                    The Attendance page relies on the schedule to know which class is active. If check-in says "no class right now," double-check the day, time, and your timezone in Settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Memberships &amp; Payments</CardTitle>
                <CardDescription>
                  Set up plans, connect Stripe, and collect payments from your students.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Connecting Stripe</h3>
                  <p className="text-muted-foreground">
                    Go to <strong>Settings → Stripe Integration</strong> and click Connect Stripe to link your existing account or create a new one. This is required before any payments can be processed, and money goes directly to your Stripe account.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Creating Membership Plans</h3>
                  <p className="text-muted-foreground">
                    In the Memberships section, create the tiers you offer (e.g. Unlimited, 2x/Week, Kids) with their prices. These plans become selectable when adding or editing a student.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Collecting Payment</h3>
                  <p className="text-muted-foreground">
                    Assign a plan to a student and they'll be set up for recurring billing. You can view every charge in the student's profile under <strong>Payment History</strong>.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Handling Failed Payments</h3>
                  <p className="text-muted-foreground">
                    Failed payments are flagged on your Dashboard and in the student's profile, along with the reason. Stripe automatically retries failed charges based on your Stripe settings, and you can follow up with the member directly.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Team, Account &amp; Settings</CardTitle>
                <CardDescription>
                  Configure your academy, manage your team, and look after your own account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Academy Profile &amp; Timezone</h3>
                  <p className="text-muted-foreground">
                    In <strong>Settings</strong>, set your academy name, logo, and contact details. Make sure your <strong>timezone</strong> is correct—it controls schedule and attendance accuracy.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Admin vs. Staff Roles</h3>
                  <p className="text-muted-foreground">
                    There are two roles. <strong>Admins</strong> can access everything, including Settings. <strong>Staff</strong> can use every feature <em>except</em> the Settings page—great for instructors and front-desk help.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Adding Staff Members</h3>
                  <p className="text-muted-foreground">
                    Admins can add team members from <strong>Settings → Staff Members</strong>. Enter their name, email, and an initial password. They can change that password later from their own Profile page. Remove a staff member there at any time.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Your Account &amp; Security</h3>
                  <p className="text-muted-foreground">
                    Everyone has a <strong>Profile</strong> page for updating their display name, and an Account Security section to change their password or email. Use a strong, unique password.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="faq-1">
            <AccordionTrigger>What should I do first as a new user?</AccordionTrigger>
            <AccordionContent>
              Follow the Quick Start steps at the top of this page: set your timezone in Settings, connect Stripe, create membership plans, build your schedule, add students, then start taking attendance. That order avoids most setup headaches.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-2">
            <AccordionTrigger>Why isn't check-in showing a class?</AccordionTrigger>
            <AccordionContent>
              Smart check-in only shows a class when one is scheduled for the current day and time. Confirm the class exists on the Schedule page, that the day and time are correct, and that your academy timezone in Settings matches your real location.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-3">
            <AccordionTrigger>How do payments work?</AccordionTrigger>
            <AccordionContent>
              We use Stripe Connect. You connect your own Stripe account, and student payments go directly to you. Assign a membership plan to a student to set up recurring billing, and review every charge under the student's Payment History.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-4">
            <AccordionTrigger>What's the difference between Admin and Staff?</AccordionTrigger>
            <AccordionContent>
              Admins have full access including the Settings page (academy config, Stripe, staff management). Staff can use every other feature—students, attendance, schedule, memberships—but can't change academy-wide settings. Admins add and remove staff from Settings.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-5">
            <AccordionTrigger>How do I freeze a student who's taking a break?</AccordionTrigger>
            <AccordionContent>
              Open the student's profile and set their status to Frozen. This pauses them and removes them from active counts and billing while keeping their full history, so you can reactivate them when they return.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="faq-6">
            <AccordionTrigger>Is my data secure?</AccordionTrigger>
            <AccordionContent>
              Yes. We use industry-standard encryption and Row Level Security so each academy can only ever access its own data. Payment details are handled by Stripe and never stored on our servers.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
