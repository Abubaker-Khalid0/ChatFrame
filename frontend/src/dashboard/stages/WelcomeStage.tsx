import { ArrowRight, Shield, EyeOff, LockKeyhole, MessageCircle, Play, Moon, Plus, Plug, MessagesSquare, ShieldCheck, Eye, FileCode2, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { LANGUAGES, type Language } from '@chatframe/shared';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useTranslations } from '../../i18n';
import logoSrc from '../../assets/logo.png';

/**
 * Landing page — premium onboarding screen with hero section, trust features,
 * language selection, and get-started CTA. Replaces the old simple card.
 */
export function WelcomeStage() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const confirm = useLanguageStore((s) => s.confirm);
  const resetWorkflow = useWorkflowStore((s) => s.reset);
  const t = useTranslations();

  const handleGetStarted = () => {
    resetWorkflow();
    confirm();
  };

  return (
    <main className="relative h-screen flex flex-col items-center overflow-hidden bg-dot-grid">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-[1432px] shrink-0 items-center justify-between px-5 md:px-8 lg:px-[112px] h-[64px] mx-auto relative z-50"
        dir="ltr"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer">
          <img src={logoSrc} alt="ChatFrame" className="h-9 w-9 rounded-xl object-contain" />
          <span className="text-[21px] font-bold text-ink tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>ChatFrame</span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Language switcher */}
          <div className="hidden md:flex items-center h-[38px] rounded-[11px] border border-line bg-surface p-1 font-medium text-[13px]">
            {LANGUAGES.map((code: Language) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`flex items-center justify-center px-3 h-full rounded-[8px] transition-colors ${
                  language === code
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Get Started button */}
          <button
            type="button"
            onClick={handleGetStarted}
            className="flex items-center gap-2 h-[38px] px-4 bg-gradient-to-b from-[#06A064] via-[#008B55] to-[#00834F] text-white text-[13px] font-semibold rounded-[11px] shadow-[0_4px_12px_rgba(6,154,96,0.2)] hover:-translate-y-[1px] transition-transform"
          >
            <span>{t.dashboard.getStarted}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </motion.header>

      {/* Hero Section — spacious, breathing layout */}
      <section className="relative flex flex-col items-center text-center pt-14 pb-2 px-5 shrink-0 z-10">
        {/* Privacy badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center justify-center gap-2 h-[32px] px-4 bg-accent-soft border border-accent-border/50 text-accent rounded-full font-semibold text-[12px] shadow-[0_1px_3px_rgba(5,150,105,0.08)]"
        >
          <Shield className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>Private · Local · Read-only</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 text-[28px] md:text-[38px] lg:text-[44px] font-[780] leading-[1.05] tracking-[-0.04em] text-ink max-w-[700px]"
        >
          {t.welcome.title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-[15px] leading-[1.5] text-ink-secondary max-w-[520px]"
        >
          {t.dashboard.onboardingBody}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-row items-center gap-3"
        >
          <button
            type="button"
            onClick={handleGetStarted}
            className="flex items-center justify-center gap-2 h-[42px] px-5 bg-gradient-to-b from-[#06A064] via-[#008B55] to-[#00834F] text-white font-semibold text-[13px] rounded-xl shadow-[0_4px_12px_rgba(6,154,96,0.2)] hover:-translate-y-[1px] transition-transform"
          >
            <span>{t.dashboard.getStarted}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 h-[42px] px-5 bg-surface border-[1.5px] border-accent-border text-accent font-semibold text-[13px] rounded-xl hover:-translate-y-[1px] transition-transform"
          >
            <Play className="w-4 h-4" strokeWidth={2} />
            <span>See How It Works</span>
          </button>
        </motion.div>
      </section>

      {/* Trust Features — inline compact */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-row items-center justify-center gap-6 lg:gap-12 mt-12 mb-2 shrink-0 relative z-10"
      >
        <TrustFeature icon={LockKeyhole} title={t.session.sidebar.localOnly} description={t.session.sidebar.localOnlyDesc} />
        <div className="hidden md:block w-px h-8 bg-line" />
        <TrustFeature icon={EyeOff} title={t.session.sidebar.readOnly} description={t.session.sidebar.readOnlyDesc} />
        <div className="hidden md:block w-px h-8 bg-line" />
        <TrustFeature icon={Shield} title="No cloud upload" description="Everything stays on your device." />
      </motion.div>

      {/* Dashboard Demo Preview — fills remaining space, clipped at bottom */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[1015px] flex-1 min-h-0 px-4 lg:px-0 mt-20 z-20"
      >
        <DashboardDemo />
      </motion.div>
    </main>
  );
}

function TrustFeature({ icon: Icon, title, description }: { icon: typeof Shield; title: string; description: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex shrink-0 items-center justify-center w-[38px] h-[38px] rounded-full bg-accent-soft text-accent">
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="flex flex-col items-start text-start">
        <span className="text-[15px] font-bold text-ink leading-tight">{title}</span>
        <span className="text-[12.5px] text-ink-secondary mt-0.5">{description}</span>
      </div>
    </div>
  );
}

/** Static dashboard mockup matching the real app's dark-mode appearance */
function DashboardDemo() {
  return (
    <div className="relative">
      {/* Outer app shell — matches DashboardShell's rounded-[28px] container */}
      <div className="flex w-full h-[540px] rounded-[24px] border border-[#333] bg-[#1e1e1e] shadow-[0_25px_65px_rgba(0,0,0,0.35),0_5px_16px_rgba(0,0,0,0.25)] overflow-hidden">

        {/* WorkflowRail (left sidebar) */}
        <div className="hidden sm:flex w-[200px] shrink-0 flex-col border-r border-[#333] bg-[#1e1e1e]">
          {/* Logo */}
          <div className="flex h-14 items-center gap-2 border-b border-[#333] px-4">
            <img src={logoSrc} alt="" className="h-8 w-8 rounded-[8px] object-contain" />
            <span className="text-[14px] font-bold text-[#f0f0f0]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>ChatFrame</span>
          </div>
          {/* Steps */}
          <div className="flex flex-col gap-1 px-3 py-4">
            {[
              { icon: Plug, label: 'Connect', sub: 'Connect WhatsApp', active: true },
              { icon: MessagesSquare, label: 'Choose chat', sub: 'Choose a chat to import', active: false },
              { icon: ShieldCheck, label: 'Quality', sub: 'Review import quality', active: false },
              { icon: Eye, label: 'Preview', sub: 'Preview conversation', active: false },
            ].map((step, i) => (
              <div key={i} className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 ${step.active ? 'bg-[#064e3b] border border-[#065f46]' : ''}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.active ? 'bg-[#34d399] text-[#064e3b] shadow-[0_2px_8px_rgba(52,211,153,0.3)]' : 'bg-[#262626] text-[#7a7a7a]'}`}>
                  <step.icon className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[12px] font-semibold leading-tight ${step.active ? 'text-[#6ee7b7]' : 'text-[#b0b0b0]'}`}>{step.label}</span>
                  <span className="text-[10px] text-[#7a7a7a] mt-0.5">{step.sub}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Bottom privacy */}
          <div className="mt-auto px-3 pb-4">
            <div className="rounded-[12px] border border-[#333] bg-[#262626] p-3">
              <div className="flex items-center gap-2">
                <LockKeyhole className="w-3.5 h-3.5 text-[#34d399] shrink-0" strokeWidth={2.5} />
                <div>
                  <p className="text-[10px] font-semibold text-[#f0f0f0]">Local only</p>
                  <p className="text-[9px] text-[#7a7a7a]">Your data stays on this device.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <EyeOff className="w-3.5 h-3.5 text-[#34d399] shrink-0" strokeWidth={2.5} />
                <div>
                  <p className="text-[10px] font-semibold text-[#f0f0f0]">Read-only</p>
                  <p className="text-[9px] text-[#7a7a7a]">We never modify your data.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* TopBar */}
          <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#333] bg-[#1e1e1e] px-4">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="text-[#7a7a7a]">ChatFrame</span>
              <span className="text-[#7a7a7a]">/</span>
              <span className="font-semibold text-[#f0f0f0]">Workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-0.5 rounded-[10px] border border-[#333] bg-[#262626] p-0.5">
                <span className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold text-[#f0f0f0] bg-[#1e1e1e]">EN</span>
                <span className="rounded-[8px] px-2.5 py-1 text-[11px] font-semibold text-[#7a7a7a]">AR</span>
              </div>
              <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-[#333] text-[#7a7a7a]">
                <Moon className="w-3.5 h-3.5" strokeWidth={2} />
              </div>
              <div className="flex items-center gap-1.5 rounded-[10px] border border-[#065f46] bg-[#064e3b] px-2.5 py-1 text-[11px] font-medium text-[#34d399]">
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
                <span>WhatsApp Connected</span>
              </div>
              <div className="flex items-center gap-1 rounded-[10px] bg-[#34d399] px-3 py-1.5 text-[11px] font-semibold text-white">
                <Plus className="w-3 h-3" strokeWidth={3} />
                <span>New Import</span>
              </div>
            </div>
          </div>

          {/* Content — Connect WhatsApp page */}
          <div className="flex-1 flex items-center justify-center bg-[#121212] p-6">
            <div className="flex flex-col items-center w-full max-w-[360px] bg-[#1e1e1e] rounded-[18px] border border-[#333] p-7">
              <h3 className="text-[18px] font-bold text-[#f0f0f0]">Connect WhatsApp</h3>
              <p className="text-[12px] text-[#7a7a7a] text-center mt-2 max-w-[280px]">Scan the QR code using WhatsApp on your phone to connect your account.</p>
              {/* QR placeholder — realistic pattern */}
              <div className="mt-6 p-3 rounded-xl border border-[#333] bg-[#121212]">
                <svg width="120" height="120" viewBox="0 0 120 120" className="block">
                  {/* Top-left finder */}
                  <rect x="4" y="4" width="28" height="28" rx="3" fill="none" stroke="#f0f0f0" strokeWidth="4"/>
                  <rect x="10" y="10" width="16" height="16" rx="2" fill="#f0f0f0"/>
                  {/* Top-right finder */}
                  <rect x="88" y="4" width="28" height="28" rx="3" fill="none" stroke="#f0f0f0" strokeWidth="4"/>
                  <rect x="94" y="10" width="16" height="16" rx="2" fill="#f0f0f0"/>
                  {/* Bottom-left finder */}
                  <rect x="4" y="88" width="28" height="28" rx="3" fill="none" stroke="#f0f0f0" strokeWidth="4"/>
                  <rect x="10" y="94" width="16" height="16" rx="2" fill="#f0f0f0"/>
                  {/* Data modules */}
                  {[
                    [38,8],[46,8],[54,8],[62,8],[70,8],[78,8],
                    [38,16],[54,16],[70,16],[78,16],
                    [38,24],[46,24],[62,24],[70,24],
                    [8,38],[16,38],[24,38],[38,38],[46,38],[54,38],[62,38],[78,38],[86,38],[94,38],[102,38],[110,38],
                    [8,46],[24,46],[38,46],[62,46],[78,46],[94,46],[110,46],
                    [8,54],[16,54],[24,54],[38,54],[46,54],[54,54],[70,54],[78,54],[86,54],[102,54],[110,54],
                    [8,62],[24,62],[46,62],[54,62],[62,62],[70,62],[86,62],[94,62],[110,62],
                    [8,70],[16,70],[38,70],[54,70],[62,70],[78,70],[86,70],[102,70],[110,70],
                    [8,78],[24,78],[38,78],[46,78],[62,78],[70,78],[78,78],[94,78],[102,78],[110,78],
                    [38,86],[54,86],[62,86],[70,86],[78,86],[86,86],[94,86],[102,86],
                    [38,94],[46,94],[62,94],[78,94],[86,94],[110,94],
                    [38,102],[54,102],[62,102],[70,102],[86,102],[94,102],[102,102],[110,102],
                    [38,110],[46,110],[54,110],[78,110],[94,110],[102,110],[110,110],
                  ].map(([x, y], i) => (
                    <rect key={i} x={x} y={y} width="6" height="6" rx="1" fill="#f0f0f0"/>
                  ))}
                </svg>
              </div>
              <div className="flex items-center gap-1.5 mt-5 text-[11px] text-[#7a7a7a]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7a7a7a]" />
                Waiting for scan
              </div>
              <div className="mt-5 w-full h-[38px] rounded-[10px] bg-[#059669] flex items-center justify-center gap-2 text-white text-[13px] font-semibold">
                <Zap className="w-4 h-4" strokeWidth={2} />
                Connect WhatsApp
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating status cards */}
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex absolute -left-[130px] top-[180px] items-center gap-3 p-4 bg-[#1e1e1e] border border-[#333] rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-w-[200px]"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#059669] text-white">
          <Zap className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-[#f0f0f0]">WhatsApp</span>
          <span className="text-[12px] font-semibold text-[#34d399] mt-0.5">Connected</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
            <span className="text-[10px] text-[#7a7a7a]">Ready to import</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex absolute -right-[125px] top-[60px] items-center gap-3 p-4 bg-[#1e1e1e] border border-[#333] rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-w-[190px]"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#064e3b] text-[#34d399]">
          <MessagesSquare className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-[26px] font-bold text-[#f0f0f0] leading-none">2,431</span>
          <span className="text-[11px] text-[#7a7a7a] mt-1.5">messages imported</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-[10px] text-[#7a7a7a]">Import completed</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="hidden xl:flex absolute -right-[105px] top-[370px] items-center gap-3 p-4 bg-[#1e1e1e] border border-[#333] rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-w-[180px]"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#064e3b] text-[#34d399]">
          <FileCode2 className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-[#f0f0f0]">HTML export</span>
          <span className="text-[12px] font-semibold text-[#34d399] mt-0.5">ready</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-[10px] text-[#7a7a7a]">Ready to download</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
