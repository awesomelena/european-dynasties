export type MenuItem = { label: string; action: () => void };

const menu = document.createElement("div");
menu.className = "menu";
menu.style.display = "none";
document.body.appendChild(menu);

export function showMenu(items: MenuItem[], x: number, y: number) {
  menu.replaceChildren();
  for (const item of items) {
    const button = document.createElement("button");
    button.textContent = item.label;
    button.addEventListener("click", () => {
      hideMenu();
      item.action();
    });
    menu.appendChild(button);
  }
  menu.style.display = "flex";
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;;
}

export function hideMenu() {
  menu.style.display = "none";
}

document.addEventListener("click", hideMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideMenu();
});

document.addEventListener("contextmenu", hideMenu);