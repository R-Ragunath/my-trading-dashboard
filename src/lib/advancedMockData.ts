// Advanced mock data for Straddle Charts, IV Surface, FII/DII, OI Spurts, Watchlist

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ── Straddle/Strangle Charts ──

export interface StraddlePremiumPoint {
  time: string;
  straddlePremium: number;
  stranglePremium: number;
  spotPrice: number;
  cePrice: number;
  pePrice: number;
  iv: number;
}

export function generateStraddleIntraday(spotBase: number, ceBase: number, peBase: number): StraddlePremiumPoint[] {
  const rand = seededRandom(Math.round(spotBase * 11));
  const points: StraddlePremiumPoint[] = [];
  let spot = spotBase, ce = ceBase, pe = peBase, iv = 13.5;
  const strangleCE = ceBase * 0.4, stranglePE = peBase * 0.35;
  let sce = strangleCE, spe = stranglePE;

  for (let h = 9; h <= 15; h++) {
    for (let m = h === 9 ? 15 : 0; m < 60; m += 5) {
      if (h === 15 && m > 30) break;
      const move = (rand() - 0.48) * spotBase * 0.001;
      spot += move;
      ce += (rand() - 0.52) * ceBase * 0.015;
      pe += (rand() - 0.48) * peBase * 0.015;
      sce += (rand() - 0.52) * strangleCE * 0.02;
      spe += (rand() - 0.48) * stranglePE * 0.02;
      iv += (rand() - 0.5) * 0.15;
      ce = Math.max(1, ce); pe = Math.max(1, pe);
      sce = Math.max(0.5, sce); spe = Math.max(0.5, spe);
      points.push({
        time: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
        straddlePremium: Math.round((ce + pe) * 100) / 100,
        stranglePremium: Math.round((sce + spe) * 100) / 100,
        spotPrice: Math.round(spot * 100) / 100,
        cePrice: Math.round(ce * 100) / 100,
        pePrice: Math.round(pe * 100) / 100,
        iv: Math.round(iv * 100) / 100,
      });
    }
  }
  return points;
}

export function generateStraddleHistory(spotBase: number): { date: string; premium: number; premiumDecay: number; spot: number }[] {
  const rand = seededRandom(Math.round(spotBase * 3));
  const points: { date: string; premium: number; premiumDecay: number; spot: number }[] = [];
  let premium = spotBase * 0.025;
  let spot = spotBase * 0.98;
  for (let d = 30; d >= 0; d--) {
    premium *= (1 - 0.03 + (rand() - 0.5) * 0.04);
    premium = Math.max(spotBase * 0.002, premium);
    spot += (rand() - 0.48) * spotBase * 0.005;
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    points.push({
      date: `${dt.getDate()}/${dt.getMonth() + 1}`,
      premium: Math.round(premium * 100) / 100,
      premiumDecay: Math.round((spotBase * 0.025 - premium) * 100) / 100,
      spot: Math.round(spot * 100) / 100,
    });
  }
  return points;
}

// ── IV Surface ──

export interface IVSurfacePoint {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  iv: number;
  moneyness: number;
}

export function generateIVSurface(spotPrice: number, stepSize: number): IVSurfacePoint[] {
  const rand = seededRandom(Math.round(spotPrice * 7));
  const expiries = [
    { label: "27 Mar", days: 4 }, { label: "3 Apr", days: 11 },
    { label: "10 Apr", days: 18 }, { label: "17 Apr", days: 25 },
    { label: "24 Apr", days: 32 }, { label: "29 May", days: 67 },
  ];
  const points: IVSurfacePoint[] = [];
  const atm = Math.round(spotPrice / stepSize) * stepSize;

  for (const exp of expiries) {
    for (let i = -8; i <= 8; i++) {
      const strike = atm + i * stepSize;
      const moneyness = (strike - spotPrice) / spotPrice;
      // IV smile with term structure
      const baseIV = 13 + Math.pow(Math.abs(moneyness) * 15, 1.6) + (moneyness < 0 ? 1.5 : 0);
      const termPremium = Math.sqrt(exp.days / 30) * 1.5;
      const noise = (rand() - 0.5) * 1;
      points.push({
        strike,
        expiry: exp.label,
        daysToExpiry: exp.days,
        iv: Math.round((baseIV + termPremium + noise) * 100) / 100,
        moneyness: Math.round(moneyness * 10000) / 100,
      });
    }
  }
  return points;
}

