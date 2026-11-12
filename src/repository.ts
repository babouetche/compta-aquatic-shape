import type { Donnees } from './types';
import { normaliserPaiements } from './paiements';
// seed.json (données perso, ignoré par git) est optionnel : présent en local, absent du dépôt public.
const seeds = import.meta.glob('./seed.json', { eager: true, import: 'default' });
const seed: any = Object.values(seeds)[0] ?? { mois: {}, reglages: { structure: '', adresse: '', payeur: '' } };

/** Interface de stockage : brancher plus tard un adaptateur Google Sheets (cahier §7). */
export interface Repository {
  load(): Promise<Donnees>;
  save(d: Donnees): Promise<void>;
}

const KEY = 'compta-aquatic-shape/v1';

export class LocalRepository implements Repository {
  async load(): Promise<Donnees> {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Donnees;
    const d = normaliser(seed); // premier lancement : import du JSON fourni
    await this.save(d);
    return d;
  }
  async save(d: Donnees) { localStorage.setItem(KEY, JSON.stringify(d)); }
}

/** Valide/normalise un JSON importé (ignore les clés _notes, _source…). */
export function normaliser(x: any): Donnees {
  if (!x || typeof x !== 'object' || typeof x.mois !== 'object') throw new Error('Fichier invalide : clé "mois" manquante');
  for (const [k, m] of Object.entries<any>(x.mois)) {
    if (!/^\d{4}-\d{2}$/.test(k) || typeof m.caTTC !== 'number' || typeof m.retroTTC !== 'number')
      throw new Error(`Mois invalide : ${k}`);
    m.cheques ??= []; m.refFacture ??= '';
  }
  return { mois: x.mois, reglages: x.reglages ?? { structure: '', adresse: '' }, paiements: normaliserPaiements(x.paiements) };
}
