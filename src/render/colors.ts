import type { HouseId, HouseStyle, Person, PersonId } from "../types";
import type { Layout } from "../layout/positions";
import { PALETTE, UNKNOWN_STYLE, OTHER_STYLE } from "../constants";

export function assignColors(
  layout: Layout,
  personById: Map<PersonId, Person>
): Map<HouseId, HouseStyle> {
  const visible: PersonId[] = [...layout.positions.keys()];
  for (const b of layout.blocks) {
    if (b.spouse !== null && b.spouse.ghost) visible.push(b.spouse.id);
  }

  const count = new Map<HouseId, number>();
  const bump = (h: HouseId | null) => {
    if (h !== null) count.set(h, (count.get(h) ?? 0) + 1);
  };
  for (const id of visible) {
    const person = personById.get(id)!;
    bump(person.houseBirth);
    bump(person.houseMarriage);
  }

  const colors = new Map<HouseId, HouseStyle>();
  const houses = [...count.keys()]
    .filter((h) => h !== "unknown")
    .sort((a, b) => count.get(b)! - count.get(a)!);
  houses.forEach((h, i) => colors.set(h, i < PALETTE.length ? PALETTE[i] : OTHER_STYLE));
  if (count.has("unknown")) colors.set("unknown", UNKNOWN_STYLE);

  return colors;
}