import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import AddStudent from "./pages/AddStudent";
import EditStudent from "./pages/EditStudent";
import Memberships from "./pages/Memberships";
import MembershipDetail from "./pages/MembershipDetail";
import Attendance from "./pages/Attendance";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import EnrollSuccess from "./pages/EnrollSuccess";
import Join from "./pages/Join";
import Waiver from "./pages/Waiver";
import StripeConnectCallback from "./pages/StripeConnectCallback";
import PasswordRecovery from "./pages/PasswordRecovery";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Documentation from "./pages/Documentation";
import HelpCenter from "./pages/HelpCenter";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider, AccountThemeScope } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/password-recovery" element={<PasswordRecovery />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />

            <Route path="/" element={<Landing />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/enroll-success" element={<EnrollSuccess />} />
            <Route path="/join/:organizationId/:planId" element={<Join />} />
            <Route path="/waiver/:token" element={<Waiver />} />

            <Route element={<AccountThemeScope><Outlet /></AccountThemeScope>}>
              <Route element={<ProtectedRoute><Layout><Outlet /></Layout></ProtectedRoute>}>
                <Route path="/dashboard" element={<Index />} />
                <Route path="/students" element={<Students />} />
                <Route path="/student/:id" element={<StudentDetail />} />
                <Route path="/add-student" element={<AddStudent />} />
                <Route path="/student/:id/edit" element={<EditStudent />} />
                <Route path="/memberships" element={<Memberships />} />
                <Route path="/membership/:id" element={<MembershipDetail />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/help-center" element={<HelpCenter />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/payment-cancelled" element={<PaymentCancelled />} />
              </Route>
              <Route path="/stripe-connect-callback" element={<ProtectedRoute><StripeConnectCallback /></ProtectedRoute>} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
