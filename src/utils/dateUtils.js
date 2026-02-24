/**
 * Calcula cuántos días de crédito restan a partir de una fecha de inicio y un total de días concedidos.
 *
 * Reglas y notas:
 * - Usa la fecha actual (hoy) para el cálculo.
 * - Ignora horas/minutos/segundos (cómputo por día calendario).
 * - Devuelve un entero:
 *   > 0  → días restantes
 *   = 0  → vence hoy
 *   < 0  → días de atraso (vencido)
 *
 * @param {string|Date} startDate Fecha de inicio del crédito (ISO o Date)
 * @param {number|string} totalCreditDays Días de crédito otorgados
 * @param {Date} [now=new Date()] Fecha de referencia para el cálculo (opcional, por defecto hoy)
 * @returns {number|null} Días restantes (puede ser negativo si está vencido) o null si los parámetros son inválidos
 */
export function calculateRemainingCreditDays(startDate, totalCreditDays, now = new Date()) {
  const toDateOnlyUTC = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return null;
    return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  };

  const total = Number(totalCreditDays);
  if (!startDate || !isFinite(total)) return null;

  const start = toDateOnlyUTC(startDate);
  const today = toDateOnlyUTC(now);
  if (!start || !today) return null;

  // Fecha de vencimiento = inicio + total días
  const due = new Date(start.getTime());
  // Sumar días en UTC para evitar problemas de DST
  due.setUTCDate(due.getUTCDate() + total);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // Ceil para que cualquier fracción cuente como día pendiente
  const remaining = Math.ceil((due - today) / MS_PER_DAY);
  return remaining;
}

/**
 * Variante segura que nunca devuelve negativo (clamp a 0).
 * @param {string|Date} startDate
 * @param {number|string} totalCreditDays
 * @param {Date} [now=new Date()]
 * @returns {number|null}
 */
export function calculateRemainingCreditDaysClamped(startDate, totalCreditDays, now = new Date()) {
  const rem = calculateRemainingCreditDays(startDate, totalCreditDays, now);
  if (rem == null) return null;
  return Math.max(0, rem);
}

