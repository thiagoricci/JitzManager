import { Plus, Users, DollarSign, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatCard from "@/components/StatCard";

// Mock data for membership plans
const membershipPlans = [
  {
    id: 1,
    name: "Monthly Unlimited",
    price: "R$ 350",
    period: "month",
    activeMembers: 45,
    status: "active",
    description: "Unlimited classes per month",
    features: ["Unlimited classes", "Access to all equipment", "Monthly seminar access"],
  },
  {
    id: 2,
    name: "3x per Week",
    price: "R$ 250",
    period: "month",
    activeMembers: 28,
    status: "active",
    description: "Up to 3 classes per week",
    features: ["12 classes per month", "Access to all equipment", "Beginner friendly"],
  },
  {
    id: 3,
    name: "2x per Week",
    price: "R$ 180",
    period: "month",
    activeMembers: 18,
    status: "active",
    description: "Up to 2 classes per week",
    features: ["8 classes per month", "Access to all equipment", "Perfect for beginners"],
  },
  {
    id: 4,
    name: "Trial Week",
    price: "R$ 50",
    period: "week",
    activeMembers: 12,
    status: "active",
    description: "7-day trial period",
    features: ["Unlimited classes for 7 days", "No commitment", "Try before you buy"],
  },
];

// Mock stats
const stats = {
  totalRevenue: "R$ 38,750",
  activeMembers: 103,
  averageValue: "R$ 376",
  growth: "+12.5%",
};

export default function Memberships() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Memberships</h2>
          <p className="text-muted-foreground">Manage membership plans and pricing</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Plan
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Revenue"
          value={stats.totalRevenue}
          icon={DollarSign}
          trend={stats.growth}
        />
        <StatCard
          title="Active Members"
          value={stats.activeMembers}
          icon={Users}
          trend="+8"
        />
        <StatCard
          title="Average Value"
          value={stats.averageValue}
          icon={TrendingUp}
        />
        <StatCard
          title="Trial Members"
          value={12}
          icon={Users}
          trend="+4"
        />
      </div>

      {/* Membership Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {membershipPlans.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>
                <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                  {plan.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">/{plan.period}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">
                  {plan.activeMembers} active members
                </span>
              </div>

              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground">Features:</p>
                <ul className="space-y-1.5">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1">
                  Edit
                </Button>
                <Button variant="outline" className="flex-1">
                  View Members
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
