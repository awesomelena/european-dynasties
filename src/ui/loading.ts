const screen = document.getElementById("loading");

export function setStatus(text: string) {
  const status = screen?.querySelector(".loading-status");
  if (status) status.textContent = text;
}

export function hideLoading() {
  if (!screen) return;
  screen.classList.add("done");
  setTimeout(() => screen.remove(), 300);
}

export function showError(message: string) {
  if (!screen) return;
  screen.classList.add("error");
  setStatus(message);
  screen.querySelector(".loading-bar")?.remove();

  const button = document.createElement("button");
  button.className = "loading-reload";
  button.textContent = "Reload";
  button.addEventListener("click", () => location.reload());
  screen.querySelector(".loading-box")?.appendChild(button);
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}