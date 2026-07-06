const STORAGE_KEY = "setting-drawer-web-stable-v1";

const categories = {
  all: "전체",
  characters: "캐릭터",
  places: "지역",
  factions: "조직",
  events: "사건",
  items: "아이템",
  abilities: "능력",
  timeline: "타임라인",
  relations: "관계도"
};

const categoryDesc = {
  all: "모든 서랍을 한 번에 봅니다.",
  characters: "인물과 자캐 설정을 정리합니다.",
  places: "지역, 국가, 장소를 정리합니다.",
  factions: "조직, 세력, 집단을 정리합니다.",
  events: "사건과 에피소드를 정리합니다.",
  items: "아이템과 물건을 정리합니다.",
  abilities: "능력, 마법, 기술을 정리합니다.",
  timeline: "사건의 흐름을 정리합니다.",
  relations: "인물과 세력의 관계를 그립니다."
};

const dataCategories = ["characters", "places", "factions", "events", "items", "abilities"];

const emptyFolders = {
  characters: [],
  places: [],
  factions: [],
  events: [],
  items: [],
  abilities: []
};

const emptyState = {
  characters: [],
  places: [],
  factions: [],
  events: [],
  items: [],
  abilities: [],
  folders: structuredClone(emptyFolders),
  timeline: [],
  relation: {
    nodes: [],
    edges: []
  }
};

let state = loadState();
let currentCategory = "all";
let currentFolderId = "";
let currentTag = "";
let editingCard = null;
let detailTarget = null;
let editingFolder = null;
let formImage = "";
let selectedLinks = [];
let selectedTimelineId = null;
let editingTimelineId = null;
let selectedNodeId = null;
let selectedEdgeId = null;
let connectNodes = [];
let editingNodeId = null;

function $(id) {
  return document.getElementById(id);
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(emptyState);
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(emptyState);
  }
}

function normalizeState(data) {
  const merged = { ...structuredClone(emptyState), ...data };
  if (!merged.folders) merged.folders = structuredClone(emptyFolders);
  dataCategories.forEach((cat) => {
    if (!Array.isArray(merged[cat])) merged[cat] = [];
    if (!Array.isArray(merged.folders[cat])) merged.folders[cat] = [];
    merged[cat].forEach((item, index) => {
      item.order ??= index;
      item.tags ??= ["미분류"];
      item.links ??= [];
      item.folderId ??= "";
      item.pinned ??= false;
      item.createdAt ??= now();
      item.updatedAt ??= item.createdAt;
    });
  });
  if (!Array.isArray(merged.timeline)) merged.timeline = [];
  if (!merged.relation) merged.relation = { nodes: [], edges: [] };
  if (!Array.isArray(merged.relation.nodes)) merged.relation.nodes = [];
  if (!Array.isArray(merged.relation.edges)) merged.relation.edges = [];
  return merged;
}

function saveState() {
  repairLinks();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1400);
}

function getAllItems() {
  return dataCategories.flatMap((category) => state[category].map((item) => ({ ...item, category })));
}

function findItem(category, id) {
  return state[category]?.find((item) => item.id === id);
}

function getItems() {
  if (currentCategory === "all") return getAllItems();
  if (dataCategories.includes(currentCategory)) {
    return state[currentCategory].map((item) => ({ ...item, category: currentCategory }));
  }
  return [];
}

function linkKey(link) {
  return `${link.category}:${link.id}`;
}

function normalizeLinks(links = []) {
  const seen = new Set();
  const result = [];
  links.forEach((link) => {
    if (!link || !link.category || !link.id) return;
    if (!findItem(link.category, link.id)) return;
    const key = linkKey(link);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ category: link.category, id: link.id });
  });
  return result;
}

function ensureLink(category, id, link) {
  const item = findItem(category, id);
  if (!item) return;
  item.links = normalizeLinks(item.links || []);
  if (!item.links.some((target) => target.category === link.category && target.id === link.id)) {
    item.links.push({ category: link.category, id: link.id });
  }
}

function repairLinks() {
  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      item.links = normalizeLinks(item.links || []);
    });
  });
  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      item.links.forEach((link) => ensureLink(link.category, link.id, { category, id: item.id }));
    });
  });
}

