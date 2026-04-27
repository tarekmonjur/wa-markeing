import { Injectable } from '@nestjs/common';

interface VariantResult {
  delivered: number;
  read: number;
}

export interface SignificanceResult {
  pValue: number;
  isSignificant: boolean;
  winner: 'A' | 'B' | 'INCONCLUSIVE';
  message: string;
}

@Injectable()
export class SignificanceService {
  /**
   * Chi-squared 2×2 contingency table test comparing read rates.
   * Requires ≥100 delivered per variant for meaningful results.
   */
  computeSignificance(a: VariantResult, b: VariantResult): SignificanceResult {
    if (a.delivered < 100 || b.delivered < 100) {
      return {
        pValue: 1,
        isSignificant: false,
        winner: 'INCONCLUSIVE',
        message: 'Not enough data yet (need ≥100 delivered per variant)',
      };
    }

    // Contingency table:
    // |         | Read     | Not Read          |
    // | A       | a.read   | a.delivered-a.read |
    // | B       | b.read   | b.delivered-b.read |
    const a_read = a.read;
    const a_notRead = a.delivered - a.read;
    const b_read = b.read;
    const b_notRead = b.delivered - b.read;

    const total = a_read + a_notRead + b_read + b_notRead;
    const rowA = a_read + a_notRead;
    const rowB = b_read + b_notRead;
    const colRead = a_read + b_read;
    const colNotRead = a_notRead + b_notRead;

    // Expected values
    const eAR = (rowA * colRead) / total;
    const eANR = (rowA * colNotRead) / total;
    const eBR = (rowB * colRead) / total;
    const eBNR = (rowB * colNotRead) / total;

    // Chi-squared statistic
    const chi2 =
      Math.pow(a_read - eAR, 2) / eAR +
      Math.pow(a_notRead - eANR, 2) / eANR +
      Math.pow(b_read - eBR, 2) / eBR +
      Math.pow(b_notRead - eBNR, 2) / eBNR;

    // p-value approximation for 1 degree of freedom
    const pValue = this.chi2ToPValue(chi2, 1);
    const isSignificant = pValue < 0.05;

    let winner: 'A' | 'B' | 'INCONCLUSIVE' = 'INCONCLUSIVE';
    let message = 'No significant difference (p ≥ 0.05)';

    if (isSignificant) {
      const rateA = a.read / a.delivered;
      const rateB = b.read / b.delivered;
      winner = rateA > rateB ? 'A' : 'B';
      message = `Variant ${winner} is significantly better (p = ${pValue.toFixed(4)})`;
    }

    return { pValue, isSignificant, winner, message };
  }

  /**
   * Approximate chi-squared CDF using the regularized incomplete gamma function.
   * For 1 degree of freedom: p-value = 1 - erf(sqrt(chi2/2))
   */
  private chi2ToPValue(chi2: number, df: number): number {
    if (chi2 <= 0) return 1;
    // For df=1, use the error function approximation
    if (df === 1) {
      return 1 - this.erf(Math.sqrt(chi2 / 2));
    }
    // General case: use incomplete gamma approximation
    return 1 - this.regularizedGammaP(df / 2, chi2 / 2);
  }

  private erf(x: number): number {
    // Horner form approximation (Abramowitz & Stegun)
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

  private regularizedGammaP(a: number, x: number): number {
    if (x === 0) return 0;
    // Series expansion for small x
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - this.lnGamma(a));
  }

  private lnGamma(z: number): number {
    // Lanczos approximation
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - this.lnGamma(1 - z);
    }
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (z + i);
    }
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
}