export interface IVTermStructure {
  expiry: string;
  daysToExpiry: number;
  atmIV: number;
  callSkew: number;
  putSkew: number;
}

export function getIVTermStructure(spotPrice: number, stepSize: number): IVTermStructure[] {
  const surface = generateIVSurface(spotPrice, stepSize);
  const atm = Math.round(spotPrice / stepSize) * stepSize;
  const expiries = [...new Set(surface.map(p => p.expiry))];
  
  return expiries.map(exp => {
    const expiryPoints = surface.filter(p => p.expiry === exp);
    const atmPoint = expiryPoints.find(p => p.strike === atm);
    const otmPut = expiryPoints.find(p => p.strike === atm - stepSize * 3);
    const otmCall = expiryPoints.find(p => p.strike === atm + stepSize * 3);
    return {
      expiry: exp,
      daysToExpiry: expiryPoints[0]?.daysToExpiry || 0,
      atmIV: atmPoint?.iv || 13,
      putSkew: otmPut ? otmPut.iv - (atmPoint?.iv || 13) : 0,
      callSkew: otmCall ? otmCall.iv - (atmPoint?.iv || 13) : 0,
    };
  });
}

// ── VRP (Volatility Risk Premium) Data ──

export interface VRPPoint {
  date: string;
  iv: number;
  rv: number;      // realized volatility
  vrp: number;     // IV - RV
  vrpCumulative: number;
}

export function generateVRPHistory(symbol: string): VRPPoint[] {
  const seed = symbol === "NIFTY" ? 42 : symbol === "BANKNIFTY" ? 77 : 99;
  const rand = seededRandom(seed);
  const points: VRPPoint[] = [];
  let iv = 13 + rand() * 4;
  let rv = iv * (0.65 + rand() * 0.2);
  let cumVRP = 0;

  for (let d = 90; d >= 0; d--) {
    iv += (rand() - 0.48) * 0.8;
    rv += (rand() - 0.5) * 0.6;
    iv = Math.max(8, Math.min(35, iv));
    rv = Math.max(5, Math.min(30, rv));
    const vrp = iv - rv;
    cumVRP += vrp;
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    points.push({
      date: `${dt.getDate()}/${dt.getMonth() + 1}`,
      iv: Math.round(iv * 100) / 100,
      rv: Math.round(rv * 100) / 100,
      vrp: Math.round(vrp * 100) / 100,
      vrpCumulative: Math.round(cumVRP * 100) / 100,
    });
  }
  return points;
}

// ── Greeks Heatmap Data ──

export interface GreeksHeatmapPoint {
  strike: number;
  expiry: string;
  daysToExpiry: number;
  ceDelta: number;
  ceGamma: number;
  ceTheta: number;
  ceVega: number;
  peDelta: number;
  peGamma: number;
  peTheta: number;
  peVega: number;
}

export function generateGreeksHeatmap(spotPrice: number, stepSize: number): GreeksHeatmapPoint[] {
  const rand = seededRandom(Math.round(spotPrice * 13));
  const expiries = [
    { label: "27 Mar", days: 4 }, { label: "3 Apr", days: 11 },
    { label: "10 Apr", days: 18 }, { label: "17 Apr", days: 25 },
    { label: "24 Apr", days: 32 },
  ];
  const atm = Math.round(spotPrice / stepSize) * stepSize;
  const points: GreeksHeatmapPoint[] = [];

  for (const exp of expiries) {
    for (let i = -6; i <= 6; i++) {
      const strike = atm + i * stepSize;
      const moneyness = (spotPrice - strike) / spotPrice; // positive = ITM for calls
      const sqrtT = Math.sqrt(exp.days / 365);
      const d1Approx = moneyness / (0.13 * sqrtT + 0.001);

      // Approximate Black-Scholes Greeks
      const nd1 = Math.exp(-d1Approx * d1Approx / 2) / Math.sqrt(2 * Math.PI);
      const Nd1 = 0.5 * (1 + erf(d1Approx / Math.sqrt(2)));

      const ceDelta = Math.max(0.01, Math.min(0.99, Nd1 + (rand() - 0.5) * 0.02));
      const peDelta = ceDelta - 1;
      const gamma = nd1 / (spotPrice * 0.13 * sqrtT + 0.001) * 100;
      const ceGamma = Math.max(0.0001, gamma + (rand() - 0.5) * 0.001);
      const ceTheta = -(spotPrice * 0.13 * nd1) / (2 * sqrtT * 365 + 0.01) - (rand() * 2);
      const ceVega = spotPrice * sqrtT * nd1 / 100 * (1 + (rand() - 0.5) * 0.1);

      points.push({
        strike,
        expiry: exp.label,
        daysToExpiry: exp.days,
        ceDelta: Math.round(ceDelta * 1000) / 1000,
        ceGamma: Math.round(ceGamma * 10000) / 10000,
        ceTheta: Math.round(ceTheta * 100) / 100,
        ceVega: Math.round(ceVega * 100) / 100,
        peDelta: Math.round(peDelta * 1000) / 1000,
        peGamma: Math.round(ceGamma * 10000) / 10000,
        peTheta: Math.round((ceTheta - rand() * 0.5) * 100) / 100,
        peVega: Math.round(ceVega * 100) / 100,
      });
    }
  }
  return points;
}

