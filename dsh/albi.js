// ALBI 评分：由白蛋白与胆红素派生，**不落库**（避免双真相）。
// 公式：0.66 × log10(胆红素 μmol/L) − 0.085 × 白蛋白 g/L
// 分级：≤ −2.60 → 1 级；> −2.60 且 ≤ −1.39 → 2 级；> −1.39 → 3 级
// 任一项缺测返回 null，不用 0 代替（0 会算出一个假分数）。
export function computeAlbi({ albumin, bilirubin }) {
  if (albumin == null || bilirubin == null) return null
  if (!(albumin > 0) || !(bilirubin > 0)) return null
  const score = Number((0.66 * Math.log10(bilirubin) - 0.085 * albumin).toFixed(2))
  const grade = score <= -2.6 ? 1 : score <= -1.39 ? 2 : 3
  return { score, grade }
}
