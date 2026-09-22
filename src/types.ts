export type HouseId = string;
export type PersonId = string;

export interface House {
  id: HouseId;
  name: { en: string; native?: string };
  color: string; 
  textColor?: string;         
}

export interface Title {
  title: string;
  from: number | null;
  to: number | null;
}

export interface Person {
  id: PersonId;
  name: { en: string; native?: string };
  sex: "m" | "f";
  born: number;           // for now just a year
  died: number | null;
  houseBirth: HouseId;
  houseMarriage: HouseId | null;
  titles?: Title[];
  wiki?: string;
  bornEstimated?: boolean;
}

export interface Parentage {
  parent: PersonId;
  child: PersonId;
}

export interface Union {
  a: PersonId;
  b: PersonId;
  from: number | null;
}

export interface Dataset {
  houses: House[];
  people: Person[];
  parentage: Parentage[];
  unions: Union[];
}

export type Point = { x: number; y: number };
export type Box = Point & { w: number };
export type HouseStyle = { color: string; textColor?: string };