export type PackType = 'expansion' | 'hero_pack' | 'scenario';

export interface Pack {
  code: string;
  name: string;
  type: PackType;
  /** Core set is always assumed owned */
  alwaysOwned?: boolean;
}

export interface Cycle {
  number: number;
  name: string;
  packs: Pack[];
}

export const CYCLES: Cycle[] = [
  {
    number: 1,
    name: 'Cycle 1',
    packs: [
      { code: 'core', name: 'Core Set', type: 'expansion', alwaysOwned: true },
      { code: 'cap', name: 'Captain America', type: 'hero_pack' },
      { code: 'msm', name: 'Ms. Marvel', type: 'hero_pack' },
      { code: 'thor', name: 'Thor', type: 'hero_pack' },
      { code: 'bkw', name: 'Black Widow', type: 'hero_pack' },
      { code: 'drs', name: 'Doctor Strange', type: 'hero_pack' },
      { code: 'hlk', name: 'Hulk', type: 'hero_pack' },
      { code: 'gob', name: 'The Green Goblin', type: 'scenario' },
      { code: 'twc', name: 'The Wrecking Crew', type: 'scenario' },
    ],
  },
  {
    number: 2,
    name: 'Cycle 2 — Rise of Red Skull',
    packs: [
      { code: 'trors', name: 'The Rise of Red Skull', type: 'expansion' },
      { code: 'ant', name: 'Ant-Man', type: 'hero_pack' },
      { code: 'wsp', name: 'Wasp', type: 'hero_pack' },
      { code: 'qsv', name: 'Quicksilver', type: 'hero_pack' },
      { code: 'scw', name: 'Scarlet Witch', type: 'hero_pack' },
      { code: 'toafk', name: 'The Once and Future Kang', type: 'scenario' },
    ],
  },
  {
    number: 3,
    name: "Cycle 3 — Galaxy's Most Wanted",
    packs: [
      { code: 'gmw', name: "The Galaxy's Most Wanted", type: 'expansion' },
      { code: 'stld', name: 'Star-Lord', type: 'hero_pack' },
      { code: 'gam', name: 'Gamora', type: 'hero_pack' },
      { code: 'drax', name: 'Drax', type: 'hero_pack' },
      { code: 'vnm', name: 'Venom', type: 'hero_pack' },
    ],
  },
  {
    number: 4,
    name: "Cycle 4 — Mad Titan's Shadow",
    packs: [
      { code: 'mts', name: "The Mad Titan's Shadow", type: 'expansion' },
      { code: 'nebu', name: 'Nebula', type: 'hero_pack' },
      { code: 'warm', name: 'War Machine', type: 'hero_pack' },
      { code: 'valk', name: 'Valkyrie', type: 'hero_pack' },
      { code: 'vision', name: 'Vision', type: 'hero_pack' },
      { code: 'hood', name: 'The Hood', type: 'scenario' },
    ],
  },
  {
    number: 5,
    name: 'Cycle 5 — Sinister Motives',
    packs: [
      { code: 'sm', name: 'Sinister Motives', type: 'expansion' },
      { code: 'nova', name: 'Nova', type: 'hero_pack' },
      { code: 'ironheart', name: 'Ironheart', type: 'hero_pack' },
      { code: 'spiderham', name: 'Spider-Ham', type: 'hero_pack' },
      { code: 'spdr', name: 'SP//dr', type: 'hero_pack' },
    ],
  },
  {
    number: 6,
    name: 'Cycle 6 — Mutant Genesis',
    packs: [
      { code: 'mut_gen', name: 'Mutant Genesis', type: 'expansion' },
      { code: 'cyclops', name: 'Cyclops', type: 'hero_pack' },
      { code: 'phoenix', name: 'Phoenix', type: 'hero_pack' },
      { code: 'wolv', name: 'Wolverine', type: 'hero_pack' },
      { code: 'storm', name: 'Storm', type: 'hero_pack' },
      { code: 'gambit', name: 'Gambit', type: 'hero_pack' },
      { code: 'rogue', name: 'Rogue', type: 'hero_pack' },
      { code: 'mojo', name: 'Mojo Mania', type: 'scenario' },
    ],
  },
  {
    number: 7,
    name: 'Cycle 7 — NeXt Evolution',
    packs: [
      { code: 'next_evol', name: 'NeXt Evolution', type: 'expansion' },
      { code: 'psylocke', name: 'Psylocke', type: 'hero_pack' },
      { code: 'angel', name: 'Angel', type: 'hero_pack' },
      { code: 'x23', name: 'X-23', type: 'hero_pack' },
      { code: 'deadpool', name: 'Deadpool', type: 'hero_pack' },
    ],
  },
  {
    number: 8,
    name: 'Cycle 8 — Age of Apocalypse',
    packs: [
      { code: 'aoa', name: 'Age of Apocalypse', type: 'expansion' },
      { code: 'iceman', name: 'Iceman', type: 'hero_pack' },
      { code: 'jubilee', name: 'Jubilee', type: 'hero_pack' },
      { code: 'ncrawler', name: 'Nightcrawler', type: 'hero_pack' },
      { code: 'magneto', name: 'Magneto', type: 'hero_pack' },
    ],
  },
  {
    number: 9,
    name: 'Cycle 9 — Agents of S.H.I.E.L.D.',
    packs: [
      { code: 'aos', name: 'Agents of S.H.I.E.L.D.', type: 'expansion' },
      { code: 'bp', name: 'Black Panther (Shuri)', type: 'hero_pack' },
      { code: 'silk', name: 'Silk', type: 'hero_pack' },
      { code: 'falcon', name: 'Falcon', type: 'hero_pack' },
      { code: 'winter', name: 'Winter Soldier', type: 'hero_pack' },
      { code: 'tt', name: 'Trickster Takeover', type: 'scenario' },
    ],
  },
  {
    number: 10,
    name: 'Cycle 10 — Civil War',
    packs: [
      { code: 'cw', name: 'Civil War', type: 'expansion' },
      { code: 'synthezoid', name: 'Synthezoid Smackdown', type: 'scenario' },
      { code: 'wonder_man', name: 'Wonder Man', type: 'hero_pack' },
      { code: 'hercules', name: 'Hercules', type: 'hero_pack' },
    ],
  },
  {
    number: 11,
    name: 'Print and Play',
    packs: [
      { code: 'ron', name: 'Ronan Modular Set', type: 'scenario' },
    ],
  },
];

/** Flat list of all packs */
export const ALL_PACKS: Pack[] = CYCLES.flatMap(c => c.packs);

/** Set of pack codes that are always owned (Core Set) */
export const ALWAYS_OWNED_CODES = new Set(
  ALL_PACKS.filter(p => p.alwaysOwned).map(p => p.code)
);
