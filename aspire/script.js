/* ============================================================
   ASPIRE — Financial cognition tool
   React + Tailwind + Framer Motion + Recharts
   In-browser JSX via Babel standalone. Libraries are loaded as
   ESM by index.html and exposed on window; this script destructures
   them inside bootAspire() once the libs-ready signal fires.
   ============================================================ */

function bootAspire() {
  if (!window.__aspireReady) {
    window.addEventListener('aspire-ready', bootAspire, { once: true });
    return;
  }

  const React = window.React;
  const { useState, useEffect, useMemo, useRef } = React;
  const { createRoot } = window.ReactDOMClient;
  const { motion, AnimatePresence, LayoutGroup, useInView } = window.FM;
  const {
    ResponsiveContainer, ComposedChart, Area, Line,
    XAxis, YAxis, CartesianGrid, Tooltip,
  } = window.Recharts;

/* ============ DATA MODEL ============ */
// Illustrative 10-yr annualized rates. Sourced from BLS, Case-Shiller,
// College Board, S&P, Nasdaq, CoinMetrics. Numbers are conceptual, not advice.
const CATEGORIES = {
  // Goals — what you're trying to buy
  home:       { label: 'Home',                rate: 6.5,  kind: 'goal',    glyph: '◇' },
  tuition:    { label: 'Tuition',             rate: 5.0,  kind: 'goal',    glyph: '◇' },
  travel:     { label: 'Travel',              rate: 4.2,  kind: 'goal',    glyph: '◇' },
  retire:     { label: 'Retirement',          rate: 3.3,  kind: 'goal',    glyph: '◇' },
  freedom:    { label: 'Freedom year',        rate: 4.5,  kind: 'goal',    glyph: '◇' },
  car:        { label: 'New car',             rate: 4.0,  kind: 'goal',    glyph: '◇' },
  // Holdings — what you actually own
  cash:       { label: 'Cash · HYSA',         rate: 4.5,  kind: 'holding', glyph: '◆' },
  bonds:      { label: 'Bonds (agg)',         rate: 3.8,  kind: 'holding', glyph: '◆' },
  sp500:      { label: 'S&P 500',             rate: 12.8, kind: 'holding', glyph: '◆' },
  nasdaq:     { label: 'Nasdaq 100',          rate: 20.5, kind: 'holding', glyph: '◆' },
  realestate: { label: 'Real estate',         rate: 6.5,  kind: 'holding', glyph: '◆' },
  btc:        { label: 'Bitcoin',             rate: 64.4, kind: 'holding', glyph: '◆' },
  eth:        { label: 'Ethereum',            rate: 38.0, kind: 'holding', glyph: '◆' },
};
const goalKeys    = Object.keys(CATEGORIES).filter(k => CATEGORIES[k].kind === 'goal');
const holdingKeys = Object.keys(CATEGORIES).filter(k => CATEGORIES[k].kind === 'holding');
const CPI_RATE    = 3.3;

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_GOALS = [
  { id: uid(), category: 'home',    amount: 800000,  years: 5  },
  { id: uid(), category: 'freedom', amount: 80000,   years: 8  },
  { id: uid(), category: 'retire',  amount: 1500000, years: 25 },
];
const DEFAULT_HOLDINGS = [
  { id: uid(), category: 'sp500', amount: 120000 },
  { id: uid(), category: 'cash',  amount: 30000  },
  { id: uid(), category: 'btc',   amount: 15000  },
];

/* ============ FORMATTERS ============ */
const fmtPct = (n, signed = false) => {
  if (!isFinite(n)) return '—';
  const s = n.toFixed(1);
  return signed && n > 0 ? `+${s}%` : `${s}%`;
};
const fmtMoney = (n) => {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}$${(a/1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a/1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a/1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
};
const fmtMoneyShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(a/1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(a/1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(a/1e3)}K`;
  return `$${Math.round(a)}`;
};

/* ============ HOOKS ============ */
// Tween a number value smoothly for animated metric displays
function useTween(value, dur = 600) {
  const [v, setV] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = ref.current;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = from + (value - from) * e;
      ref.current = cur;
      setV(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return v;
}

/* ============ ATOMS ============ */
function Logo({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB458" />
          <stop offset="100%" stopColor="#FF5E62" />
        </linearGradient>
      </defs>
      <path d="M4 24 L16 6 L28 24" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="6" r="2" fill="url(#logoGrad)" />
    </svg>
  );
}

function AnimatedNumber({ value, format = (v) => v.toFixed(1), className = '' }) {
  const v = useTween(value, 700);
  return <span className={`tabular ${className}`}>{format(v)}</span>;
}

function PaneHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <div className="text-micro font-mono text-ink-faint uppercase">{eyebrow}</div>
        <h3 className="font-display text-[22px] leading-tight tracking-tightish text-ink mt-1">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* ============ TOP BAR ============ */
function TopBar({ mode, setMode, aspireRate, portfolioRate }) {
  return (
    <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur-md border-b border-line">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo className="w-[20px] h-[20px]" />
          <span className="font-medium tracking-tightish text-[15px]">Aspire</span>
          <span className="hidden sm:inline-block ml-2 text-micro font-mono text-ink-faint uppercase">
            v0.1 · concept release
          </span>
        </div>

        <ModeToggle mode={mode} setMode={setMode} />

        <div className="hidden md:flex items-center gap-5 text-[12px] font-mono tabular text-ink-mute">
          <span className="flex items-center gap-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-good opacity-50 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-good" />
            </span>
            <span className="uppercase tracking-wider text-[10px]">Live</span>
          </span>
          <span>π<sub className="text-[8px]">p</sub> <span className="text-ink ml-0.5"><AnimatedNumber value={aspireRate} format={(v) => v.toFixed(1) + '%'} /></span></span>
          <span>r<sub className="text-[8px]">p</sub> <span className="text-ink ml-0.5"><AnimatedNumber value={portfolioRate} format={(v) => v.toFixed(1) + '%'} /></span></span>
        </div>
      </div>
    </header>
  );
}

function ModeToggle({ mode, setMode }) {
  return (
    <div role="tablist" aria-label="Mode" className="relative inline-flex items-center bg-paper-dim rounded-full p-0.5 text-[13px] font-medium">
      <motion.div
        layout
        className="absolute top-0.5 bottom-0.5 bg-ink rounded-full"
        initial={false}
        animate={{
          left: mode === 'concept' ? 2 : '50%',
          right: mode === 'concept' ? '50%' : 2,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      />
      {[
        { k: 'concept', label: 'Concept' },
        { k: 'calculator', label: 'Calculator' },
      ].map(({ k, label }) => (
        <button
          key={k}
          role="tab"
          aria-selected={mode === k}
          onClick={() => setMode(k)}
          className={`relative z-10 px-4 sm:px-5 py-1.5 rounded-full transition-colors duration-200 ${
            mode === k ? 'text-paper' : 'text-ink-mute hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ============ CONCEPT MODE ============ */
function ConceptMode({ onLaunch }) {
  return (
    <div className="bg-paper">
      <ConceptHero />
      <ConceptSceneOne />
      <ConceptSceneTwo />
      <ConceptSceneThree />
      <ConceptSceneFour />
      <ConceptLaunch onLaunch={onLaunch} />
    </div>
  );
}

function ConceptHero() {
  return (
    <section className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-20 sm:py-32 lg:py-40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl"
      >
        <div className="text-micro font-mono text-ink-faint uppercase mb-6">
          A framework, in five scenes
        </div>
        <h1 className="font-display text-[44px] sm:text-[64px] lg:text-[88px] leading-[0.96] tracking-tighter2 text-ink">
          Inflation isn't a number.<br />
          <span className="italic gradient-text">It's a vector.</span>
        </h1>
        <p className="mt-8 text-[17px] sm:text-[19px] leading-relaxed text-ink-mute max-w-xl">
          What follows is the thesis behind Aspire — not a pitch. Read it through.
          The instrument is on the next tab.
        </p>
        <div className="mt-12 flex items-center gap-3 text-micro font-mono text-ink-faint uppercase">
          <span>Scroll</span>
          <span className="block w-8 h-px bg-ink-faint" />
        </div>
      </motion.div>
    </section>
  );
}

/* Scene 1: One number → many numbers */
function ConceptSceneOne() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-30% 0px -30% 0px' });
  return (
    <section ref={ref} className="border-t border-line">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-36 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="text-micro font-mono text-ink-faint uppercase mb-5">Scene 01</div>
          <h2 className="font-display text-[36px] sm:text-[48px] leading-[1.04] tracking-tighter2 text-ink">
            One headline number.<br />A thousand actual ones.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-ink-mute max-w-md">
            CPI is a single national average. It doesn't describe anyone in particular.
            The closer you look, the less it looks like you.
          </p>
        </div>
        <div className="lg:col-span-7">
          <ShatterVisual active={inView} />
        </div>
      </div>
    </section>
  );
}

function ShatterVisual({ active }) {
  // CPI label that "shatters" into the underlying components
  const items = [
    { label: 'Used cars',     rate: -0.4, x:  120, y: -40 },
    { label: 'Gasoline',      rate:  2.1, x:  220, y:  20 },
    { label: 'Housing rent',  rate:  4.2, x: -160, y: -60 },
    { label: 'Tuition',       rate:  5.0, x:  180, y:  90 },
    { label: 'Home price',    rate:  6.5, x: -200, y:  80 },
    { label: 'Equities',      rate: 12.8, x:  -80, y: 130 },
    { label: 'Bitcoin',       rate: 64.4, x:   60, y: -120 },
  ];
  return (
    <div className="relative aspect-[4/3] surface overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-paper-dim/30 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="font-mono text-[12px] tracking-widest uppercase text-ink-faint absolute top-5 left-5"
        >
          CPI · 3.3% YoY
        </motion.div>

        <motion.div
          initial={false}
          animate={{ scale: active ? 0.85 : 1, opacity: active ? 0.18 : 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[100px] sm:text-[140px] leading-none tracking-tighter2 text-ink"
        >
          3.3<span className="text-ink-faint">%</span>
        </motion.div>

        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={active
              ? { x: it.x, y: it.y, opacity: 1, scale: 1 }
              : { x: 0, y: 0, opacity: 0, scale: 0.6 }
            }
            transition={{
              duration: 1.1,
              delay: 0.15 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute font-mono text-[11px] sm:text-[12px] px-2.5 py-1.5 rounded-full bg-white border border-line shadow-sm whitespace-nowrap"
          >
            <span className="text-ink-mute">{it.label}</span>
            <span className="ml-2 text-ink tabular">{it.rate > 0 ? '+' : ''}{it.rate.toFixed(1)}%</span>
          </motion.div>
        ))}
      </div>

      <div className="absolute bottom-4 right-5 text-[10px] font-mono text-ink-faint uppercase tracking-wider">
        BLS · 10y annualized
      </div>
    </div>
  );
}

/* Scene 2: CPI basket vs your basket */
function ConceptSceneTwo() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-30% 0px -30% 0px' });

  const cpiBasket = [
    { label: 'Housing',       weight: 33 },
    { label: 'Transportation', weight: 17 },
    { label: 'Food',          weight: 14 },
    { label: 'Medical',       weight: 8  },
    { label: 'Recreation',    weight: 6  },
    { label: 'Other',         weight: 22 },
  ];
  const yourBasket = [
    { label: 'Home',     weight: 38, rate: 6.5 },
    { label: 'Equity',   weight: 30, rate: 12.8 },
    { label: 'Tuition',  weight: 14, rate: 5.0 },
    { label: 'Freedom',  weight: 12, rate: 4.5 },
    { label: 'Bitcoin',  weight: 6,  rate: 64.4 },
  ];

  return (
    <section ref={ref} className="border-t border-line bg-paper-dim/40">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-36 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5 lg:order-2">
          <div className="text-micro font-mono text-ink-faint uppercase mb-5">Scene 02</div>
          <h2 className="font-display text-[36px] sm:text-[48px] leading-[1.04] tracking-tighter2 text-ink">
            The basket in the report<br />is not your basket.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-ink-mute max-w-md">
            CPI weights the spending of the median American household. If your future
            looks like equity, real estate, education, or freedom — your weights are
            elsewhere. So is your inflation.
          </p>
        </div>
        <div className="lg:col-span-7 lg:order-1">
          <BasketCompare cpi={cpiBasket} yours={yourBasket} active={inView} />
        </div>
      </div>
    </section>
  );
}

function BasketCompare({ cpi, yours, active }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6">
      <BasketCard
        label="CPI Basket"
        sub="Median U.S. household"
        items={cpi}
        active={active}
        muted
      />
      <BasketCard
        label="Your Basket"
        sub="The future you're buying"
        items={yours}
        active={active}
      />
    </div>
  );
}

function BasketCard({ label, sub, items, active, muted = false }) {
  return (
    <div className={`surface p-5 sm:p-6 ${muted ? 'opacity-90' : ''}`}>
      <div className="text-micro font-mono text-ink-faint uppercase">{label}</div>
      <div className="text-[13px] text-ink-mute mt-0.5 mb-5">{sub}</div>
      <div className="space-y-3">
        {items.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 6 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-baseline justify-between text-[13px] font-medium">
              <span className="text-ink">{it.label}</span>
              <span className="font-mono text-ink-mute tabular">
                {it.weight}%{it.rate != null && <span className="ml-2 text-ink">{it.rate.toFixed(1)}%</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1 bg-paper-dim rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: active ? `${it.weight * 2.6}%` : 0 }}
                transition={{ duration: 1.0, delay: 0.2 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={muted ? 'h-full bg-ink-faint' : 'h-full bg-gradient-to-r from-accent-2 to-accent-1'}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* Scene 3: Inflation as vector */
function ConceptSceneThree() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-30% 0px -30% 0px' });

  return (
    <section ref={ref} className="border-t border-line">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-36 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="text-micro font-mono text-ink-faint uppercase mb-5">Scene 03</div>
          <h2 className="font-display text-[36px] sm:text-[48px] leading-[1.04] tracking-tighter2 text-ink">
            A scalar tells you<br />
            <span className="italic">how much</span>.<br />
            A vector tells you<br />
            <span className="italic gradient-text">where</span>.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-ink-mute max-w-md">
            Your personal inflation rate is the resultant of every future you're
            funding — each pulling at its own magnitude, in its own direction.
          </p>
          <div className="mt-8 surface-dim px-4 py-3 inline-flex items-center gap-3 font-mono text-[12px] text-ink-mute">
            <span>π<sub className="text-[9px]">p</sub></span>
            <span className="text-ink-faint">=</span>
            <span>Σ (w<sub className="text-[9px]">i</sub> · r<sub className="text-[9px]">i</sub>)</span>
          </div>
        </div>
        <div className="lg:col-span-7">
          <VectorDiagram active={inView} />
        </div>
      </div>
    </section>
  );
}

function VectorDiagram({ active }) {
  const arrows = [
    { label: 'Bitcoin',  angle: -75, mag: 0.95, rate: 64.4 },
    { label: 'Equity',   angle: -25, mag: 0.70, rate: 12.8 },
    { label: 'Home',     angle:  25, mag: 0.55, rate: 6.5 },
    { label: 'Tuition',  angle:  85, mag: 0.40, rate: 5.0 },
    { label: 'Travel',   angle: 145, mag: 0.32, rate: 4.2 },
    { label: 'CPI',      angle:-160, mag: 0.25, rate: 3.3, dim: true },
  ];

  // compute resultant (sum of vectors)
  const cx = 50, cy = 50;
  let rx = 0, ry = 0;
  arrows.filter(a => !a.dim).forEach(a => {
    const rad = (a.angle * Math.PI) / 180;
    rx += Math.cos(rad) * a.mag * 0.5;
    ry += Math.sin(rad) * a.mag * 0.5;
  });

  return (
    <div className="relative aspect-[4/3] surface overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-paper-dim/40 to-transparent" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="vGlow" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="#FFB458" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FF5E62" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="vArrow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFB458" />
            <stop offset="100%" stopColor="#FF5E62" />
          </linearGradient>
          <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#FF5E62" />
          </marker>
          <marker id="arrowEndDim" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#9D9DA6" />
          </marker>
          <marker id="arrowEndResult" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#0F0F12" />
          </marker>
        </defs>

        <circle cx={cx} cy={cy} r="32" fill="url(#vGlow)" />

        {/* radial guides */}
        {[10, 20, 30].map(r => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="#0F0F12" strokeOpacity="0.04" />
        ))}

        {/* component vectors */}
        {arrows.map((a, i) => {
          const rad = (a.angle * Math.PI) / 180;
          const x2 = cx + Math.cos(rad) * a.mag * 30;
          const y2 = cy + Math.sin(rad) * a.mag * 30;
          const lx = cx + Math.cos(rad) * (a.mag * 30 + 6);
          const ly = cy + Math.sin(rad) * (a.mag * 30 + 6);
          return (
            <g key={a.label}>
              <motion.line
                x1={cx} y1={cy}
                initial={{ x2: cx, y2: cy, opacity: 0 }}
                animate={active ? { x2, y2, opacity: 1 } : { x2: cx, y2: cy, opacity: 0 }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                stroke={a.dim ? '#9D9DA6' : 'url(#vArrow)'}
                strokeWidth="0.7"
                strokeLinecap="round"
                markerEnd={a.dim ? 'url(#arrowEndDim)' : 'url(#arrowEnd)'}
              />
              <motion.text
                x={lx} y={ly}
                initial={{ opacity: 0 }}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
                fontSize="2.6"
                fontFamily="Inter, sans-serif"
                fontWeight={a.dim ? 400 : 500}
                fill={a.dim ? '#9D9DA6' : '#0F0F12'}
                textAnchor={Math.cos(rad) > 0.3 ? 'start' : Math.cos(rad) < -0.3 ? 'end' : 'middle'}
                dominantBaseline="middle"
              >
                {a.label} · {a.rate.toFixed(1)}%
              </motion.text>
            </g>
          );
        })}

        {/* resultant */}
        <motion.line
          x1={cx} y1={cy}
          initial={{ x2: cx, y2: cy, opacity: 0 }}
          animate={active ? { x2: cx + rx * 30, y2: cy + ry * 30, opacity: 1 } : { x2: cx, y2: cy, opacity: 0 }}
          transition={{ duration: 1.1, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
          stroke="#0F0F12" strokeWidth="1.4" strokeLinecap="round" markerEnd="url(#arrowEndResult)"
        />

        <circle cx={cx} cy={cy} r="1" fill="#0F0F12" />
      </svg>
      <div className="absolute top-4 left-5 text-[10px] font-mono text-ink-faint uppercase tracking-wider">
        Personal inflation · vector field
      </div>
      <div className="absolute bottom-4 right-5 text-[10px] font-mono text-ink-faint uppercase tracking-wider">
        Resultant = π<sub>p</sub>
      </div>
    </div>
  );
}

/* Scene 4: The Aspire Gap */
function ConceptSceneFour() {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-30% 0px -30% 0px' });
  // Two compounding curves over 20 yrs
  const data = useMemo(() => {
    const out = [];
    for (let y = 0; y <= 20; y++) {
      out.push({
        y,
        goal: 1 * Math.pow(1.085, y),       // ~8.5% personal inflation
        port: 1 * Math.pow(1.062, y),       // ~6.2% portfolio rate
      });
    }
    return out;
  }, []);

  return (
    <section ref={ref} className="border-t border-line bg-ink text-paper">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-36 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="text-micro font-mono text-paper/40 uppercase mb-5">Scene 04</div>
          <h2 className="font-display text-[36px] sm:text-[48px] leading-[1.04] tracking-tighter2 text-paper">
            Two curves.<br />
            One <span className="italic gradient-text">silent gap</span>.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-paper/70 max-w-md">
            When the things you want compound faster than the things you own,
            you don't stand still. You fall behind — quietly, every year.
            That gap is what Aspire measures.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm">
            <div className="border border-paper/10 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-paper/40">Goal cost @ y=20</div>
              <div className="font-display text-[22px] mt-1 tabular gradient-text">5.11×</div>
            </div>
            <div className="border border-paper/10 rounded-xl p-3.5">
              <div className="text-[10px] font-mono uppercase text-paper/40">Portfolio @ y=20</div>
              <div className="font-display text-[22px] mt-1 tabular text-cool" style={{ color: '#79B6FF' }}>3.34×</div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-7">
          <GapChart data={data} active={inView} />
        </div>
      </div>
    </section>
  );
}

function GapChart({ data, active }) {
  return (
    <div className="surface bg-ink border-paper/10 p-5 sm:p-6 h-[340px] sm:h-[420px]">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-micro font-mono text-paper/40 uppercase">Compounding · 20y</div>
        <div className="flex gap-4 text-[11px] font-mono text-paper/60">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gradient-to-br from-accent-2 to-accent-1" />Goal cost</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#79B6FF' }} />Portfolio</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="goalArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF5E62" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FF5E62" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="portArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#79B6FF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#79B6FF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="y" tickFormatter={(v) => `+${v}y`} stroke="rgba(255,255,255,0.3)" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => `${v.toFixed(1)}×`} stroke="rgba(255,255,255,0.3)" tickLine={false} axisLine={false} width={42} />
          <Tooltip
            formatter={(v, n) => [`${(+v).toFixed(2)}×`, n === 'goal' ? 'Goal cost' : 'Portfolio']}
            labelFormatter={(l) => `Year +${l}`}
          />
          <Area type="monotone" dataKey="goal" stroke="none" fill="url(#goalArea)" isAnimationActive={active} animationDuration={1200} />
          <Area type="monotone" dataKey="port" stroke="none" fill="url(#portArea)" isAnimationActive={active} animationDuration={1200} />
          <Line type="monotone" dataKey="goal" dot={false} stroke="#FF5E62" strokeWidth={2} isAnimationActive={active} animationDuration={1400} />
          <Line type="monotone" dataKey="port" dot={false} stroke="#79B6FF" strokeWidth={2} isAnimationActive={active} animationDuration={1400} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Scene 5: Launch */
function ConceptLaunch({ onLaunch }) {
  return (
    <section className="border-t border-line">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-24 sm:py-36 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-20% 0px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-micro font-mono text-ink-faint uppercase mb-5">Scene 05</div>
          <h2 className="font-display text-[40px] sm:text-[56px] leading-[1.04] tracking-tighter2 text-ink max-w-2xl mx-auto">
            Now: measure your own.
          </h2>
          <p className="mt-6 text-[17px] text-ink-mute max-w-lg mx-auto">
            Define your basket. Map your portfolio. Watch the gap close — or open — in real time.
          </p>
          <button
            onClick={onLaunch}
            className="mt-10 inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-ink text-paper hover:bg-black transition-colors text-[15px] font-medium"
          >
            Open the calculator
            <span className="text-[18px] leading-none">→</span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}

/* ============ CALCULATOR MODE ============ */
function CalculatorMode({ goals, setGoals, holdings, setHoldings, aspireRate, portfolioRate, aspireGap }) {
  const totalHold = holdings.reduce((s, h) => s + h.amount, 0);
  const totalGoal = goals.reduce((s, g) => s + g.amount, 0);

  return (
    <div className="bg-paper">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        {/* Sub-bar with run state */}
        <div className="flex items-center justify-between gap-4 mb-5 text-[11px] font-mono text-ink-faint uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span>Workspace</span>
            <span className="text-line-strong">/</span>
            <span className="text-ink">Personal model</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>{goals.length} goals</span>
            <span>{holdings.length} holdings</span>
            <span>Net basket {fmtMoney(totalGoal)}</span>
            <span>Net portfolio {fmtMoney(totalHold)}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 lg:gap-5">
          {/* Left column: inputs */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-4 lg:gap-5">
            <BasketPane goals={goals} setGoals={setGoals} aspireRate={aspireRate} totalGoal={totalGoal} />
            <PortfolioPane holdings={holdings} setHoldings={setHoldings} portfolioRate={portfolioRate} totalHold={totalHold} />
          </div>

          {/* Right column: outputs */}
          <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col gap-4 lg:gap-5">
            <MetricsPane aspireRate={aspireRate} portfolioRate={portfolioRate} aspireGap={aspireGap} />
            <ChartPane goals={goals} totalHold={totalHold} portfolioRate={portfolioRate} />
            <CoveragePane goals={goals} holdings={holdings} portfolioRate={portfolioRate} totalGoal={totalGoal} totalHold={totalHold} />
          </div>
        </div>

        <div className="mt-8 text-[11px] font-mono text-ink-faint uppercase tracking-wider leading-relaxed max-w-3xl">
          Methodology · Aspire Rate (π<sub>p</sub>) is the basket-weighted mean of category inflation rates.
          Portfolio Rate (r<sub>p</sub>) is the holding-weighted mean of asset return rates.
          Coverage projects current holdings forward at r<sub>p</sub> against goal cost compounded at the goal's category rate.
          Rates are illustrative 10y annualized historicals.
        </div>
      </div>
    </div>
  );
}

/* Basket pane */
function BasketPane({ goals, setGoals, aspireRate, totalGoal }) {
  const addGoal = () => setGoals([...goals, { id: uid(), category: 'home', amount: 100000, years: 10 }]);
  const updateGoal = (id, patch) => setGoals(goals.map(g => g.id === id ? { ...g, ...patch } : g));
  const removeGoal = (id) => setGoals(goals.filter(g => g.id !== id));

  return (
    <div className="surface p-5 sm:p-6">
      <PaneHeader
        eyebrow="01 · Basket"
        title="Goals you're trying to buy"
        action={
          <button onClick={addGoal} className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-paper-dim hover:bg-paper-deep transition-colors">
            + Add goal
          </button>
        }
      />
      <div className="surface-dim px-3.5 py-2.5 mb-3 flex items-center justify-between text-[12px] font-mono text-ink-mute">
        <span>π<sub className="text-[9px]">p</sub> · Aspire rate</span>
        <span className="text-ink text-[14px] tabular"><AnimatedNumber value={aspireRate} format={(v) => v.toFixed(2) + '%'} /></span>
      </div>

      <LayoutGroup>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {goals.map(g => {
              const cat = CATEGORIES[g.category];
              const weight = totalGoal > 0 ? (g.amount / totalGoal) * 100 : 0;
              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <Row
                    glyph="◇"
                    category={g.category}
                    options={goalKeys}
                    rate={cat.rate}
                    weight={weight}
                    onCategoryChange={(v) => updateGoal(g.id, { category: v })}
                    onRemove={() => removeGoal(g.id)}
                    fields={[
                      { label: 'Today\'s cost', value: g.amount, prefix: '$', step: 1000, onChange: (v) => updateGoal(g.id, { amount: v }) },
                      { label: 'Horizon', value: g.years, suffix: 'y', step: 1, max: 60, onChange: (v) => updateGoal(g.id, { years: Math.max(1, v) }) },
                    ]}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  );
}

/* Portfolio pane */
function PortfolioPane({ holdings, setHoldings, portfolioRate, totalHold }) {
  const addHolding = () => setHoldings([...holdings, { id: uid(), category: 'cash', amount: 10000 }]);
  const updateHolding = (id, patch) => setHoldings(holdings.map(h => h.id === id ? { ...h, ...patch } : h));
  const removeHolding = (id) => setHoldings(holdings.filter(h => h.id !== id));

  return (
    <div className="surface p-5 sm:p-6">
      <PaneHeader
        eyebrow="02 · Portfolio"
        title="What you actually hold"
        action={
          <button onClick={addHolding} className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-paper-dim hover:bg-paper-deep transition-colors">
            + Add holding
          </button>
        }
      />
      <div className="surface-dim px-3.5 py-2.5 mb-3 flex items-center justify-between text-[12px] font-mono text-ink-mute">
        <span>r<sub className="text-[9px]">p</sub> · Portfolio rate</span>
        <span className="text-ink text-[14px] tabular"><AnimatedNumber value={portfolioRate} format={(v) => v.toFixed(2) + '%'} /></span>
      </div>

      <LayoutGroup>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {holdings.map(h => {
              const cat = CATEGORIES[h.category];
              const weight = totalHold > 0 ? (h.amount / totalHold) * 100 : 0;
              return (
                <motion.div
                  key={h.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <Row
                    glyph="◆"
                    category={h.category}
                    options={holdingKeys}
                    rate={cat.rate}
                    weight={weight}
                    onCategoryChange={(v) => updateHolding(h.id, { category: v })}
                    onRemove={() => removeHolding(h.id)}
                    fields={[
                      { label: 'Amount', value: h.amount, prefix: '$', step: 1000, onChange: (v) => updateHolding(h.id, { amount: v }) },
                    ]}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </div>
  );
}

/* Generic editable row used in both panes */
function Row({ glyph, category, options, rate, weight, onCategoryChange, onRemove, fields }) {
  return (
    <div className="surface-dim p-3 sm:p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[14px] text-ink-faint w-3 inline-block">{glyph}</span>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="flex-1 bg-transparent text-[13px] font-medium text-ink outline-none cursor-pointer pr-2"
        >
          {options.map(k => (
            <option key={k} value={k}>{CATEGORIES[k].label} · {CATEGORIES[k].rate}%</option>
          ))}
        </select>
        <span className="font-mono text-[11px] text-ink-faint tabular whitespace-nowrap">
          {weight.toFixed(0)}% · {rate.toFixed(1)}%
        </span>
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="w-6 h-6 grid place-items-center rounded-full text-ink-faint hover:bg-bad/10 hover:text-bad transition-colors text-[14px]"
        >×</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {fields.map((f, i) => (
          <NumberField key={i} {...f} />
        ))}
        {fields.length === 1 && <div />}
      </div>

      <div className="mt-2 h-[3px] bg-white rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-accent-2 to-accent-1"
          initial={false}
          animate={{ width: `${Math.min(100, weight)}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix, suffix, step, max }) {
  return (
    <label className="block">
      <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider mb-0.5 px-1">{label}</div>
      <div className="flex items-center bg-white rounded-lg border border-line px-2.5 h-9">
        {prefix && <span className="text-ink-faint text-[13px] mr-1">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          max={max}
          min={0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isFinite(v) ? Math.max(0, v) : 0);
          }}
          className="flex-1 min-w-0 bg-transparent text-[14px] text-ink outline-none tabular"
        />
        {suffix && <span className="text-ink-faint text-[13px] ml-1">{suffix}</span>}
      </div>
    </label>
  );
}

/* Metrics pane — three big numbers */
function MetricsPane({ aspireRate, portfolioRate, aspireGap }) {
  const gapTone = aspireGap >= 0 ? 'text-good' : 'text-bad';
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      <Metric eyebrow="π · Aspire" label="Personal inflation" value={aspireRate} format={(v) => v.toFixed(2) + '%'} accent />
      <Metric eyebrow="r · Portfolio" label="Expected return" value={portfolioRate} format={(v) => v.toFixed(2) + '%'} cool />
      <Metric eyebrow="Δ · Aspire Gap" label={aspireGap >= 0 ? 'Outpacing' : 'Falling behind'} value={aspireGap} format={(v) => (v > 0 ? '+' : '') + v.toFixed(2) + '%'} className={gapTone} />
    </div>
  );
}

function Metric({ eyebrow, label, value, format, accent, cool, className = '' }) {
  return (
    <motion.div
      layout
      className={`surface p-4 sm:p-5 lg:p-6 relative overflow-hidden ${accent ? 'bg-ink text-paper border-ink' : ''}`}
    >
      <div className={`text-[10px] font-mono uppercase tracking-wider ${accent ? 'text-paper/40' : 'text-ink-faint'}`}>{eyebrow}</div>
      <div className={`font-display text-[34px] sm:text-[44px] lg:text-[56px] leading-none tracking-tighter2 mt-2 tabular ${
        accent ? 'gradient-text' : cool ? 'text-cool' : className || 'text-ink'
      }`}>
        <AnimatedNumber value={value} format={format} />
      </div>
      <div className={`text-[12px] mt-2 ${accent ? 'text-paper/60' : 'text-ink-mute'}`}>{label}</div>
      {accent && <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-accent-2/15 via-transparent to-accent-1/10" />}
    </motion.div>
  );
}

/* Future buying power chart */
function ChartPane({ goals, totalHold, portfolioRate }) {
  // Project the largest goal over its horizon
  const refGoal = useMemo(() => goals.reduce((m, g) => (!m || g.amount > m.amount) ? g : m, null), [goals]);
  const data = useMemo(() => {
    if (!refGoal) return [];
    const years = Math.max(5, Math.min(30, refGoal.years || 10));
    const goalRate = CATEGORIES[refGoal.category].rate / 100;
    const portRate = portfolioRate / 100;
    const startMoney = totalHold > 0 ? totalHold : refGoal.amount * 0.4;
    const out = [];
    for (let y = 0; y <= years; y++) {
      out.push({
        y,
        cost: refGoal.amount * Math.pow(1 + goalRate, y),
        port: startMoney * Math.pow(1 + portRate, y),
      });
    }
    return out;
  }, [refGoal, totalHold, portfolioRate]);

  if (!refGoal) {
    return (
      <div className="surface p-5 sm:p-6 h-[260px] grid place-items-center">
        <div className="text-ink-mute text-[14px]">Add a goal to project your buying power.</div>
      </div>
    );
  }

  const goalEnd = data[data.length - 1].cost;
  const portEnd = data[data.length - 1].port;
  const ratio = portEnd / goalEnd;

  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <div>
          <div className="text-micro font-mono text-ink-faint uppercase">Future buying power · {data.length - 1}y</div>
          <h3 className="font-display text-[22px] leading-tight tracking-tightish text-ink mt-1">
            {CATEGORIES[refGoal.category].label} · {fmtMoney(refGoal.amount)} today
          </h3>
        </div>
        <div className="flex gap-4 text-[11px] font-mono text-ink-mute">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gradient-to-br from-accent-2 to-accent-1" />Goal cost</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cool" />Portfolio</span>
        </div>
      </div>

      <div className="h-[280px] sm:h-[320px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5E62" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#FF5E62" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="portFillCalc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2C5DDB" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#2C5DDB" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(15,15,18,0.05)" vertical={false} />
            <XAxis dataKey="y" tickFormatter={(v) => `+${v}y`} stroke="rgba(15,15,18,0.3)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={(v) => fmtMoneyShort(v)} stroke="rgba(15,15,18,0.3)" tickLine={false} axisLine={false} fontSize={11} width={56} />
            <Tooltip
              formatter={(v, n) => [fmtMoney(+v), n === 'cost' ? 'Goal cost' : 'Portfolio']}
              labelFormatter={(l) => `Year +${l}`}
            />
            <Area type="monotone" dataKey="cost" stroke="none" fill="url(#costFill)" />
            <Area type="monotone" dataKey="port" stroke="none" fill="url(#portFillCalc)" />
            <Line type="monotone" dataKey="cost" dot={false} stroke="#FF5E62" strokeWidth={2} animationDuration={800} />
            <Line type="monotone" dataKey="port" dot={false} stroke="#2C5DDB" strokeWidth={2} animationDuration={800} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
        <div className="surface-dim px-3 py-2.5">
          <div className="text-[10px] font-mono uppercase text-ink-faint tracking-wider">Goal @ +{data.length - 1}y</div>
          <div className="font-display text-[20px] mt-0.5 text-ink tabular">{fmtMoney(goalEnd)}</div>
        </div>
        <div className="surface-dim px-3 py-2.5">
          <div className="text-[10px] font-mono uppercase text-ink-faint tracking-wider">Portfolio @ +{data.length - 1}y</div>
          <div className="font-display text-[20px] mt-0.5 text-cool tabular">{fmtMoney(portEnd)}</div>
        </div>
        <div className="surface-dim px-3 py-2.5">
          <div className="text-[10px] font-mono uppercase text-ink-faint tracking-wider">Coverage</div>
          <div className={`font-display text-[20px] mt-0.5 tabular ${ratio >= 1 ? 'text-good' : ratio >= 0.7 ? 'text-ink' : 'text-bad'}`}>
            {(ratio * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

/* Per-goal coverage pane */
function CoveragePane({ goals, holdings, portfolioRate, totalGoal, totalHold }) {
  if (!goals.length || !holdings.length || totalGoal <= 0 || totalHold <= 0) {
    return (
      <div className="surface p-5 sm:p-6">
        <PaneHeader eyebrow="03 · Coverage" title="Per-goal projection" />
        <div className="text-ink-mute text-[14px]">Add at least one goal and one holding.</div>
      </div>
    );
  }

  const rows = goals.map(g => {
    const cat = CATEGORIES[g.category];
    const futureCost = g.amount * Math.pow(1 + cat.rate / 100, g.years);
    const allocation = totalHold * (g.amount / totalGoal);
    const futureMoney = allocation * Math.pow(1 + portfolioRate / 100, g.years);
    const cov = (futureMoney / futureCost) * 100;
    return { id: g.id, goal: g, cat, futureCost, futureMoney, cov };
  });

  return (
    <div className="surface p-5 sm:p-6">
      <PaneHeader eyebrow="03 · Coverage" title="Per-goal projection" />
      <div className="grid grid-cols-12 gap-2 text-micro font-mono uppercase text-ink-faint border-b border-line pb-2 mb-2">
        <div className="col-span-3">Goal</div>
        <div className="col-span-1 text-right">Yrs</div>
        <div className="col-span-3 text-right">Need</div>
        <div className="col-span-3 text-right">Have</div>
        <div className="col-span-2 text-right">Cov.</div>
      </div>
      <LayoutGroup>
        <div className="space-y-1.5">
          {rows.map(r => {
            const tone = r.cov >= 100 ? 'text-good' : r.cov >= 70 ? 'text-ink' : 'text-bad';
            const fillPct = Math.max(0, Math.min(100, r.cov));
            return (
              <motion.div
                layout
                key={r.id}
                className="grid grid-cols-12 gap-2 items-center py-2 px-1 text-[13px] border-b border-line/60 last:border-0"
              >
                <div className="col-span-3 flex items-center gap-2 truncate">
                  <span className="font-mono text-ink-faint">◇</span>
                  <span className="font-medium text-ink truncate">{r.cat.label}</span>
                </div>
                <div className="col-span-1 text-right text-ink-mute font-mono tabular">{r.goal.years}y</div>
                <div className="col-span-3 text-right tabular">{fmtMoney(r.futureCost)}</div>
                <div className="col-span-3 text-right tabular text-cool">{fmtMoney(r.futureMoney)}</div>
                <div className={`col-span-2 text-right font-display text-[18px] tabular ${tone}`}>
                  <AnimatedNumber value={r.cov} format={(v) => Math.round(v) + '%'} />
                </div>
                <div className="col-span-12 mt-1 h-[3px] bg-paper-dim rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${r.cov >= 100 ? 'bg-good' : 'bg-gradient-to-r from-accent-2 to-accent-1'}`}
                    initial={false}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="max-w-shell mx-auto px-4 sm:px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12px] text-ink-mute">
        <div className="flex items-center gap-2.5">
          <Logo className="w-4 h-4" />
          <span className="font-medium text-ink">Aspire</span>
          <span className="text-ink-faint">·</span>
          <span>Inflation isn't a number. It's a vector.</span>
        </div>
        <div className="text-ink-faint font-mono text-[11px] uppercase tracking-wider">
          Framework · not advice · v0.1
        </div>
      </div>
    </footer>
  );
}

/* ============ APP ============ */
function App() {
  const [mode, setMode] = useState('concept');
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [holdings, setHoldings] = useState(DEFAULT_HOLDINGS);

  const totalGoal = goals.reduce((s, g) => s + (g.amount || 0), 0);
  const totalHold = holdings.reduce((s, h) => s + (h.amount || 0), 0);

  const aspireRate = totalGoal > 0
    ? goals.reduce((s, g) => s + (g.amount || 0) * CATEGORIES[g.category].rate, 0) / totalGoal
    : 0;
  const portfolioRate = totalHold > 0
    ? holdings.reduce((s, h) => s + (h.amount || 0) * CATEGORIES[h.category].rate, 0) / totalHold
    : 0;
  const aspireGap = portfolioRate - aspireRate;

  // Remove boot screen on first paint
  useEffect(() => {
    const boot = document.querySelector('.boot-screen');
    if (boot) {
      boot.classList.add('gone');
      setTimeout(() => boot.remove(), 500);
    }
  }, []);

  // Cross-fade mode transitions
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar mode={mode} setMode={setMode} aspireRate={aspireRate} portfolioRate={portfolioRate} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {mode === 'concept' ? (
              <ConceptMode onLaunch={() => setMode('calculator')} />
            ) : (
              <CalculatorMode
                goals={goals} setGoals={setGoals}
                holdings={holdings} setHoldings={setHoldings}
                aspireRate={aspireRate} portfolioRate={portfolioRate} aspireGap={aspireGap}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

  try {
    createRoot(document.getElementById('root')).render(<App />);
  } catch (err) {
    console.error('[aspire] mount failed', err);
    const status = document.querySelector('.boot-status');
    if (status) status.textContent = 'Mount failed · ' + (err?.message || err);
  }
} // end bootAspire

bootAspire();
