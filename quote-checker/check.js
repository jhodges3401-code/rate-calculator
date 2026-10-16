// Quote Checker core (pure functions, no DOM). Free, ungated, runs in the browser.
// Floor = the lowest hourly rate that covers your income goal, taxes and costs (same math as the Rate Calculator).
export function floorRate({ income = 0, expenses = 0, tax = 0, weeks = 46, hpw = 40, bill = 60 }) {
  const hours = weeks * hpw * (bill / 100), t = Math.min(Math.max(tax, 0), 95) / 100;
  return hours > 0 ? ((income / (1 - t)) + expenses) / hours : NaN;
}
// q: { price, hours, discountPct, feePct, costs, revisionsHours, contingencyPct }
export function check(q, floor) {
  const price = Math.max(0, +q.price || 0), hours = Math.max(0, +q.hours || 0);
  const extra = Math.max(0, +q.revisionsHours || 0), cont = Math.max(0, +q.contingencyPct || 0) / 100;
  const realHours = (hours + extra) * (1 + cont);
  const afterDiscount = price * (1 - Math.min(Math.max(+q.discountPct || 0, 0), 100) / 100);
  const fees = afterDiscount * Math.min(Math.max(+q.feePct || 0, 0), 100) / 100;
  const net = afterDiscount - fees - Math.max(0, +q.costs || 0);
  const effective = realHours > 0 ? net / realHours : NaN;
  const ratio = floor > 0 && isFinite(effective) ? effective / floor : NaN;
  // Minimum price that hits the floor after discount, fees and costs.
  const keep = (1 - Math.min(Math.max(+q.discountPct || 0, 0), 99.9) / 100) * (1 - Math.min(Math.max(+q.feePct || 0, 0), 99.9) / 100);
  const minPrice = floor > 0 && realHours > 0 ? (floor * realHours + Math.max(0, +q.costs || 0)) / keep : NaN;
  const verdict = !isFinite(ratio) ? 'incomplete' : ratio >= 1.15 ? 'healthy' : ratio >= 1 ? 'thin' : 'below';
  const tips = [];
  if (verdict === 'below' || verdict === 'thin') {
    if (+q.discountPct > 0) tips.push(`Drop the ${+q.discountPct}% discount, or trade it for something (faster payment, a case study, a smaller scope).`);
    if (extra === 0) tips.push('Revisions aren\'t counted yet. Add the hours they usually take, or cap revision rounds in the quote.');
    if (cont === 0) tips.push('There\'s no buffer. Most projects run 10–25% over the first estimate.');
    if (+q.feePct > 0) tips.push(`${+q.feePct}% goes to fees. Ask for bank transfer, or add the fee to the price.`);
    tips.push('Cut scope to fit the budget instead of cutting your rate.');
  }
  return { realHours, afterDiscount, fees, net, effective, ratio, minPrice, verdict, tips };
}