// Simple error function approximation
function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// ── FII/DII Activity ──

export interface FIIDIIDay {
  date: string;
  fiiBuy: number;
  fiiSell: number;
  fiiNet: number;
  diiBuy: number;
  diiSell: number;
  diiNet: number;
  niftyClose: number;
}

export function generateFIIDIIHistory(): FIIDIIDay[] {
  const rand = seededRandom(999);
  const days: FIIDIIDay[] = [];
  let nifty = 23800;
  for (let d = 30; d >= 0; d--) {
    const fiiBuy = 3000 + rand() * 4000;
    const fiiSell = 2800 + rand() * 4200;
    const diiBuy = 2500 + rand() * 3000;
    const diiSell = 2200 + rand() * 3200;
    nifty += (fiiBuy - fiiSell + diiBuy - diiSell) * 0.02 + (rand() - 0.5) * 80;
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    days.push({
      date: `${dt.getDate()}/${dt.getMonth() + 1}`,
      fiiBuy: Math.round(fiiBuy), fiiSell: Math.round(fiiSell), fiiNet: Math.round(fiiBuy - fiiSell),
      diiBuy: Math.round(diiBuy), diiSell: Math.round(diiSell), diiNet: Math.round(diiBuy - diiSell),
      niftyClose: Math.round(nifty),
    });
  }
  return days;
}

export interface RolloverData {
  symbol: string;
  currentMonthOI: number;
  nextMonthOI: number;
  rolloverPercent: number;
  prevRollover: number;
  costOfCarry: number;
  marketWideOI: number;
  interpretation: string;
}

export function getRolloverData(): RolloverData[] {
  const rand = seededRandom(555);
  const symbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "TATAMOTORS"];
  return symbols.map(s => {
    const currentOI = 5000000 + rand() * 20000000;
    const nextOI = currentOI * (0.3 + rand() * 0.5);
    const rollover = (nextOI / (currentOI + nextOI)) * 100;
    const prevRollover = rollover * (0.85 + rand() * 0.3);
    const costOfCarry = (rand() - 0.3) * 2;
    return {
      symbol: s,
      currentMonthOI: Math.round(currentOI),
      nextMonthOI: Math.round(nextOI),
      rolloverPercent: Math.round(rollover * 100) / 100,
      prevRollover: Math.round(prevRollover * 100) / 100,
      costOfCarry: Math.round(costOfCarry * 100) / 100,
      marketWideOI: Math.round(currentOI + nextOI),
      interpretation: costOfCarry > 0.5 ? "Bullish Carry" : costOfCarry < -0.3 ? "Bearish Carry" : "Neutral",
    };
  });
}

export interface FIIFuturesOI {
  date: string;
  longOI: number;
  shortOI: number;
  netOI: number;
  longShortRatio: number;
}

export function generateFIIFuturesOI(): FIIFuturesOI[] {
  const rand = seededRandom(321);
  const points: FIIFuturesOI[] = [];
  let longOI = 450000, shortOI = 420000;
  for (let d = 30; d >= 0; d--) {
    longOI += Math.round((rand() - 0.48) * 15000);
    shortOI += Math.round((rand() - 0.52) * 15000);
    longOI = Math.max(300000, longOI); shortOI = Math.max(280000, shortOI);
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    points.push({
      date: `${dt.getDate()}/${dt.getMonth() + 1}`,
      longOI, shortOI,
      netOI: longOI - shortOI,
      longShortRatio: Math.round((longOI / shortOI) * 100) / 100,
    });
  }
  return points;
}