function syncLinks(category, id, nextLinks, prevLinks = []) {
  const next = normalizeLinks(nextLinks);
  const source = { category, id };
  next.forEach((link) => ensureLink(link.category, link.id, source));
  prevLinks.forEach((oldLink) => {
    if (next.some((link) => link.category === oldLink.category && link.id === oldLink.id)) return;
    const target = findItem(oldLink.category, oldLink.id);
    if (!target) return;
    target.links = (target.links || []).filter((link) => !(link.category === category && link.id === id));
  });
  return next;
}

function getVisibleItems() {
  let items = getItems();
  const keyword = $("searchInput").value.trim().toLowerCase();

  if (currentFolderId && dataCategories.includes(currentCategory)) {
    items = items.filter((item) => currentFolderId === "__none" ? !item.folderId : item.folderId === currentFolderId);
  }
  if (keyword) {
    items = items.filter((item) => [item.title, item.summary, item.body, item.dateText, item.tags.join(" ")]
      .join(" ").toLowerCase().includes(keyword));
  }
  if (currentTag) {
    items = items.filter((item) => item.tags.includes(currentTag));
  }

  const sort = $("sortSelect").value;
  if (sort === "manual" && dataCategories.includes(currentCategory)) {
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } else if (sort === "updated") {
    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } else if (sort === "created") {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === "title") {
    items.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }
  items.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return items;
}

function render() {
  renderNav();
  renderTitle();
  renderMainMode();
  renderFolders();
  renderTags();

  if (currentCategory === "timeline") renderTimeline();
  else if (currentCategory === "relations") renderRelations();
  else renderCards();
}

function renderNav() {
  const nav = $("categoryNav");
  nav.innerHTML = "";
  Object.entries(categories).forEach(([key, label]) => {
    const button = document.createElement("button");
    button.className = key === currentCategory ? "active" : "";
    const count = key === "all"
      ? getAllItems().length
      : dataCategories.includes(key)
        ? state[key].length
        : key === "timeline"
          ? state.timeline.length
          : state.relation.nodes.length;
    button.innerHTML = `<span>${label}</span><span>${count}</span>`;
    button.addEventListener("click", () => {
      currentCategory = key;
      currentFolderId = "";
      currentTag = "";
      selectedTimelineId = null;
      selectedNodeId = null;
      selectedEdgeId = null;
      connectNodes = [];
      document.body.classList.remove("menu-open");
      render();
    });
    nav.appendChild(button);
  });
}

function renderTitle() {
  $("pageTitle").textContent = categories[currentCategory];
  $("pageDesc").textContent = categoryDesc[currentCategory];
}

function renderMainMode() {
  const listMode = currentCategory !== "timeline" && currentCategory !== "relations";
  $("listTools").classList.toggle("hidden", !listMode);
  $("cardGrid").classList.toggle("hidden", !listMode);
  $("emptyBox").classList.toggle("hidden", !listMode);
  $("timelineView").classList.toggle("hidden", currentCategory !== "timeline");
  $("relationView").classList.toggle("hidden", currentCategory !== "relations");
}

