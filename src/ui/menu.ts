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
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "flex";
}

export function hideMenu() {
  menu.style.display = "none";
}

document.addEventListener("click", hideMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideMenu();
});