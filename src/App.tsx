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
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Onboarding from "./pages/Onboarding";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
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

            <Route element={<AccountThemeScope><Outlet /></AccountThemeScope>}>
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>} />
              <Route path="/student/:id" element={<ProtectedRoute><Layout><StudentDetail /></Layout></ProtectedRoute>} />
              <Route path="/add-student" element={<ProtectedRoute><Layout><AddStudent /></Layout></ProtectedRoute>} />
              <Route path="/student/:id/edit" element={<ProtectedRoute><Layout><EditStudent /></Layout></ProtectedRoute>} />
              <Route path="/memberships" element={<ProtectedRoute><Layout><Memberships /></Layout></ProtectedRoute>} />
              <Route path="/membership/:id" element={<ProtectedRoute><Layout><MembershipDetail /></Layout></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Layout><Attendance /></Layout></ProtectedRoute>} />
              <Route path="/schedule" element={<ProtectedRoute><Layout><Schedule /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              <Route path="/help-center" element={<ProtectedRoute><Layout><HelpCenter /></Layout></ProtectedRoute>} />
              <Route path="/payment-success" element={<ProtectedRoute><Layout><PaymentSuccess /></Layout></ProtectedRoute>} />
              <Route path="/payment-cancelled" element={<ProtectedRoute><Layout><PaymentCancelled /></Layout></ProtectedRoute>} />
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