function createPill(text, active, onClick) {
  const button = document.createElement("button");
  button.className = `pill ${active ? "active" : ""}`;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function renderFolders() {
  const row = $("folderRow");
  row.innerHTML = "";
  if (!dataCategories.includes(currentCategory)) {
    row.classList.add("hidden");
    return;
  }
  row.classList.remove("hidden");
  row.appendChild(createPill("폴더 전체", !currentFolderId, () => {
    currentFolderId = "";
    render();
  }));
  row.appendChild(createPill("폴더 없음", currentFolderId === "__none", () => {
    currentFolderId = "__none";
    render();
  }));
  state.folders[currentCategory].forEach((folder) => {
    const count = state[currentCategory].filter((item) => item.folderId === folder.id).length;
    row.appendChild(createPill(`${folder.name} ${count}`, currentFolderId === folder.id, () => {
      currentFolderId = folder.id;
      render();
    }));
  });
  row.appendChild(createPill("폴더 추가", false, () => openFolderModal()));
  if (currentFolderId && currentFolderId !== "__none") {
    row.appendChild(createPill("폴더 수정", false, () => openFolderModal(currentFolderId)));
  }
}

function renderTags() {
  const row = $("tagRow");
  row.innerHTML = "";
  if (!dataCategories.includes(currentCategory)) {
    row.classList.add("hidden");
    return;
  }
  const tags = new Set();
  getVisibleItems().forEach((item) => item.tags.forEach((tag) => tags.add(tag)));
  if (tags.size === 0) {
    row.classList.add("hidden");
    return;
  }
  row.classList.remove("hidden");
  row.appendChild(createPill("태그 전체", !currentTag, () => {
    currentTag = "";
    render();
  }));
  Array.from(tags).sort((a, b) => a.localeCompare(b, "ko")).forEach((tag) => {
    row.appendChild(createPill(tag, currentTag === tag, () => {
      currentTag = tag;
      render();
    }));
  });
}

function renderCards() {
  const grid = $("cardGrid");
  const items = getVisibleItems();
  grid.innerHTML = "";
  $("emptyBox").classList.toggle("hidden", items.length !== 0);
  items.forEach((item) => grid.appendChild(createCard(item)));
}

function getFolderName(category, folderId) {
  return state.folders[category]?.find((folder) => folder.id === folderId)?.name || "";
}

function cardRelationSummary(item) {
  const linked = normalizeLinks(item.links || [])
    .map((link) => {
      const target = findItem(link.category, link.id);
      return target ? { ...target, category: link.category } : null;
    })
    .filter(Boolean);

  let targets = [];
  let label = "연결";
  if (item.category === "factions") {
    targets = linked.filter((target) => target.category === "characters");
    label = "포함";
  } else if (item.category === "characters") {
    targets = linked.filter((target) => target.category === "factions" || target.category === "abilities");
  } else if (item.category === "abilities") {
    targets = linked.filter((target) => target.category === "characters");
    label = "사용";
  }
  if (!targets.length) return "";
  return `<div class="card-relations"><em>${label}</em>${targets.slice(0, 4).map((t) => `<span>${escapeHTML(t.title)}</span>`).join("")}</div>`;
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.draggable = dataCategories.includes(currentCategory) && $("sortSelect").value === "manual";
  card.dataset.id = item.id;

  const image = item.image ? `<img src="${item.image}" alt="">` : "이미지 없음";
  card.innerHTML = `
    <div class="card-image">${image}</div>
    <h3>${escapeHTML(item.title || "제목 없음")}</h3>
    <div class="card-summary">${escapeHTML(item.summary || item.body || "내용 없음")}</div>
    ${cardRelationSummary(item)}
    <div class="tags">
      ${item.folderId ? `<span class="tag">${escapeHTML(getFolderName(item.category, item.folderId))}</span>` : ""}
      ${(item.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
    </div>
    <div class="card-actions">
      <button class="primary" data-open>열기</button>
      <button data-edit>수정</button>
      <button data-pin>${item.pinned ? "고정 해제" : "고정"}</button>
      <button class="danger" data-delete>삭제</button>
    </div>
  `;

  card.querySelector("[data-open]").addEventListener("click", () => openDetail(item.category, item.id));
  card.querySelector("[data-edit]").addEventListener("click", () => openCardModal(item.category, item.id));
  card.querySelector("[data-pin]").addEventListener("click", () => togglePin(item.category, item.id));
  card.querySelector("[data-delete]").addEventListener("click", () => deleteCard(item.category, item.id));

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", item.id);
  });
  card.addEventListener("dragover", (event) => event.preventDefault());
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    reorderCards(currentCategory, event.dataTransfer.getData("text/plain"), item.id);
  });

  return card;
}

function reorderCards(category, fromId, toId) {
  if (!dataCategories.includes(category) || fromId === toId) return;
  const list = state[category];
  const from = list.findIndex((item) => item.id === fromId);
  const to = list.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  list.forEach((item, index) => item.order = index);
  saveState();
  render();
}

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

function fillCategorySelects() {
  $("cardCategory").innerHTML = "";
  $("importCategory").innerHTML = `<option value="all">전체</option>`;
  dataCategories.forEach((category) => {
    $("cardCategory").appendChild(new Option(categories[category], category));
    $("importCategory").appendChild(new Option(categories[category], category));
  });
}

function fillFolderSelect(category, selected = "") {
  $("cardFolder").innerHTML = `<option value="">폴더 없음</option>`;
  state.folders[category].forEach((folder) => {
    const option = new Option(folder.name, folder.id);
    option.selected = folder.id === selected;
    $("cardFolder").appendChild(option);
  });
}

