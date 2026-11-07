const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const e0 = (n: number) => eur0.format(Math.round(n));
export const e2 = (n: number) => eur2.format(n);
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
export const libMois = (k: string) => { const [y, m] = k.split('-'); return `${MOIS[+m - 1]} ${y}`; };
export const dateFr = (iso: string) => iso ? iso.split('-').reverse().join('/') : '';
const COURT = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
export const libCourt = (k: string) => `${COURT[+k.split('-')[1] - 1]} ${k.slice(2, 4)}`;
