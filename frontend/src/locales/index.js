import { en } from './en';
import { hi } from './hi';
import { pa } from './pa';

export const dict = { en, hi, pa };

export const INR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const dt = (s) =>
  new Date(s).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function translate(lang, key, params = {}) {
  const dictionary = dict[lang] || dict.en;
  let text = dictionary[key] || dict.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

