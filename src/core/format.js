// Italian formatting helpers shared by the terminal report and the web dashboard.
import { DAY_MS } from './dates.js';

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const WEEKDAYS_LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const nf0 = new Intl.NumberFormat('it-IT');
const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n) => nf0.format(n);
export const fmtDec = (n) => nf1.format(n);

/** Format a day number. Default: "12 set". */
export function fmtDay(day, opts = { day: 'numeric', month: 'short' }) {
  return new Date(day * DAY_MS).toLocaleDateString('it-IT', { timeZone: 'UTC', ...opts });
}

/** "15 marzo 2027" */
export function fmtLongDay(day) {
  return fmtDay(day, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "4 ott, 22:02" */
export function fmtDateTime(ts, opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) {
  return new Date(ts).toLocaleString('it-IT', { timeZone: 'UTC', ...opts });
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
