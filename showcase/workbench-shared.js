export function renderActionButtons(items) {
  return items
    .map(
      (item) => `
        <button class="tool-button tool-button--${item.tone ?? "ghost"}" type="button">
          ${item.label}
        </button>
      `
    )
    .join("");
}

export function renderStatusTabs(items) {
  return items
    .map(
      (item) => `
        <button class="status-tab ${item.active ? "is-active" : ""}" type="button" data-tab-id="${item.id}">
          ${item.label}
        </button>
      `
    )
    .join("");
}

export function renderLauncherCards(items) {
  return items
    .map(
      (item) => `
        <a class="launcher-card" href="${item.href}">
          <div class="launcher-card__head">
            <h3>${item.title}</h3>
            <span class="meta-pill">${item.kicker ?? "Open"}</span>
          </div>
          <p class="subtle">${item.description}</p>
          <div class="type-chips">
            ${item.chips.map((chip) => `<span class="type-chip">${chip}</span>`).join("")}
          </div>
        </a>
      `
    )
    .join("");
}