// ── OI Spurts ──

export interface OISpurt {
  symbol: string;
  strike: number;
  type: "CE" | "PE";
  previousOI: number;
  currentOI: number;
  oiChange: number;
  oiChangePercent: number;
  ltp: number;
  ltpChange: number;
  volume: number;
  timestamp: string;
  interpretation: "Long Buildup" | "Short Buildup" | "Long Unwinding" | "Short Covering";
}

export function getOISpurts(): OISpurt[] {
  const rand = seededRandom(88);
  const spurts: OISpurt[] = [];
  const symbols = ["NIFTY", "BANKNIFTY", "RELIANCE", "HDFCBANK", "INFY", "TATAMOTORS", "SBIN", "TCS"];
  const spotPrices: Record<string, number> = {
    NIFTY: 24250, BANKNIFTY: 51850, RELIANCE: 2945, HDFCBANK: 1685,
    INFY: 1520, TATAMOTORS: 985, SBIN: 825, TCS: 3850,
  };

  for (let i = 0; i < 20; i++) {
    const sym = symbols[Math.floor(rand() * symbols.length)];
    const spot = spotPrices[sym] || 2000;
    const step = sym === "BANKNIFTY" ? 100 : sym === "NIFTY" ? 50 : 25;
    const strikeOffset = Math.round((rand() - 0.5) * 6) * step;
    const type = rand() > 0.5 ? "CE" as const : "PE" as const;
    const prevOI = Math.round(200000 + rand() * 2000000);
    const oiChg = Math.round(prevOI * (0.08 + rand() * 0.25) * (rand() > 0.3 ? 1 : -1));
    const ltpChg = (rand() - 0.45) * 20;
    const interp = oiChg > 0
      ? (ltpChg > 0 ? "Long Buildup" : "Short Buildup")
      : (ltpChg > 0 ? "Short Covering" : "Long Unwinding");
    const h = 9 + Math.floor(rand() * 6);
    const m = Math.floor(rand() * 12) * 5;

    spurts.push({
      symbol: sym,
      strike: Math.round(spot / step) * step + strikeOffset,
      type,
      previousOI: prevOI,
      currentOI: prevOI + oiChg,
      oiChange: oiChg,
      oiChangePercent: Math.round((oiChg / prevOI) * 10000) / 100,
      ltp: Math.round((20 + rand() * 200) * 100) / 100,
      ltpChange: Math.round(ltpChg * 100) / 100,
      volume: Math.round(50000 + rand() * 500000),
      timestamp: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
      interpretation: interp as OISpurt["interpretation"],
    });
  }
  return spurts.sort((a, b) => Math.abs(b.oiChangePercent) - Math.abs(a.oiChangePercent));
}

// ── Watchlist ──

export interface WatchlistItem {
  symbol: string;
  ltp: number;
  change: number;
  changePercent: number;
  iv: number;
  ivRank: number;
  oi: number;
  oiChange: number;
  pcr: number;
  volume: number;
}

export function getDefaultWatchlist(): WatchlistItem[] {
  const rand = seededRandom(42);
  const items: { sym: string; ltp: number }[] = [
    { sym: "NIFTY", ltp: 24250 }, { sym: "BANKNIFTY", ltp: 51850 },
    { sym: "FINNIFTY", ltp: 23180 }, { sym: "RELIANCE", ltp: 2945 },
    { sym: "HDFCBANK", ltp: 1685 }, { sym: "INFY", ltp: 1520 },
    { sym: "TCS", ltp: 3850 }, { sym: "SBIN", ltp: 825 },
    { sym: "TATAMOTORS", ltp: 985 }, { sym: "BAJFINANCE", ltp: 7280 },
  ];
  return items.map(({ sym, ltp }) => ({
    symbol: sym, ltp,
    change: Math.round((rand() - 0.45) * ltp * 0.02 * 100) / 100,
    changePercent: Math.round((rand() - 0.45) * 3 * 100) / 100,
    iv: Math.round((12 + rand() * 15) * 100) / 100,
    ivRank: Math.round(rand() * 100),
    oi: Math.round(5000000 + rand() * 30000000),
    oiChange: Math.round((rand() - 0.4) * 2000000),
    pcr: Math.round((0.5 + rand() * 1.5) * 100) / 100,
    volume: Math.round(2000000 + rand() * 10000000),
  }));
}
