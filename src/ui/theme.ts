export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // browser ne dozvoljava pamćenje - režim važi samo do osvežavanja
  }
  document.dispatchEvent(new Event("themechange"));
}

export function createThemeButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "home-button";

  const update = () => {
    const dark = currentTheme() === "dark";
    button.textContent = dark ? "☀" : "☾";
    button.title = dark ? "Light mode" : "Night mode";
  };

  update();
  button.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  document.addEventListener("themechange", update);

  return button;
}