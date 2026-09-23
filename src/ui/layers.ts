type Layer = {
  priority: number;
  isOpen: () => boolean;
  close: () => void;
};

const layers: Layer[] = [];

export function registerLayer(layer: Layer) {
  layers.push(layer);
  layers.sort((a, b) => b.priority - a.priority);
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const top = layers.find((layer) => layer.isOpen());
  if (top !== undefined) {
    e.preventDefault();
    top.close();
  }
});