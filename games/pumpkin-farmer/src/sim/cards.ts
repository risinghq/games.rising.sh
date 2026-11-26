// The decision-card contract: what each card kind carries in s.story.cards. A sim module raises one with
// ctx.card({ kind, data }) and answers it in its cards[kind] handler; the UI draws it from ui/cards.ts.
import type { CrawlGuesse } from './state.js';

export interface CardChoice {
  id: string;
  label: string;
  sub?: string;
  primary?: boolean;
}

export interface Spot { x: number; y: number; z: number }

/** What every card shows. A kind adds its own fields. */
export interface CardBase {
  title: string;
  eyebrow?: string;
  speaker?: string;
  text?: string | null;
  choices: CardChoice[];
  defaultChoice: string;
  /** answering takes no game time */
  free?: boolean;
  /** where the card's bubble points in the scene */
  at?: Spot;
}

export interface Moon { phase: number; fromFull: number; full: boolean }
export interface Boast { id: string; name: string; est: number | null }
export interface DayWeather { day: number; f: number; heat: number; rain: number }

export interface CardData {
  crawl: CardBase & {
    hal: string;
    guesses: (CrawlGuesse & { speaker: string; line: string })[];
    range: [number, number];
    knock: string;
    knockSub: string;
    tapeLine: string;
    pull: string;
  };
  moving: CardBase & { days: number[]; fc: number[] };
  pollinate: CardBase & {
    plot: number;
    aside: string;
    dawn: number;
    fog: number;
    foggy: boolean;
    bees: number;
    setChance: number;
    chances: { open: number; paws: number };
    moon: Moon;
  };
  cull: CardBase & { plot: number; names: string[]; nameMax: number; twins: boolean; color: string; shape: string };
  crier: CardBase & { judges: string; est: number; boasts: Boast[] };
  mischief: CardBase & { kind: 'possum' | 'pamela'; spot?: string };
  shiny: CardBase & { kind: string; shiny: string };
  parking_lot_offer: CardBase;
  emptyRow: CardBase & { row: number; variety: string };
  fogjob: CardBase & { row: number };
  decorator: CardBase & { variety: string };
  morning: CardBase & DayWeather & { expect: number; first: boolean };
  evening: CardBase & {
    day: number;
    served: number;
    turned: number;
    walkoffs: number;
    arrived: number;
    rev: number;
    byV: Record<string, number>;
    tips: number;
    stars: number | null;
    R: number;
    byYou: number;
    maxRush: number;
    best: string | null;
    stock: { barn: number; prime: number; green: number; soft: number };
    tomorrow: DayWeather | null;
    weighoff: boolean;
  };
  panic: CardBase & { n: number; sold: number; amt: number };
  forklift: CardBase;
}

export type CardKind = keyof CardData;
/** A card as raised: its kind and that kind's data. */
export type CardIn = { [K in CardKind]: { kind: K; data: CardData[K] } }[CardKind];
export type CardOf<K extends CardKind> = { id: string; kind: K; data: CardData[K] };
export type Card = { [K in CardKind]: CardOf<K> }[CardKind];