function openCardModal(category = null, id = null) {
  editingCard = category && id ? { category, id } : null;
  const item = editingCard ? findItem(category, id) : null;
  const targetCategory = item?.category || (dataCategories.includes(currentCategory) ? currentCategory : "characters");

  $("cardModalTitle").textContent = editingCard ? "수정" : "작성";
  $("cardCategory").value = targetCategory;
  $("cardCategory").disabled = Boolean(editingCard);
  fillFolderSelect(targetCategory, item?.folderId || "");

  $("cardTitle").value = item?.title || "";
  $("cardSummary").value = item?.summary || "";
  $("cardDate").value = item?.dateText || "";
  $("cardTags").value = (item?.tags || []).join(", ");
  $("cardBody").value = item?.body || "";
  formImage = item?.image || "";
  selectedLinks = normalizeLinks(item?.links || []);
  renderImagePreview();
  renderLinkPicker(targetCategory, item?.id || null);
  openModal("cardModal");
}

function renderImagePreview() {
  $("imagePreview").innerHTML = formImage ? `<img src="${formImage}" alt="">` : "이미지 없음";
}

function renderLinkPicker(category, id) {
  const box = $("linkPicker");
  box.innerHTML = "";
  const items = getAllItems().filter((item) => !(item.category === category && item.id === id));
  if (!items.length) {
    box.textContent = "연결할 설정이 없습니다.";
    return;
  }

  const order = category === "factions"
    ? ["characters", "abilities", "places", "events", "items", "factions"]
    : category === "characters"
      ? ["factions", "abilities", "characters", "places", "events", "items"]
      : category === "abilities"
        ? ["characters", "factions", "places", "events", "items", "abilities"]
        : dataCategories;

  order.forEach((cat) => {
    const groupItems = items.filter((item) => item.category === cat);
    if (!groupItems.length) return;
    const title = document.createElement("div");
    title.className = "link-group-title";
    if (category === "factions" && cat === "characters") title.textContent = "포함 캐릭터";
    else if (category === "characters" && cat === "factions") title.textContent = "소속 조직";
    else if (category === "characters" && cat === "abilities") title.textContent = "보유 능력";
    else if (category === "abilities" && cat === "characters") title.textContent = "사용 캐릭터";
    else title.textContent = categories[cat];
    box.appendChild(title);

    groupItems.forEach((item) => {
      const label = document.createElement("label");
      label.className = "link-option";
      const checked = selectedLinks.some((link) => link.category === item.category && link.id === item.id);
      label.innerHTML = `<input type="checkbox" value="${item.category}:${item.id}" ${checked ? "checked" : ""}> <span>${escapeHTML(item.title)} · ${categories[item.category]}</span>`;
      box.appendChild(label);
    });
  });
}

function readLinks() {
  return Array.from($("linkPicker").querySelectorAll("input:checked")).map((input) => {
    const [category, id] = input.value.split(":");
    return { category, id };
  });
}

