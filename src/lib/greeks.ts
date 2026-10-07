// Black-Scholes Option Pricing & Greeks Engine

function cdf(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

function pdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface GreeksResult {
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export function calculateGreeks(
  spotPrice: number,
  strikePrice: number,
  timeToExpiryInDays: number,
  optionPrice: number,
  type: 'CE' | 'PE',
  riskFreeRate: number = 0.065 // 6.5% RBI repo rate
): GreeksResult {
  const T = Math.max(timeToExpiryInDays / 365, 0.0001); // Avoid division by zero
  const r = riskFreeRate;
  const S = spotPrice;
  const K = strikePrice;

  if (S <= 0 || K <= 0 || optionPrice <= 0) {
    return { iv: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  // 1. Estimate Implied Volatility (Newton-Raphson method with Brenner-Subrahmanyam initial guess)
  let iv = 0.20; // 20% default initial guess
  try {
    for (let i = 0; i < 20; i++) {
      const d1 = (Math.log(S / K) + (r + (iv * iv) / 2) * T) / (iv * Math.sqrt(T));
      const d2 = d1 - iv * Math.sqrt(T);

      let price = 0;
      if (type === 'CE') {
        price = S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
      } else {
        price = K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
      }

      const diff = price - optionPrice;
      if (Math.abs(diff) < 0.01) break;

      const vegaRaw = S * Math.sqrt(T) * pdf(d1);
      if (vegaRaw < 1e-5) break;

      iv = iv - diff / vegaRaw;
      if (iv <= 0.01) { iv = 0.01; break; }
      if (iv > 3.0) { iv = 3.0; break; }
    }
  } catch {
    iv = 0.20;
  }

  // Calculate final Greeks using the estimated or bounded IV
  const d1 = (Math.log(S / K) + (r + (iv * iv) / 2) * T) / (iv * Math.sqrt(T));
  const d2 = d1 - iv * Math.sqrt(T);

  let delta = 0;
  let theta = 0;
  const gamma = pdf(d1) / (S * iv * Math.sqrt(T));
  const vega = (S * Math.sqrt(T) * pdf(d1)) / 100; // per 1% change in vol

  if (type === 'CE') {
    delta = cdf(d1);
    theta = (-(S * pdf(d1) * iv) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * cdf(d2)) / 365;
  } else {
    delta = cdf(d1) - 1.0;
    theta = (-(S * pdf(d1) * iv) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * cdf(-d2)) / 365;
  }

  return {
    iv: Math.round(iv * 1000) / 10, // e.g. 18.5%
    delta: Math.round(delta * 100) / 100,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100
  };
}
