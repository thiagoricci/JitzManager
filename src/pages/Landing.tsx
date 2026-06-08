import { Seo } from "@/lib/seo";
import {
  Check,
  Loader2,
  Users,
  Calendar,
  TrendingUp,
  CreditCard,
  Award,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Shield,
  BarChart3,
  LayoutDashboard,
  CalendarCheck,
  Settings,
  HelpCircle,
  UserCheck,
  UserPlus,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, useRef, type FC, type ReactNode, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { brandFixedStyles, useBrandLightMode } from "@/lib/brand-theme";
import { useAuth } from "@/contexts/AuthContext";

/* ─────────────────────────────────────────────────────────────
   Design tokens — light brand canvas (navy primary) with the BJJ
   belt spectrum as the living accent system. Crimson is reserved
   for the authentic black-belt red bar.
   ───────────────────────────────────────────────────────────── */
const PAGE = "hsl(220 17% 97%)"; // base canvas
const PAGE_ALT = "hsl(0 0% 100%)"; // alternating section (white)
const CARD = "hsl(0 0% 100%)"; // raised card
const CARD_HI = "hsl(220 16% 97%)";
const LINE = "hsl(220 13% 90%)"; // hairline border
const LINE_HI = "hsl(220 13% 82%)";
const TEXT = "hsl(222 47% 11%)"; // primary text (dark navy)
const MUTE = "hsl(215 16% 47%)"; // muted text
const NAVY = "hsl(237 83% 27%)"; // primary brand accent
const NAVY_HI = "hsl(237 83% 33%)";
const CRIMSON = "hsl(348 83% 47%)"; // the black-belt red bar

const BELT = {
  white: "hsl(45 32% 90%)",
  blue: "hsl(217 76% 50%)",
  purple: "hsl(266 54% 54%)",
  brown: "hsl(25 46% 36%)",
  black: "hsl(0 0% 9%)",
};

/* ───── scroll reveal ───── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const Reveal: FC<{ children: ReactNode; className?: string; delay?: number }> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity .8s cubic-bezier(.16,1,.3,1) ${delay}ms, transform .8s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/* white & black belt dots need a ring to read on a light canvas */
const dotRing = (c: string) =>
  c === BELT.white ? `0 0 0 1px ${LINE_HI}` : c === BELT.black ? `0 0 0 1px ${LINE}` : undefined;

const beltDots = [BELT.white, BELT.blue, BELT.purple, BELT.brown, BELT.black];

export default function Landing() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useBrandLightMode();

  const platformLogo = organization?.logo_url || "/logo.png";

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-platform-checkout-session",
        { body: { isAnonymous: true } }
      );
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: unknown) {
      console.error("Error creating checkout session:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start subscription"
      );
    } finally {
      setLoading(false);
    }
  };

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const features = [
    {
      icon: Users,
      title: "Student Management",
      description:
        "Unlimited profiles with belt rank, stripe count, and full promotion history — your whole roster on one mat.",
      accent: BELT.blue,
    },
    {
      icon: Calendar,
      title: "Attendance Tracking",
      description:
        "Smart check-in detects the live class from your schedule. Tap in, train, done.",
      accent: BELT.purple,
    },
    {
      icon: Award,
      title: "Belt Promotions",
      description:
        "Track every grading from white to black. Celebrate the moment, keep the record.",
      accent: CRIMSON,
    },
    {
      icon: TrendingUp,
      title: "Financial Reports",
      description:
        "Revenue trends, membership growth, and payment history rendered in plain sight.",
      accent: BELT.brown,
    },
    {
      icon: CreditCard,
      title: "Stripe Payments",
      description:
        "Recurring billing handled end to end. Money in the door without the paperwork.",
      accent: NAVY,
    },
    {
      icon: Clock,
      title: "Schedule Management",
      description:
        "Weekly class plans with timezone-aware tracking that always reads the room right.",
      accent: BELT.purple,
    },
  ];

  const steps = [
    { number: "01", title: "Create your academy", description: "Set up your profile — name, logo, and timezone. Two minutes, no card." },
    { number: "02", title: "Add your students", description: "Import or add by hand with belt ranks, stripes, and membership plans." },
    { number: "03", title: "Set the schedule", description: "Map your weekly classes with exact times and class types." },
    { number: "04", title: "Run the mats", description: "Track attendance, take payments, and watch the academy grow." },
  ];
  // dark-enough stroke colors for step numerals on a light canvas
  const stepStroke = [NAVY, BELT.blue, BELT.purple, BELT.brown];

  const pricingFeatures = [
    "Unlimited students",
    "Attendance tracking",
    "Belt & stripe promotions",
    "Financial reports",
    "Stripe payment processing",
    "Schedule management",
    "Email support",
  ];

  // ── data for the in-hero dashboard preview (mirrors the real Dashboard) ──
  const previewNav = [
    { icon: LayoutDashboard, active: true },
    { icon: Users },
    { icon: CreditCard },
    { icon: CalendarCheck },
    { icon: Calendar },
  ];
  const previewNavSecondary = [Settings, HelpCircle];
  const previewStats = [
    { title: "Total Students", value: "142", icon: Users, trend: "+12% overtime", up: true },
    { title: "Active Students", value: "128", icon: UserCheck, trend: "+8% overtime", up: true },
    { title: "New Students", value: "9", icon: UserPlus, trend: "This Month", up: false },
    { title: "Active Trials", value: "6", icon: TrendingUp, trend: "3 new this month", up: false },
  ];
  const revenueBars = [38, 52, 45, 63, 58, 74, 69, 88]; // % heights
  const beltDist = [
    { c: BELT.white, n: 41 },
    { c: BELT.blue, n: 58 },
    { c: BELT.purple, n: 26 },
    { c: BELT.brown, n: 11 },
    { c: BELT.black, n: 6 },
  ];
  const navy15 = `color-mix(in srgb, ${NAVY} 14%, transparent)`;

  /* ───── reusable buttons ───── */
  const Primary: FC<{
    size?: "default" | "lg";
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
  }> = ({ size = "default", className = "", onClick, disabled, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group/btn relative inline-flex items-center justify-center font-semibold tracking-tight rounded-full overflow-hidden transition-all duration-300 active:scale-[.98] hover:shadow-lg ${
        size === "lg" ? "h-14 px-9 text-[1.05rem]" : "h-11 px-6 text-sm"
      } ${disabled ? "opacity-60 pointer-events-none" : ""} ${className}`}
      style={{ background: NAVY, color: "hsl(0 0% 100%)", fontFamily: "'Hanken Grotesk', sans-serif", boxShadow: `0 10px 30px -12px ${NAVY}` }}
    >
      <span
        className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"
        style={{ background: NAVY_HI }}
      />
      <span className="relative flex items-center">{children}</span>
    </button>
  );

  const Ghost: FC<{
    size?: "default" | "lg";
    className?: string;
    onClick?: () => void;
    children: ReactNode;
  }> = ({ size = "default", className = "", onClick, children }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center font-semibold tracking-tight rounded-full border transition-colors duration-300 ${
        size === "lg" ? "h-14 px-9 text-[1.05rem]" : "h-11 px-6 text-sm"
      } ${className}`}
      style={{ borderColor: LINE_HI, color: TEXT, fontFamily: "'Hanken Grotesk', sans-serif", background: PAGE_ALT }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = NAVY;
        e.currentTarget.style.color = NAVY;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = LINE_HI;
        e.currentTarget.style.color = TEXT;
      }}
    >
      {children}
    </button>
  );

  const anton: CSSProperties = { fontFamily: "'Anton', sans-serif" };
  const body: CSSProperties = { fontFamily: "'Hanken Grotesk', sans-serif" };

  const marqueeWords = [
    "STUDENT MANAGEMENT",
    "ATTENDANCE",
    "BELT PROMOTIONS",
    "PAYMENTS",
    "SCHEDULING",
    "REPORTS",
  ];

  return (
    <div
      className="min-h-screen relative overflow-x-clip"
      style={{ ...brandFixedStyles, background: PAGE, color: TEXT, ...body }}
    >
      {/* injected animations + atmosphere */}
      <style>{`
        @keyframes jm-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes jm-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes jm-pulse { 0%,100% { opacity:.5 } 50% { opacity:1 } }
        .jm-grain::before {
          content:""; position:fixed; inset:0; z-index:1; pointer-events:none; opacity:.035;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        ::selection { background: ${NAVY}; color: hsl(0 0% 100%); }
      `}</style>

      <div className="jm-grain" />

      {/* belt-spectrum rail down the far left edge (desktop) */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[6px] z-40 flex-col">
        {beltDots.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>

      {/* ───────────────────────── NAV ───────────────────────── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ background: "hsl(220 17% 97% / .78)", borderBottom: `1px solid ${LINE}` }}
      >
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10 h-[68px] flex justify-between items-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 group"
          >
            <div className="relative h-9 w-9 rounded-xl overflow-hidden">
              <img src={platformLogo} alt="JitzManager" className="h-full w-full object-contain" />
              <div className="absolute -bottom-0 left-0 right-0 h-[3px] flex rounded-b-md overflow-hidden">
                {beltDots.map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
            </div>
            <span className="text-xl tracking-tight" style={{ ...body, fontWeight: 800, color: TEXT }}>
              Jitz<span style={{ color: NAVY }}>Manager</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-9">
            {[
              { label: "Features", action: () => scrollTo("features") },
              { label: "Pricing", action: () => scrollTo("pricing") },
              { label: "Docs", action: () => navigate("/documentation") },
            ].map((l) => (
              <button
                key={l.label}
                onClick={l.action}
                className="text-sm font-medium transition-colors"
                style={{ color: MUTE }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
                onMouseLeave={(e) => (e.currentTarget.style.color = MUTE)}
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:inline-flex text-sm font-semibold transition-colors"
              style={{ color: TEXT }}
              onMouseEnter={(e) => (e.currentTarget.style.color = NAVY)}
              onMouseLeave={(e) => (e.currentTarget.style.color = TEXT)}
            >
              Log in
            </button>
            <Primary onClick={handleSubscribe} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                "Get started"
              )}
            </Primary>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ color: TEXT, border: `1px solid ${LINE}`, background: PAGE_ALT }}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden px-6 pb-5 pt-2"
            style={{ borderTop: `1px solid ${LINE}`, background: "hsl(220 17% 97% / .96)" }}
          >
            <nav className="flex flex-col">
              {[
                { label: "Features", action: () => scrollTo("features") },
                { label: "Pricing", action: () => scrollTo("pricing") },
                { label: "Docs", action: () => navigate("/documentation") },
              ].map((l) => (
                <button
                  key={l.label}
                  onClick={() => {
                    setMenuOpen(false);
                    l.action();
                  }}
                  className="py-3 text-left text-base font-medium"
                  style={{ color: TEXT, borderBottom: `1px solid ${LINE}` }}
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/login");
                }}
                className="py-3 text-left text-base font-semibold"
                style={{ color: NAVY }}
              >
                Log in
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative flex items-center min-h-[calc(100svh-69px)]">
        {/* atmosphere */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 78% 8%, hsl(237 83% 27% / .08), transparent 55%), radial-gradient(90% 70% at 8% 90%, hsl(348 83% 47% / .05), transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(222 47% 11% / .035) 1px, transparent 1px), linear-gradient(90deg, hsl(222 47% 11% / .035) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(110% 90% at 50% 0%, #000 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(110% 90% at 50% 0%, #000 30%, transparent 80%)",
          }}
        />

        <div className="relative w-full max-w-[1240px] mx-auto px-6 lg:pl-10 pt-10 pb-24 md:pt-12 md:pb-28">
          <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-16 items-center">
            {/* left: type */}
            <div>
              <Reveal>
                <div
                  className="inline-flex items-center gap-3 mb-9 pl-2 pr-4 py-2 rounded-full"
                  style={{ background: PAGE_ALT, border: `1px solid ${LINE}`, boxShadow: "0 4px 14px -8px hsl(222 47% 11% / .15)" }}
                >
                  <span className="flex items-center gap-1">
                    {beltDots.map((c, i) => (
                      <span
                        key={i}
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ background: c, boxShadow: dotRing(c) }}
                      />
                    ))}
                  </span>
                  <span className="text-xs font-semibold tracking-wide" style={{ color: MUTE }}>
                    BUILT FOR BRAZILIAN JIU-JITSU ACADEMIES
                  </span>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1
                  className="uppercase leading-[0.86] text-[clamp(3rem,9vw,7rem)]"
                  style={{ ...anton, color: TEXT, letterSpacing: "-0.01em" }}
                >
                  Run your
                  <br />
                  academy like
                  <br />
                  <span className="relative inline-block" style={{ color: NAVY }}>
                    a black belt
                    <span
                      className="absolute left-0 -bottom-1 h-[7px] w-full rounded-full"
                      style={{ background: CRIMSON }}
                    />
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-9 text-lg md:text-xl max-w-lg leading-relaxed" style={{ color: MUTE }}>
                  JitzManager is the all-in-one platform for BJJ academies — students,
                  memberships, attendance, and payments, run from a single dashboard.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <Primary size="lg" onClick={handleSubscribe} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        Start free trial
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                      </>
                    )}
                  </Primary>
                  <Ghost size="lg" onClick={() => scrollTo("features")}>
                    See features
                  </Ghost>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm" style={{ color: MUTE }}>
                  {[
                    { icon: Shield, label: "SSL secured" },
                    { icon: CreditCard, label: "Stripe payments" },
                    { icon: BarChart3, label: "Real-time analytics" },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center gap-2">
                      <t.icon className="h-4 w-4" style={{ color: "hsl(142 60% 40%)" }} />
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* right: dashboard preview — mirrors the real product */}
            <Reveal delay={220}>
              <div className="relative" style={{ animation: "jm-float 7s ease-in-out infinite" }}>
                <div
                  className="absolute -inset-6 rounded-[2rem] pointer-events-none"
                  style={{ background: "radial-gradient(60% 60% at 70% 0%, hsl(237 83% 27% / .1), transparent)" }}
                />
                <div
                  className="relative rounded-[1.25rem] overflow-hidden"
                  style={{
                    background: CARD,
                    border: `1px solid ${LINE}`,
                    boxShadow: "0 40px 80px -32px hsl(222 47% 11% / .35)",
                  }}
                >
                  {/* window chrome */}
                  <div className="flex items-center gap-2 px-4 h-9" style={{ borderBottom: `1px solid ${LINE}`, background: CARD_HI }}>
                    <span className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 70% 67%)" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(40 85% 60%)" }} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(142 50% 55%)" }} />
                    </span>
                    <div
                      className="mx-auto flex items-center gap-1.5 px-3 h-5 rounded-full text-[10px] font-medium"
                      style={{ background: PAGE, color: MUTE, border: `1px solid ${LINE}` }}
                    >
                      <Lock className="h-2.5 w-2.5" />
                      app.jitzmanager.com/dashboard
                    </div>
                  </div>

                  {/* app body: sidebar + main */}
                  <div className="flex" style={{ background: PAGE }}>
                    {/* sidebar */}
                    <div
                      className="w-[54px] shrink-0 py-3 flex flex-col items-center gap-1.5"
                      style={{ borderRight: `1px solid ${LINE}`, background: CARD }}
                    >
                      <div className="h-7 w-7 rounded-xl overflow-hidden mb-2">
                        <img src={platformLogo} alt="" className="h-full w-full object-contain" />
                      </div>
                      {previewNav.map((item, i) => (
                        <div
                          key={i}
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ background: item.active ? navy15 : "transparent", color: item.active ? NAVY : MUTE }}
                        >
                          <item.icon className="h-4 w-4" />
                        </div>
                      ))}
                      <div className="mt-auto pt-3 flex flex-col gap-1.5">
                        {previewNavSecondary.map((Icon, i) => (
                          <div key={i} className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ color: MUTE }}>
                            <Icon className="h-4 w-4" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* main */}
                    <div className="flex-1 min-w-0 p-4">
                      <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
                        <div>
                          <div className="text-sm" style={{ ...body, fontWeight: 800, color: TEXT }}>Dashboard</div>
                          <div className="text-[10px]" style={{ color: MUTE }}>Overview of your academy</div>
                        </div>
                        <div className="h-7 w-7 rounded-full" style={{ background: "hsl(220 14% 90%)", border: `1px solid ${LINE}` }} />
                      </div>

                      {/* stat cards */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {previewStats.map((s) => (
                          <div key={s.title} className="rounded-lg p-2.5" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div className="text-[9px] truncate" style={{ color: MUTE }}>{s.title}</div>
                                <div className="text-lg leading-tight" style={{ ...body, fontWeight: 800, color: TEXT }}>{s.value}</div>
                                <div className="text-[9px]" style={{ color: s.up ? CRIMSON : MUTE }}>{s.trend}</div>
                              </div>
                              <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ background: navy15 }}>
                                <s.icon className="h-3.5 w-3.5" style={{ color: NAVY }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* charts row */}
                      <div className="grid grid-cols-5 gap-2">
                        {/* revenue */}
                        <div className="col-span-3 rounded-lg p-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="text-[10px]" style={{ ...body, fontWeight: 700, color: TEXT }}>Monthly Revenue</div>
                            <BarChart3 className="h-3 w-3" style={{ color: MUTE }} />
                          </div>
                          <div className="flex items-end gap-1 h-[52px]">
                            {revenueBars.map((h, i) => (
                              <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${h}%`, background: "#82ca9d" }} />
                            ))}
                          </div>
                        </div>
                        {/* belt distribution */}
                        <div className="col-span-2 rounded-lg p-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                          <div className="text-[10px] mb-2.5" style={{ ...body, fontWeight: 700, color: TEXT }}>Belt Distribution</div>
                          <div className="flex flex-col gap-1.5">
                            {beltDist.map((b, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: b.c, boxShadow: dotRing(b.c) }} />
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: PAGE }}>
                                  <div className="h-full rounded-full" style={{ width: `${(b.n / 58) * 100}%`, background: b.c, boxShadow: dotRing(b.c) }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────────────── BELT MARQUEE ───────────────────────── */}
      <div
        className="relative py-5 overflow-hidden"
        style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, background: PAGE_ALT }}
      >
        <div className="flex w-max" style={{ animation: "jm-marquee 32s linear infinite" }}>
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center shrink-0">
              {marqueeWords.map((w, i) => {
                const belt = beltDots[i % beltDots.length];
                // white belt is too light to read as solid text → use black instead
                const wordColor = belt === BELT.white ? BELT.black : belt;
                return (
                  <div key={`${dup}-${w}`} className="flex items-center">
                    <span
                      className="block h-3 w-3 rounded-full mx-7"
                      style={{ background: belt, boxShadow: dotRing(belt) }}
                    />
                    <span
                      className="uppercase text-[clamp(1.5rem,3vw,2.4rem)] whitespace-nowrap"
                      style={{ ...anton, color: wordColor }}
                    >
                      {w}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────── FEATURES ───────────────────────── */}
      <section id="features" className="relative py-24 md:py-32" style={{ background: PAGE }}>
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10">
          <Reveal>
            <div className="mb-16 max-w-2xl">
              <span className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: NAVY }}>
                The toolkit
              </span>
              <h2 className="mt-5 uppercase leading-[0.92] text-[clamp(2.25rem,5.5vw,4rem)]" style={{ ...anton, color: TEXT }}>
                Everything the mats demand
              </h2>
              <p className="mt-6 text-lg" style={{ color: MUTE }}>
                Purpose-built for Brazilian Jiu-Jitsu — designed by people who understand
                what happens after the warm-up.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={(index % 3) * 90}>
                  <div
                    className="group relative h-full p-7 rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1.5"
                    style={{ background: CARD, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px hsl(222 47% 11% / .04)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = feature.accent;
                      e.currentTarget.style.boxShadow = `0 24px 50px -28px ${feature.accent}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = LINE;
                      e.currentTarget.style.boxShadow = "0 1px 2px hsl(222 47% 11% / .04)";
                    }}
                  >
                    <span
                      className="absolute top-5 right-6 text-5xl opacity-[0.06] group-hover:opacity-[0.14] transition-opacity"
                      style={{ ...anton, color: TEXT }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="h-12 w-12 rounded-xl flex items-center justify-center mb-6"
                      style={{ background: `color-mix(in srgb, ${feature.accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${feature.accent} 22%, transparent)` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: feature.accent }} />
                    </div>
                    <h3 className="text-xl mb-3" style={{ ...body, fontWeight: 700, color: TEXT }}>
                      {feature.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: MUTE }}>
                      {feature.description}
                    </p>
                    <div
                      className="mt-6 h-1 w-12 rounded-full transition-all duration-500 group-hover:w-20"
                      style={{ background: feature.accent }}
                    />
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────── HOW IT WORKS ───────────────────────── */}
      <section className="relative py-24 md:py-32" style={{ background: PAGE_ALT, borderTop: `1px solid ${LINE}` }}>
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10">
          <Reveal>
            <div className="mb-16 max-w-2xl">
              <span className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: NAVY }}>
                From sign-up to roll
              </span>
              <h2 className="mt-5 uppercase leading-[0.92] text-[clamp(2.25rem,5.5vw,4rem)]" style={{ ...anton, color: TEXT }}>
                Live on the mats in minutes
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10 max-w-5xl">
            {steps.map((step, index) => (
              <Reveal key={step.number} delay={(index % 2) * 110}>
                <div
                  className="relative flex gap-6 p-7 rounded-2xl h-full"
                  style={{ background: CARD, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px hsl(222 47% 11% / .04)" }}
                >
                  <div
                    className="text-[clamp(2.5rem,5vw,3.5rem)] leading-none shrink-0"
                    style={{ ...anton, color: "transparent", WebkitTextStroke: `1.5px ${stepStroke[index]}` }}
                  >
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-xl mb-2" style={{ ...body, fontWeight: 700, color: TEXT }}>
                      {step.title}
                    </h3>
                    <p className="leading-relaxed" style={{ color: MUTE }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── STATS ───────────────────────── */}
      <section className="relative py-20" style={{ background: PAGE, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10">
              {[
                { v: "500+", k: "Academies" },
                { v: "50k+", k: "Students tracked" },
                { v: "99.9%", k: "Uptime" },
                { v: "24/7", k: "Support" },
              ].map((s, i) => (
                <div key={s.k} className="text-center relative">
                  {i > 0 && (
                    <span
                      className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-12 w-px"
                      style={{ background: LINE }}
                    />
                  )}
                  <div className="text-[clamp(2.5rem,5vw,3.75rem)] leading-none" style={{ ...anton, color: NAVY }}>
                    {s.v}
                  </div>
                  <div className="mt-2 text-sm font-medium" style={{ color: MUTE }}>
                    {s.k}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── PRICING ───────────────────────── */}
      <section id="pricing" className="relative py-24 md:py-32" style={{ background: PAGE_ALT }}>
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10">
          <Reveal>
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <span className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: NAVY }}>
                Pricing
              </span>
              <h2 className="mt-5 uppercase leading-[0.92] text-[clamp(2.25rem,5.5vw,4rem)]" style={{ ...anton, color: TEXT }}>
                One belt. One price.
              </h2>
              <p className="mt-6 text-lg" style={{ color: MUTE }}>
                Everything included. No per-student charges, no hidden fees, no surprises.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="max-w-lg mx-auto">
              <div
                className="relative rounded-[1.75rem] p-9 md:p-10 overflow-hidden"
                style={{ background: CARD, border: `2px solid ${NAVY}`, boxShadow: "0 40px 90px -45px hsl(237 83% 27% / .45)" }}
              >
                {/* belt spectrum cap */}
                <div className="absolute top-0 left-0 right-0 h-1.5 flex">
                  {beltDots.map((c, i) => (
                    <div key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>

                <div className="flex items-center justify-between mb-8 mt-2">
                  <div>
                    <h3 className="text-2xl" style={{ ...body, fontWeight: 800, color: TEXT }}>
                      Standard
                    </h3>
                    <p className="text-sm mt-0.5" style={{ color: MUTE }}>
                      Everything you need to grow
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-full"
                    style={{ background: NAVY, color: "hsl(0 0% 100%)" }}
                  >
                    All-inclusive
                  </span>
                </div>

                <div className="flex items-end gap-2 mb-9">
                  <span className="text-[clamp(4rem,12vw,6rem)] leading-[0.8]" style={{ ...anton, color: TEXT }}>
                    $39
                  </span>
                  <span className="text-lg mb-2" style={{ color: MUTE }}>
                    / month
                  </span>
                </div>

                <ul className="space-y-3.5 mb-9">
                  {pricingFeatures.map((f, i) => {
                    return (
                      <li key={f} className="flex items-center gap-3.5">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: NAVY }}
                        >
                          <Check className="h-3.5 w-3.5" style={{ color: "hsl(0 0% 100%)" }} strokeWidth={3} />
                        </div>
                        <span style={{ ...body, fontWeight: 500, color: TEXT }}>{f}</span>
                      </li>
                    );
                  })}
                </ul>

                <Primary size="lg" className="w-full" onClick={handleSubscribe} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    "Start 14-day free trial"
                  )}
                </Primary>

                <p className="text-center text-xs mt-5" style={{ color: MUTE }}>
                  14-day free trial · Secure payment via Stripe · Cancel anytime
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── CTA ───────────────────────── */}
      <section className="relative py-28 md:py-36 overflow-hidden" style={{ background: NAVY }}>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 90% at 50% 110%, hsl(348 83% 47% / .4), transparent 60%)" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <div className="flex justify-center gap-1.5 mb-8">
              {beltDots.map((c, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: c === BELT.black ? "0 0 0 1px hsl(0 0% 100% / .3)" : undefined }} />
              ))}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <span
              className="inline-flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold px-4 py-2 rounded-full border"
              style={{
                color: "hsl(348 83% 60%)",
                borderColor: "hsl(348 83% 60% / .35)",
                background: "hsl(348 83% 60% / .08)",
                fontFamily: "'Hanken Grotesk', sans-serif",
              }}
            >
              Designed for Academy Owners
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-8 uppercase leading-[0.88] text-[clamp(2.75rem,8vw,5.5rem)] text-white" style={anton}>
              Made by a<br />Black Belt
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-7 text-lg md:text-xl max-w-xl mx-auto leading-relaxed" style={{ color: "hsl(220 30% 82%)" }}>
              Join academies using JitzManager to manage memberships, attendance, and payments — so they can focus on teaching, not paperwork.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="group/btn relative inline-flex items-center justify-center font-semibold tracking-tight rounded-full overflow-hidden transition-all duration-300 active:scale-[.98] hover:shadow-xl h-14 px-9 text-[1.05rem]"
                style={{ background: "hsl(0 0% 100%)", color: NAVY, fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    Get started today
                    <ArrowUpRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </>
                )}
              </button>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center justify-center font-semibold tracking-tight rounded-full border transition-colors duration-300 h-14 px-9 text-[1.05rem] text-white"
                style={{ borderColor: "hsl(0 0% 100% / .3)", fontFamily: "'Hanken Grotesk', sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(0 0% 100% / .1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Log in
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────── FOOTER ───────────────────────── */}
      <footer className="relative py-14" style={{ background: PAGE_ALT, borderTop: `1px solid ${LINE}` }}>
        <div className="max-w-[1240px] mx-auto px-6 lg:pl-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 rounded-xl overflow-hidden">
                <img src={platformLogo} alt="JitzManager" className="h-full w-full object-contain" />
                <div className="absolute -bottom-0 left-0 right-0 h-[2.5px] flex rounded-b-md overflow-hidden">
                  {beltDots.map((c, i) => (
                    <div key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </div>
              </div>
              <span className="text-lg" style={{ ...body, fontWeight: 800, color: TEXT }}>
                Jitz<span style={{ color: NAVY }}>Manager</span>
              </span>
            </div>

            <div className="flex items-center gap-8">
              {[
                { label: "Log in", action: () => navigate("/login") },
                { label: loading ? "Processing…" : "Sign up", action: handleSubscribe },
                { label: "Docs", action: () => navigate("/documentation") },
              ].map((l) => (
                <button
                  key={l.label}
                  onClick={l.action}
                  disabled={l.label === "Processing…"}
                  className="text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ color: MUTE }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = MUTE)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-3"
            style={{ borderTop: `1px solid ${LINE}` }}
          >
            <p className="text-sm" style={{ color: MUTE }}>
              © {new Date().getFullYear()} JitzManager. All rights reserved.
            </p>
            <p className="text-sm" style={{ color: MUTE }}>
              Empowering BJJ academies worldwide — Oss.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
