import type { HouseStyle } from "./types";

export const PALETTE: HouseStyle[] = [
  { color: "var(--azure)" },
  { color: "var(--gules)" },
  { color: "var(--vert)" },
  { color: "var(--purpure)" },
  { color: "var(--sable)" },
  { color: "var(--or)", textColor: "var(--sable)" },
  { color: "var(--tenne)" },
  { color: "var(--murrey)" },
];

export const UNKNOWN_STYLE: HouseStyle = { color: "#9a9a9a" };

export const SVG_NS = "http://www.w3.org/2000/svg";
export const NODE_H = 44;
export const NODE_PAD = 10;
export const MIN_NODE_W = 80;
export const FONT_NAME = "15px 'Pixelify Sans', monospace";
export const FONT_TITLE = "13px 'Pixelify Sans', monospace";
export const COUPLE_GAP = 50;
export const SIBLING_GAP = 30;
export const UP = 1;
export const DOWN = 2;
export const MIN_GENERATION_GAP = 140;
export const OTHER_STYLE: HouseStyle = { color: "#cfcfc4", textColor: "var(--sable)" };