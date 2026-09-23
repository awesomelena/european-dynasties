import { registerLayer } from "./layers";

const banner = document.createElement("div");
banner.className = "banner";
banner.style.display = "none";
document.body.appendChild(banner);

let onCancel: (() => void) | null = null;

export function showBanner(text: string, cancel: () => void) {
  banner.textContent = text;
  banner.style.display = "block";
  onCancel = cancel;
}

export function hideBanner() {
  banner.style.display = "none";
  onCancel = null;
}

registerLayer({
  priority: 90,
  isOpen: () => banner.style.display === "block",
  close: () => {
    onCancel?.();
    hideBanner();
  },
});