function saveCard() {
  const category = $("cardCategory").value;
  const title = $("cardTitle").value.trim();
  if (!title) return showToast("제목을 적어주세요.");

  const data = {
    title,
    summary: $("cardSummary").value.trim(),
    body: $("cardBody").value.trim(),
    dateText: $("cardDate").value.trim(),
    folderId: $("cardFolder").value,
    tags: $("cardTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    links: readLinks(),
    image: formImage,
    updatedAt: now()
  };
  if (!data.tags.length) data.tags = ["미분류"];

  if (editingCard) {
    const item = findItem(editingCard.category, editingCard.id);
    const prev = normalizeLinks(item.links || []);
    Object.assign(item, data);
    item.links = syncLinks(editingCard.category, editingCard.id, data.links, prev);
  } else {
    const id = uid();
    const item = {
      id,
      ...data,
      links: [],
      pinned: false,
      order: state[category].length,
      createdAt: now()
    };
    state[category].push(item);
    item.links = syncLinks(category, id, data.links, []);
    currentCategory = category;
  }

  saveState();
  closeModal("cardModal");
  showToast("저장했습니다.");
  render();
}

function openDetail(category, id) {
  const item = findItem(category, id);
  if (!item) return;
  detailTarget = { category, id };
  $("detailTitle").textContent = item.title;
  $("detailMeta").textContent = `${categories[category]}${item.dateText ? " · " + item.dateText : ""}`;
  $("detailImage").innerHTML = item.image ? `<img src="${item.image}" alt="">` : "이미지 없음";
  $("detailSummary").textContent = item.summary || "";
  $("detailBody").textContent = item.body || "내용 없음";
  $("pinCardBtn").textContent = item.pinned ? "고정 해제" : "고정";
  renderDetailLinks(item);
  openModal("detailModal");
}

function renderDetailLinks(item) {
  const box = $("detailLinks");
  box.innerHTML = "";
  const links = normalizeLinks(item.links || []);
  if (!links.length) return;
  links.forEach((link) => {
    const target = findItem(link.category, link.id);
    if (!target) return;
    const button = document.createElement("button");
    button.textContent = `${target.title} · ${categories[link.category]}`;
    button.addEventListener("click", () => openDetail(link.category, link.id));
    box.appendChild(button);
  });
}

function togglePin(category, id) {
  const item = findItem(category, id);
  if (!item) return;
  item.pinned = !item.pinned;
  item.updatedAt = now();
  saveState();
  render();
}

function deleteCard(category, id) {
  if (!confirm("삭제할까요?")) return;
  state[category] = state[category].filter((item) => item.id !== id);
  dataCategories.forEach((cat) => {
    state[cat].forEach((item) => item.links = (item.links || []).filter((link) => !(link.category === category && link.id === id)));
  });
  state.relation.nodes = state.relation.nodes.filter((node) => !(node.sourceCategory === category && node.sourceId === id));
  saveState();
  closeModal("detailModal");
  render();
}

function openFolderModal(folderId = null) {
  editingFolder = folderId;
  const folder = state.folders[currentCategory].find((item) => item.id === folderId);
  $("folderName").value = folder?.name || "";
  $("deleteFolderBtn").classList.toggle("hidden", !folderId);
  openModal("folderModal");
}

function saveFolder() {
  if (!dataCategories.includes(currentCategory)) return;
  const name = $("folderName").value.trim();
  if (!name) return;
  if (editingFolder) {
    const folder = state.folders[currentCategory].find((item) => item.id === editingFolder);
    if (folder) folder.name = name;
  } else {
    state.folders[currentCategory].push({ id: uid(), name });
  }
  saveState();
  closeModal("folderModal");
  render();
}

function deleteFolder() {
  if (!editingFolder || !confirm("폴더를 삭제할까요? 설정은 삭제되지 않습니다.")) return;
  state.folders[currentCategory] = state.folders[currentCategory].filter((folder) => folder.id !== editingFolder);
  state[currentCategory].forEach((item) => {
    if (item.folderId === editingFolder) item.folderId = "";
  });
  currentFolderId = "";
  saveState();
  closeModal("folderModal");
  render();
}

function renderTimeline() {
  const board = $("timelineBoard");
  board.querySelectorAll(".timeline-dot,.timeline-card").forEach((el) => el.remove());
  state.timeline.forEach((point) => {
    point.dotX ??= 50;
    point.cardX ??= point.dotX;
    point.cardY ??= 35;

    const dot = document.createElement("div");
    dot.className = "timeline-dot";
    dot.style.left = `${point.dotX}%`;
    dot.style.top = "50%";
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTimelineId = point.id;
      renderTimeline();
    });
    makeDrag(dot, (x) => {
      point.dotX = Math.max(6, Math.min(94, x));
      dot.style.left = `${point.dotX}%`;
    }, true);
    board.appendChild(dot);

    const card = document.createElement("div");
    card.className = `timeline-card ${selectedTimelineId === point.id ? "selected" : ""}`;
    card.style.left = `${point.cardX}%`;
    card.style.top = `${point.cardY}%`;
    card.innerHTML = `<strong>${escapeHTML(point.title)}</strong><span>${escapeHTML(point.desc || "")}</span>`;
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTimelineId = point.id;
      renderTimeline();
    });
    makeDrag(card, (x, y) => {
      point.cardX = Math.max(4, Math.min(90, x));
      point.cardY = Math.max(8, Math.min(86, y));
      card.style.left = `${point.cardX}%`;
      card.style.top = `${point.cardY}%`;
    });
    board.appendChild(card);
  });
}

