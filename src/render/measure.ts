import type { Person } from "../types";
import { FONT_NAME, FONT_TITLE, MIN_NODE_W, NODE_PAD } from "../constants";

const ctx = document.createElement("canvas").getContext("2d")!;

function textWidth(text: string, font: string): number {
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function nodeWidth(person: Person): number {
  const name = textWidth(person.name.en, FONT_NAME);
  const title = person.displayTitle;
  const titleW = title !== undefined ? textWidth(title, FONT_TITLE) : 0;
  return Math.max(MIN_NODE_W, Math.ceil(Math.max(name, titleW)) + 2 * NODE_PAD);
}