function makeDrag(el, onMove, horizontalOnly = false) {
  el.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const board = el.parentElement;
    const rect = board.getBoundingClientRect();
    el.setPointerCapture(event.pointerId);
    const move = (e) => {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onMove(x, horizontalOnly ? 50 : y);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      saveState();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function openTimelineModal(id = null) {
  editingTimelineId = id;
  const point = state.timeline.find((item) => item.id === id);
  $("timelineTitle").value = point?.title || "";
  $("timelineDesc").value = point?.desc || "";
  openModal("timelineModal");
}

function saveTimeline() {
  const title = $("timelineTitle").value.trim();
  if (!title) return;
  if (editingTimelineId) {
    const point = state.timeline.find((item) => item.id === editingTimelineId);
    if (point) {
      point.title = title;
      point.desc = $("timelineDesc").value.trim();
    }
  } else {
    state.timeline.push({ id: uid(), title, desc: $("timelineDesc").value.trim(), dotX: 50, cardX: 50, cardY: 30 });
  }
  saveState();
  closeModal("timelineModal");
  renderTimeline();
}

function renderRelations() {
  const board = $("relationBoard");
  const svg = $("relationSvg");
  board.querySelectorAll(".relation-node,.edge-label").forEach((el) => el.remove());
  svg.innerHTML = "";

  state.relation.edges = state.relation.edges.filter((edge) => state.relation.nodes.some((n) => n.id === edge.from) && state.relation.nodes.some((n) => n.id === edge.to));

  state.relation.edges.forEach((edge) => drawEdge(edge));

  state.relation.nodes.forEach((node) => {
    const source = node.sourceId ? findItem(node.sourceCategory, node.sourceId) : null;
    const title = source?.title || node.name || "이름 없음";
    const desc = source?.summary || source?.body || node.desc || "";
    const el = document.createElement("div");
    const isOrg = node.sourceCategory === "factions";
    el.className = `relation-node ${selectedNodeId === node.id ? "selected" : ""} ${connectNodes.includes(node.id) ? "pick" : ""} ${isOrg ? "organization" : ""}`;
    el.dataset.id = node.id;
    el.style.left = `${node.x ?? 80}px`;
    el.style.top = `${node.y ?? 80}px`;
    el.innerHTML = isOrg
      ? `<div class="org-title">${escapeHTML(title)}</div><span>${escapeHTML(desc)}</span><em>조직</em>`
      : `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(desc)}</span><em>${source ? categories[node.sourceCategory] : "직접 노드"}</em>`;
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      handleNodeClick(node.id);
    });
    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      source ? openDetail(node.sourceCategory, node.sourceId) : openNodeModal(node.id);
    });
    dragNode(el, node);
    board.appendChild(el);
  });
  requestAnimationFrame(() => {
    svg.innerHTML = "";
    state.relation.edges.forEach((edge) => drawEdge(edge));
  });
}

function nodeCenter(id) {
  const boardRect = $("relationBoard").getBoundingClientRect();
  const el = $("relationBoard").querySelector(`[data-id="${id}"]`);
  const node = state.relation.nodes.find((item) => item.id === id);
  if (!el) return { x: (node?.x || 0) + 80, y: (node?.y || 0) + 28 };
  const rect = el.getBoundingClientRect();
  return { x: rect.left - boardRect.left + rect.width / 2, y: rect.top - boardRect.top + rect.height / 2 };
}

function drawEdge(edge) {
  const from = nodeCenter(edge.from);
  const to = nodeCenter(edge.to);
  const midY = edge.midY ?? ((from.y + to.y) / 2);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`);
  if (selectedEdgeId === edge.id) path.classList.add("selected");
  path.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedEdgeId = edge.id;
    selectedNodeId = null;
    connectNodes = [];
    renderRelations();
  });
  $("relationSvg").appendChild(path);
  if (edge.label) {
    const label = document.createElement("div");
    label.className = "edge-label";
    label.textContent = edge.label;
    label.style.left = `${(from.x + to.x) / 2}px`;
    label.style.top = `${midY}px`;
    $("relationBoard").appendChild(label);
  }
}

function handleNodeClick(id) {
  selectedEdgeId = null;
  if (connectNodes.includes(id)) {
    connectNodes = connectNodes.filter((nodeId) => nodeId !== id);
  } else if (connectNodes.length < 2) {
    connectNodes.push(id);
  } else {
    connectNodes = [id];
  }
  selectedNodeId = id;
  renderRelations();
}

function dragNode(el, node) {
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const nodeX = node.x ?? 80;
    const nodeY = node.y ?? 80;
    let moved = false;
    el.setPointerCapture(event.pointerId);
    const move = (e) => {
      moved = true;
      node.x = Math.max(8, nodeX + e.clientX - startX);
      node.y = Math.max(8, nodeY + e.clientY - startY);
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      $("relationSvg").innerHTML = "";
      state.relation.edges.forEach((edge) => drawEdge(edge));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (moved) {
        setTimeout(() => {
          connectNodes = connectNodes.filter((id) => id !== node.id);
          saveState();
          renderRelations();
        }, 0);
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function openNodeModal(id = null) {
  editingNodeId = id;
  const node = state.relation.nodes.find((item) => item.id === id);
  $("nodeName").value = node?.name || "";
  $("nodeDesc").value = node?.desc || "";
  openModal("nodeModal");
}

function saveNode() {
  const name = $("nodeName").value.trim();
  if (!name) return;
  if (editingNodeId) {
    const node = state.relation.nodes.find((item) => item.id === editingNodeId);
    if (node) {
      node.name = name;
      node.desc = $("nodeDesc").value.trim();
    }
  } else {
    state.relation.nodes.push({ id: uid(), name, desc: $("nodeDesc").value.trim(), x: 80, y: 80 });
  }
  saveState();
  closeModal("nodeModal");
  renderRelations();
}

function connectNodesNow() {
  if (connectNodes.length !== 2) return showToast("노드 2개를 먼저 선택해주세요.");
  const [from, to] = connectNodes;
  const exists = state.relation.edges.some((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from));
  if (exists) return showToast("이미 연결된 노드입니다.");
  const edge = { id: uid(), from, to, label: "" };
  state.relation.edges.push(edge);
  selectedEdgeId = edge.id;
  connectNodes = [];
  saveState();
  $("edgeName").value = "";
  renderRelations();
  openModal("edgeModal");
}

function saveEdgeName() {
  const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
  if (!edge) return;
  edge.label = $("edgeName").value.trim();
  saveState();
  closeModal("edgeModal");
  renderRelations();
}

function deleteSelectedEdge() {
  if (!selectedEdgeId) return showToast("삭제할 선을 선택해주세요.");
  state.relation.edges = state.relation.edges.filter((edge) => edge.id !== selectedEdgeId);
  selectedEdgeId = null;
  saveState();
  renderRelations();
}

function deleteSelectedNode() {
  if (!selectedNodeId) return showToast("삭제할 노드를 선택해주세요.");
  state.relation.nodes = state.relation.nodes.filter((node) => node.id !== selectedNodeId);
  state.relation.edges = state.relation.edges.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId);
  selectedNodeId = null;
  connectNodes = [];
  saveState();
  renderRelations();
}

function openImportNodes() {
  renderImportList();
  openModal("importNodeModal");
}

function renderImportList() {
  const list = $("importList");
  const keyword = $("importSearch").value.trim().toLowerCase();
  const category = $("importCategory").value;
  list.innerHTML = "";
  getAllItems()
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => !keyword || item.title.toLowerCase().includes(keyword))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "import-item";
      row.innerHTML = `<div><strong>${escapeHTML(item.title)}</strong><br><small>${categories[item.category]}</small></div><button>가져오기</button>`;
      row.querySelector("button").addEventListener("click", () => {
        const isOrg = item.category === "factions";
        state.relation.nodes.push({
          id: uid(),
          sourceCategory: item.category,
          sourceId: item.id,
          name: item.title,
          desc: item.summary || "",
          x: isOrg ? 80 : 100 + Math.random() * 120,
          y: isOrg ? 80 : 180 + Math.random() * 160
        });
        saveState();
        closeModal("importNodeModal");
        renderRelations();
      });
      list.appendChild(row);
    });
}

function organizeMembers() {
  const org = state.relation.nodes.find((node) => node.id === selectedNodeId && node.sourceCategory === "factions");
  if (!org) return showToast("조직 노드를 선택해주세요.");
  const faction = findItem("factions", org.sourceId);
  const members = normalizeLinks(faction?.links || [])
    .filter((link) => link.category === "characters")
    .map((link) => state.relation.nodes.find((node) => node.sourceCategory === "characters" && node.sourceId === link.id))
    .filter(Boolean);
  if (!members.length) return showToast("조직과 연결된 캐릭터 노드가 없습니다.");
  members.forEach((node, index) => {
    node.x = org.x + 24 + (index % 2) * 170;
    node.y = org.y + 70 + Math.floor(index / 2) * 80;
  });
  saveState();
  renderRelations();
}

function exportData() {
  saveState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "setting-drawer.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      saveState();
      currentCategory = "all";
      render();
      showToast("가져왔습니다.");
    } catch {
      showToast("파일을 읽을 수 없습니다.");
    }
  };
  reader.readAsText(file);
}

function initEvents() {
  $("menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));
  $("drawerBackdrop").addEventListener("click", () => document.body.classList.remove("menu-open"));
  $("closeDrawerBtn").addEventListener("click", () => document.body.classList.remove("menu-open"));

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  document.querySelectorAll(".modal-bg").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });

  $("writeBtn").addEventListener("click", () => openCardModal());
  $("saveBtn").addEventListener("click", () => {
    saveState();
    showToast("저장했습니다.");
  });
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importData(file);
    event.target.value = "";
  });

  $("searchInput").addEventListener("input", render);
  $("sortSelect").addEventListener("change", render);
  $("emptyBox").addEventListener("click", () => openCardModal());

  $("cardCategory").addEventListener("change", () => {
    fillFolderSelect($("cardCategory").value, "");
    selectedLinks = readLinks();
    renderLinkPicker($("cardCategory").value, editingCard?.id || null);
  });
  $("saveCardBtn").addEventListener("click", saveCard);
  $("imageInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      formImage = reader.result;
      renderImagePreview();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  });
  $("removeImageBtn").addEventListener("click", () => {
    formImage = "";
    renderImagePreview();
  });

  $("editCardBtn").addEventListener("click", () => detailTarget && openCardModal(detailTarget.category, detailTarget.id));
  $("deleteCardBtn").addEventListener("click", () => detailTarget && deleteCard(detailTarget.category, detailTarget.id));
  $("pinCardBtn").addEventListener("click", () => {
    if (!detailTarget) return;
    togglePin(detailTarget.category, detailTarget.id);
    openDetail(detailTarget.category, detailTarget.id);
  });

  $("saveFolderBtn").addEventListener("click", saveFolder);
  $("deleteFolderBtn").addEventListener("click", deleteFolder);

  $("addTimelineBtn").addEventListener("click", () => openTimelineModal());
  $("editTimelineBtn").addEventListener("click", () => selectedTimelineId ? openTimelineModal(selectedTimelineId) : showToast("수정할 점을 선택해주세요."));
  $("deleteTimelineBtn").addEventListener("click", () => {
    if (!selectedTimelineId) return showToast("삭제할 점을 선택해주세요.");
    state.timeline = state.timeline.filter((item) => item.id !== selectedTimelineId);
    selectedTimelineId = null;
    saveState();
    renderTimeline();
  });
  $("saveTimelineBtn").addEventListener("click", saveTimeline);
  $("timelineBoard").addEventListener("click", (event) => {
    if (event.target === $("timelineBoard") || event.target.classList.contains("timeline-line")) {
      selectedTimelineId = null;
      renderTimeline();
    }
  });

  $("addNodeBtn").addEventListener("click", () => openNodeModal());
  $("saveNodeBtn").addEventListener("click", saveNode);
  $("importNodeBtn").addEventListener("click", openImportNodes);
  $("importSearch").addEventListener("input", renderImportList);
  $("importCategory").addEventListener("change", renderImportList);
  $("connectBtn").addEventListener("click", connectNodesNow);
  $("edgeNameBtn").addEventListener("click", () => {
    if (!selectedEdgeId) return showToast("선 하나를 선택해주세요.");
    const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
    $("edgeName").value = edge?.label || "";
    openModal("edgeModal");
  });
  $("saveEdgeBtn").addEventListener("click", saveEdgeName);
  $("deleteEdgeBtn").addEventListener("click", deleteSelectedEdge);
  $("deleteNodeBtn").addEventListener("click", deleteSelectedNode);
  $("organizeBtn").addEventListener("click", organizeMembers);
  $("relationBoard").addEventListener("click", (event) => {
    if (event.target === $("relationBoard") || event.target === $("relationSvg")) {
      selectedNodeId = null;
      selectedEdgeId = null;
      connectNodes = [];
      renderRelations();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.body.classList.remove("menu-open");
      document.querySelectorAll(".modal-bg.show").forEach((modal) => closeModal(modal.id));
    }
  });
}

function init() {
  fillCategorySelects();
  initEvents();
  render();
}

init();
