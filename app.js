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
  relations: "관계도",
  map: "지도"
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
  relations: "인물과 세력의 관계를 그립니다.",
  map: "기존 지도 이미지 위에 왕국, 도시, 유적을 표시하고 설정 문서와 연결합니다."
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
  },
  map: { image: "", pins: [] }
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
let selectedMapPinId = null;
let editingMapPinId = null;
let pendingMapPinPosition = null;
let selectedPolygonId = null;
let editingPolygonId = null;
let drawingPolygon = false;
let polygonDraft = [];
let mapZoom = 1;
let currentMapId = "";
let editingLineMode = false;
let addPointMode = false;
let moveRegionMode = false;
let quickPinMode = false;
let isMapPanning = false;
let mapPanStart = null;
let selectedVertexIndex = -1;

function $(id) {
  return document.getElementById(id);
}

function on(id, eventName, handler) {
  const el = $(id);
  if (!el) return;
  el.addEventListener(eventName, handler);
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
  if (!merged.maps && merged.map) {
    merged.maps = [{
      id: merged.map.id || uid(),
      name: merged.map.name || "기본 지도",
      image: merged.map.image || "",
      pins: Array.isArray(merged.map.pins) ? merged.map.pins : [],
      polygons: Array.isArray(merged.map.polygons) ? merged.map.polygons : []
    }];
    merged.currentMapId = merged.maps[0].id;
  }

  if (!Array.isArray(merged.maps) || merged.maps.length === 0) {
    merged.maps = [{ id: uid(), name: "기본 지도", image: "", pins: [], polygons: [] }];
  }

  merged.maps.forEach((map, index) => {
    map.id ??= uid();
    map.name ??= index === 0 ? "기본 지도" : `지도 ${index + 1}`;
    map.image ??= "";
    if (!Array.isArray(map.pins)) map.pins = [];
    if (!Array.isArray(map.polygons)) map.polygons = [];

    map.pins.forEach((pin) => {
      pin.x ??= 50;
      pin.y ??= 50;
      pin.type ??= "landmark";
      pin.title ??= "이름 없는 핀";
      pin.desc ??= "";
      pin.link ??= "";
    });

    map.polygons.forEach((poly) => {
      poly.points ??= [];
      poly.title ??= "영역";
      poly.type ??= "region";
      poly.color ??= "gold";
      poly.hex ??= polygonColorToHex(poly.color);
      poly.desc ??= "";
      poly.link ??= "";
      poly.closed ??= true;
    });
  });

  if (!merged.currentMapId || !merged.maps.some((map) => map.id === merged.currentMapId)) {
    merged.currentMapId = merged.maps[0].id;
  }

  merged.map = merged.maps.find((map) => map.id === merged.currentMapId) || merged.maps[0];

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
  else if (currentCategory === "map") renderMap();
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
          : key === "relations"
            ? state.relation.nodes.length
            : (state.maps?.length || 1);
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
  const listMode = currentCategory !== "timeline" && currentCategory !== "relations" && currentCategory !== "map";
  $("listTools").classList.toggle("hidden", !listMode);
  $("cardGrid").classList.toggle("hidden", !listMode);
  $("emptyBox").classList.toggle("hidden", !listMode);
  $("timelineView").classList.toggle("hidden", currentCategory !== "timeline");
  $("relationView").classList.toggle("hidden", currentCategory !== "relations");
  $("mapView").classList.toggle("hidden", currentCategory !== "map");
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
  board.querySelectorAll(".timeline-dot,.timeline-card,.timeline-year,.timeline-empty").forEach((el) => el.remove());
  state.timeline.forEach((point) => {
    point.dotX ??= 50;
    point.cardX ??= point.dotX;
    point.cardY ??= 35;

    const dot = document.createElement("div");
    dot.className = `timeline-dot ${selectedTimelineId === point.id ? "selected" : ""}`;
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
  board.querySelectorAll(".relation-node,.edge-label,.relation-legend,.relation-empty").forEach((el) => el.remove());
  svg.innerHTML = `
    <defs>
      <marker id="arrow-brown" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
        <path d="M0,0 L9,4.5 L0,9 Z" fill="rgba(92,64,36,.55)"></path>
      </marker>
      <marker id="arrow-red" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
        <path d="M0,0 L9,4.5 L0,9 Z" fill="rgba(162,77,67,.72)"></path>
      </marker>
    </defs>
  `;

  state.relation.edges = state.relation.edges.filter((edge) => {
    return state.relation.nodes.some((n) => n.id === edge.from)
      && state.relation.nodes.some((n) => n.id === edge.to);
  });

  const legend = document.createElement("div");
  legend.className = "relation-legend";
  legend.innerHTML = `
    <span><b class="legend-character"></b>캐릭터</span>
    <span><b class="legend-faction"></b>조직</span>
    <span><b class="legend-place"></b>지역</span>
    <span><b class="legend-ability"></b>능력</span>
    <span><b class="legend-event"></b>사건</span>
  `;
  board.appendChild(legend);

  if (!state.relation.nodes.length) {
    const empty = document.createElement("div");
    empty.className = "relation-empty";
    empty.innerHTML = `<strong>관계도가 비어 있습니다.</strong><span>카드 가져오기를 눌러 캐릭터와 조직을 배치해보세요.</span>`;
    board.appendChild(empty);
  }

  state.relation.nodes
    .slice()
    .sort((a, b) => Number(a.sourceCategory === "factions") - Number(b.sourceCategory === "factions"))
    .forEach((node) => {
      const source = node.sourceId ? findItem(node.sourceCategory, node.sourceId) : null;
      const title = source?.title || node.name || "이름 없음";
      const desc = source?.summary || source?.body || node.desc || "";
      const category = source ? node.sourceCategory : "custom";
      const isOrg = node.sourceCategory === "factions";

      if (isOrg) {
        node.x ??= 80;
        node.y ??= 70;
      }

      const el = document.createElement("div");
      el.className = [
        "relation-node",
        `node-${category}`,
        selectedNodeId === node.id ? "selected" : "",
        connectNodes.includes(node.id) ? "pick" : "",
        isOrg ? "organization" : ""
      ].join(" ").trim();

      el.dataset.id = node.id;
      el.style.left = `${node.x ?? 100}px`;
      el.style.top = `${node.y ?? 120}px`;

      el.innerHTML = isOrg
        ? `
          <div class="org-title">${escapeHTML(title)}</div>
          <span>${escapeHTML(desc || "조직 영역")}</span>
          <em>${categories[category] || "조직"}</em>
        `
        : `
          <i>${escapeHTML(categories[category] || "직접")}</i>
          <strong>${escapeHTML(title)}</strong>
          <span>${escapeHTML(desc || "설명 없음")}</span>
          <em>${source ? categories[category] : "직접 노드"}</em>
        `;

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
    svg.querySelectorAll("path:not(defs path)").forEach((path) => path.remove());
    board.querySelectorAll(".edge-label").forEach((label) => label.remove());
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
  const fromNode = state.relation.nodes.find((node) => node.id === edge.from);
  const toNode = state.relation.nodes.find((node) => node.id === edge.to);

  const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  const midX = edge.midX ?? ((from.x + to.x) / 2);
  const midY = edge.midY ?? ((from.y + to.y) / 2);

  const pathData = horizontal
    ? `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("marker-end", edge.label?.includes("적") || edge.label?.includes("원수") ? "url(#arrow-red)" : "url(#arrow-brown)");

  if (edge.label?.includes("적") || edge.label?.includes("원수")) {
    path.classList.add("hostile");
  }

  if (selectedEdgeId === edge.id) {
    path.classList.add("selected");
  }

  if (fromNode?.sourceCategory === "factions" || toNode?.sourceCategory === "factions") {
    path.classList.add("from-org");
  }

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
    label.className = edge.label.includes("적") || edge.label.includes("원수") ? "edge-label hostile" : "edge-label";
    label.textContent = edge.label;
    label.style.left = `${horizontal ? midX : (from.x + to.x) / 2}px`;
    label.style.top = `${horizontal ? (from.y + to.y) / 2 : midY}px`;
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



function ensureMaps() {
  if (!Array.isArray(state.maps) || state.maps.length === 0) {
    const legacy = state.map || {};
    state.maps = [{
      id: legacy.id || uid(),
      name: legacy.name || "기본 지도",
      image: legacy.image || "",
      pins: Array.isArray(legacy.pins) ? legacy.pins : [],
      polygons: Array.isArray(legacy.polygons) ? legacy.polygons : []
    }];
  }

  state.maps.forEach((map, index) => {
    map.id ||= uid();
    map.name ||= index === 0 ? "기본 지도" : `지도 ${index + 1}`;
    map.image ||= "";
    if (!Array.isArray(map.pins)) map.pins = [];
    if (!Array.isArray(map.polygons)) map.polygons = [];
  });

  if (!currentMapId) currentMapId = state.currentMapId || state.maps[0].id;
  if (!state.maps.some((map) => map.id === currentMapId)) {
    currentMapId = state.maps[0].id;
  }

  state.currentMapId = currentMapId;
  state.map = state.maps.find((map) => map.id === currentMapId) || state.maps[0];
  return state.maps;
}

function getActiveMap() {
  ensureMaps();
  return state.map;
}

function renderMapTabs() {
  const tabs = $("mapTabs");
  if (!tabs) return;

  const active = getActiveMap();
  tabs.innerHTML = "";

  state.maps.forEach((map) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = map.id === active.id ? "active" : "";
    button.textContent = map.name;
    button.title = "이 지도로 이동";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      currentMapId = map.id;
      state.currentMapId = map.id;
      state.map = map;

      selectedMapPinId = null;
      selectedPolygonId = null;
      selectedVertexIndex = -1;
      drawingPolygon = false;
      polygonDraft = [];
      editingLineMode = false;
      addPointMode = false;
      moveRegionMode = false;
    quickPinMode = false;
      quickPinMode = false;

      saveState();
      render();
    });
    tabs.appendChild(button);
  });
}

function addMap() {
  const defaultName = `지도 ${state.maps.length + 1}`;
  const name = prompt("새 지도 이름을 입력해주세요.", defaultName);
  if (!name) return;

  const map = {
    id: uid(),
    name: name.trim() || defaultName,
    image: "",
    pins: [],
    polygons: []
  };

  state.maps.push(map);
  currentMapId = map.id;
  state.currentMapId = map.id;
  state.map = map;

  selectedMapPinId = null;
  selectedPolygonId = null;
  selectedVertexIndex = -1;

  saveState();
  render();
}

function renameMap() {
  const map = getActiveMap();
  const name = prompt("지도 이름을 입력해주세요.", map.name);
  if (!name) return;

  map.name = name.trim() || map.name;
  saveState();
  render();
}

function deleteMap() {
  ensureMaps();

  if (state.maps.length <= 1) {
    showToast("지도는 최소 1개가 필요합니다.");
    return;
  }

  const map = getActiveMap();
  if (!confirm(`'${map.name}' 지도를 삭제할까요?`)) return;

  const deletedIndex = state.maps.findIndex((item) => item.id === map.id);
  state.maps = state.maps.filter((item) => item.id !== map.id);

  const nextIndex = Math.max(0, Math.min(deletedIndex, state.maps.length - 1));
  const nextMap = state.maps[nextIndex];

  currentMapId = nextMap.id;
  state.currentMapId = nextMap.id;
  state.map = nextMap;

  selectedMapPinId = null;
  selectedPolygonId = null;
  selectedVertexIndex = -1;
  drawingPolygon = false;
  polygonDraft = [];
  editingLineMode = false;
  addPointMode = false;
  moveRegionMode = false;
  quickPinMode = false;

  saveState();
  render();
}

function renderMap() {
  const map = getActiveMap();
  renderMapTabs();

  fillRegionLinkSelect();

  const image = $("mapImage");
  const empty = $("mapEmpty");
  const canvas = $("mapCanvas");
  const svg = $("mapSvg");

  canvas.querySelectorAll(".map-pin,.map-pin-card,.polygon-card,.polygon-point").forEach((el) => el.remove());
  svg.innerHTML = "";
  $("mapBoard").classList.toggle("map-drawing", drawingPolygon);
  $("mapBoard").classList.toggle("map-moving-region", moveRegionMode);
  $("mapBoard").classList.toggle("map-quick-pin", quickPinMode);

  canvas.style.transform = "none";

  canvas.style.transform = "none";
  canvas.style.width = `${mapZoom * 100}%`;
  canvas.style.height = `${mapZoom * 720}px`;
  const zoomLabel = $("zoomResetBtn");
  if (zoomLabel) zoomLabel.textContent = `${Math.round(mapZoom * 100)}%`;

  if (map.image) {
    image.src = map.image;
    image.classList.remove("hidden");
    empty.classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    empty.classList.remove("hidden");
  }

  map.polygons.forEach((poly) => drawPolygon(poly));

  if (drawingPolygon && polygonDraft.length) {
    drawDraftPolygon();
  }

  map.pins.forEach((pin) => {
    const el = document.createElement("button");
    el.className = `map-pin pin-${pin.type} ${selectedMapPinId === pin.id ? "selected" : ""}`;
    el.type = "button";
    el.style.left = `${pin.x}%`;
    el.style.top = `${pin.y}%`;
    el.title = pin.title;
    el.innerHTML = `<span></span>`;

    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (drawingPolygon) return;
      selectedMapPinId = pin.id;
      selectedPolygonId = null;
      renderMap();
    });

    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      if (drawingPolygon) return;
      openLinkedMapPin(pin);
    });

    dragMapPin(el, pin);
    canvas.appendChild(el);

    if (selectedMapPinId === pin.id && !drawingPolygon) {
      const card = document.createElement("div");
      card.className = "map-pin-card";
      card.style.left = `${Math.min(82, Math.max(6, pin.x + 2))}%`;
      card.style.top = `${Math.min(82, Math.max(6, pin.y + 2))}%`;

      const linked = parseMapLink(pin.link);
      const linkedItem = linked ? findItem(linked.category, linked.id) : null;

      card.innerHTML = `
        <small>${mapPinTypeName(pin.type)}</small>
        <strong>${escapeHTML(pin.title)}</strong>
        <p>${escapeHTML(pin.desc || linkedItem?.summary || "설명 없음")}</p>
        ${linkedItem ? `<button type="button" data-open-linked>연결 문서 열기</button>` : ""}
      `;

      const openButton = card.querySelector("[data-open-linked]");
      if (openButton) openButton.addEventListener("click", () => openDetail(linked.category, linked.id));
      canvas.appendChild(card);
    }
  });

  updateMapHint();
}


function drawPolygon(poly) {
  if (!poly.points || poly.points.length < 2) return;

  const svg = $("mapSvg");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", poly.closed === false ? "polyline" : "polygon");
  shape.setAttribute("points", poly.points.map((p) => `${p.x},${p.y}`).join(" "));
  shape.setAttribute("class", `map-region ${selectedPolygonId === poly.id ? "selected" : ""}`);
  applyPolygonColor(shape, poly);

  shape.addEventListener("click", (event) => {
    event.stopPropagation();
    if (drawingPolygon) return;
    selectedPolygonId = poly.id;
    selectedMapPinId = null;
    selectedVertexIndex = -1;

    if (addPointMode) {
      addPointToSelectedPolygon(event);
      return;
    }

    renderMap();
  });

  shape.addEventListener("pointerdown", (event) => {
    if (!moveRegionMode || selectedPolygonId !== poly.id || drawingPolygon) return;
    event.stopPropagation();
    dragWholePolygon(event, poly);
  });

  svg.appendChild(shape);

  if (selectedPolygonId === poly.id && editingLineMode) {
    poly.points.forEach((point, index) => {
      const handle = document.createElement("button");
      handle.className = `polygon-point edit-point ${selectedVertexIndex === index ? "selected" : ""}`;
      handle.type = "button";
      handle.style.left = `${point.x}%`;
      handle.style.top = `${point.y}%`;
      handle.title = "점을 드래그해서 선 수정";
      handle.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedVertexIndex = index;
        renderMap();
      });
      dragPolygonPoint(handle, poly, index);
      $("mapCanvas").appendChild(handle);
    });
  }
}

function drawDraftPolygon() {
  const svg = $("mapSvg");
  const tag = polygonDraft.length >= 3 ? "polygon" : "polyline";
  const draft = document.createElementNS("http://www.w3.org/2000/svg", tag);
  draft.setAttribute("points", polygonDraft.map((p) => `${p.x},${p.y}`).join(" "));
  draft.setAttribute("class", "map-region draft");
  draft.style.fill = hexToRgba(normalizeHexColor($("regionHexInput")?.value || "#d8b674"), 0.26);
  draft.style.stroke = "#ffffff";
  svg.appendChild(draft);

  polygonDraft.forEach((point) => {
    const handle = document.createElement("button");
    handle.className = "polygon-point draft-point";
    handle.type = "button";
    handle.style.left = `${point.x}%`;
    handle.style.top = `${point.y}%`;
    $("mapCanvas").appendChild(handle);
  });
}

function polygonCenter(points) {
  if (!points.length) return { x: 50, y: 50 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  };
}

function polygonTypeName(type) {
  return { country: "국가", border: "국경", region: "지역", sea: "바다", danger: "위험 지대" }[type] || "영역";
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return "#d8b674";
}

function hexToRgba(hex, alpha = 0.28) {
  const safe = normalizeHexColor(hex).slice(1);
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function polygonColorToHex(color) {
  return {
    gold: "#d8b674",
    blue: "#5a84c8",
    green: "#5a9b70",
    red: "#c86b5a",
    purple: "#9d76c9",
    gray: "#8a725c",
    custom: "#d8b674"
  }[color] || normalizeHexColor(color || "#d8b674");
}

function applyPolygonColor(shape, poly) {
  const hex = normalizeHexColor(poly.hex || polygonColorToHex(poly.color));
  shape.style.fill = hexToRgba(hex, 0.28);
  shape.style.stroke = "#ffffff";
}

function syncRegionColorInputs(hex) {
  const color = normalizeHexColor(hex);
  if ($("regionColorInput")) $("regionColorInput").value = color;
  if ($("regionHexInput")) $("regionHexInput").value = color;
}

function fillRegionLinkSelect() {
  const select = $("regionLinkSelect");
  if (!select) return;
  const previous = select.value;
  select.innerHTML = `<option value="">지역 카드 상속 없음</option>`;
  state.places.forEach((item) => {
    const option = new Option(`지역 · ${item.title}`, `places:${item.id}`);
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

function toggleLineDrawing() {
  if (!drawingPolygon) {
    drawingPolygon = true;
    polygonDraft = [];
    selectedPolygonId = null;
    selectedMapPinId = null;
    selectedVertexIndex = -1;
    editingLineMode = false;
    addPointMode = false;
    moveRegionMode = false;
    updateMapHint();
    renderMap();
    return;
  }

  completeLineDrawing();
}

function completeLineDrawing() {
  if (!drawingPolygon) return;

  if (polygonDraft.length < 3) {
    showToast("영역을 만들려면 점을 3개 이상 찍어주세요.");
    return;
  }

  const map = getActiveMap();
  const inheritedLink = $("regionLinkSelect")?.value || "";
  const inherited = parseMapLink(inheritedLink);
  const inheritedItem = inherited ? findItem(inherited.category, inherited.id) : null;
  const hex = normalizeHexColor($("regionHexInput")?.value || $("regionColorInput")?.value || "#d8b674");

  const region = {
    id: uid(),
    title: inheritedItem?.title || `영역 ${map.polygons.length + 1}`,
    type: "region",
    color: "custom",
    hex,
    desc: inheritedItem?.summary || "",
    link: inheritedLink,
    closed: true,
    points: polygonDraft.map((p) => ({ x: p.x, y: p.y }))
  };

  map.polygons.push(region);
  selectedPolygonId = region.id;
  drawingPolygon = false;
  polygonDraft = [];
  editingLineMode = false;
  addPointMode = false;
  moveRegionMode = false;
  saveState();
  updateMapHint();
  renderMap();
}

function deletePolygon() {
  if (!selectedPolygonId) return showToast("삭제할 영역을 선택해주세요.");
  const map = getActiveMap();
  map.polygons = map.polygons.filter((poly) => poly.id !== selectedPolygonId);
  selectedPolygonId = null;
  selectedVertexIndex = -1;
  editingLineMode = false;
  addPointMode = false;
  moveRegionMode = false;
  saveState();
  renderMap();
}

function toggleLineEdit() {
  if (!selectedPolygonId) {
    showToast("수정할 영역을 먼저 선택해주세요.");
    return;
  }

  editingLineMode = !editingLineMode;
  addPointMode = false;
  moveRegionMode = false;
  selectedVertexIndex = -1;
  updateMapHint();
  renderMap();
}

function toggleAddPointMode() {
  if (!selectedPolygonId) return showToast("점을 추가할 영역을 먼저 선택해주세요.");
  addPointMode = !addPointMode;
  editingLineMode = true;
  moveRegionMode = false;
  updateMapHint();
  renderMap();
}

function deleteSelectedPoint() {
  if (!selectedPolygonId) return showToast("영역을 먼저 선택해주세요.");
  const poly = getActiveMap().polygons.find((item) => item.id === selectedPolygonId);
  if (!poly) return;
  if (selectedVertexIndex < 0) return showToast("삭제할 점을 선택해주세요.");
  if (poly.points.length <= 3) return showToast("영역은 점 3개 이상이 필요합니다.");
  poly.points.splice(selectedVertexIndex, 1);
  selectedVertexIndex = -1;
  saveState();
  renderMap();
}

function toggleMoveRegionMode() {
  if (!selectedPolygonId) return showToast("이동할 영역을 먼저 선택해주세요.");
  moveRegionMode = !moveRegionMode;
  editingLineMode = false;
  addPointMode = false;
  selectedVertexIndex = -1;
  updateMapHint();
  renderMap();
}

function addPolygonPointFromEvent(event) {
  const rect = $("mapCanvas").getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  polygonDraft.push({ x, y });
  updateMapHint();
  renderMap();
}

function addPointToSelectedPolygon(event) {
  const poly = getActiveMap().polygons.find((item) => item.id === selectedPolygonId);
  if (!poly) return;
  const rect = $("mapCanvas").getBoundingClientRect();
  const point = {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
  };
  const index = findNearestSegmentIndex(poly.points, point);
  poly.points.splice(index + 1, 0, point);
  selectedVertexIndex = index + 1;
  saveState();
  renderMap();
}

function findNearestSegmentIndex(points, point) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const d = pointToSegmentDistance(point, a, b);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function undoPolygonPoint() {
  if (!drawingPolygon || polygonDraft.length === 0) return;
  polygonDraft.pop();
  renderMap();
}

function dragPolygonPoint(el, poly, index) {
  el.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    selectedVertexIndex = index;
    const rect = $("mapCanvas").getBoundingClientRect();
    el.setPointerCapture(event.pointerId);

    const move = (e) => {
      poly.points[index].x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      poly.points[index].y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      updatePolygonVisual(poly);
      el.style.left = `${poly.points[index].x}%`;
      el.style.top = `${poly.points[index].y}%`;
    };

    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      saveState();
      renderMap();
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function updatePolygonVisual(poly) {
  const shape = $("mapSvg").querySelector(`.map-region.selected`);
  if (shape) shape.setAttribute("points", poly.points.map((p) => `${p.x},${p.y}`).join(" "));
}

function dragWholePolygon(event, poly) {
  const rect = $("mapCanvas").getBoundingClientRect();
  const startX = ((event.clientX - rect.left) / rect.width) * 100;
  const startY = ((event.clientY - rect.top) / rect.height) * 100;
  const original = poly.points.map((p) => ({ x: p.x, y: p.y }));
  const svg = $("mapSvg");
  svg.setPointerCapture?.(event.pointerId);

  const move = (e) => {
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const dx = x - startX;
    const dy = y - startY;
    poly.points = original.map((p) => ({
      x: Math.max(0, Math.min(100, p.x + dx)),
      y: Math.max(0, Math.min(100, p.y + dy))
    }));
    updatePolygonVisual(poly);
  };

  const up = () => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", up);
    saveState();
    renderMap();
  };

  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
}

function updateMapHint() {
  if (!$("mapHint")) return;

  const drawButton = $("startPolygonBtn");
  const editButton = $("editLineBtn");
  const addButton = $("addPointBtn");
  const moveButton = $("moveRegionBtn");
  const pinButton = $("quickPinBtn");

  if (drawButton) drawButton.textContent = drawingPolygon ? "영역 완료" : "영역 그리기";
  if (editButton) editButton.textContent = editingLineMode ? "수정 끝" : "선 수정";
  if (addButton) addButton.textContent = addPointMode ? "점 추가 중" : "점 추가";
  if (moveButton) moveButton.textContent = moveRegionMode ? "이동 끝" : "영역 이동";
  if (pinButton) pinButton.textContent = quickPinMode ? "핀 찍는 중" : "핀 찍기";

  if (quickPinMode) {
    $("mapHint").textContent = "핀 찍기 중: 지도 위를 한 번 클릭하면 바로 핀이 생성됩니다. 지역 카드 상속을 선택하면 핀이 해당 카드와 바로 연결됩니다.";
  } else if (drawingPolygon) {
    $("mapHint").textContent = `영역 그리기 중: 점을 찍고 Enter 또는 영역 완료를 누르세요. Ctrl+Z로 방금 찍은 점을 취소할 수 있습니다. 현재 ${polygonDraft.length}개`;
  } else if (addPointMode) {
    $("mapHint").textContent = "점 추가 중: 선택한 영역의 선 위나 내부를 클릭하면 가장 가까운 선분 사이에 점이 추가됩니다.";
  } else if (editingLineMode) {
    $("mapHint").textContent = "선 수정 중: 꼭짓점을 드래그해서 국경 모양을 수정하세요. 점을 선택한 뒤 점 삭제도 가능합니다.";
  } else if (moveRegionMode) {
    $("mapHint").textContent = "영역 이동 중: 선택한 영역 안을 드래그하면 영역 전체가 이동합니다.";
  } else {
    $("mapHint").textContent = "HEX 색상과 지역 카드 상속을 선택한 뒤 영역을 그릴 수 있습니다. 확대/축소는 지도 안쪽 하단 바에서 조작합니다.";
  }
}

function zoomMap(delta, anchorEvent = null) {
  const board = $("mapBoard");
  const oldZoom = mapZoom;
  const nextZoom = Math.max(0.5, Math.min(3, Math.round((mapZoom + delta) * 10) / 10));
  if (nextZoom === oldZoom) return;

  let anchorX = board ? board.clientWidth / 2 : 0;
  let anchorY = board ? board.clientHeight / 2 : 0;

  if (anchorEvent && board) {
    const rect = board.getBoundingClientRect();
    anchorX = anchorEvent.clientX - rect.left;
    anchorY = anchorEvent.clientY - rect.top;
  }

  const beforeX = board ? (board.scrollLeft + anchorX) / oldZoom : 0;
  const beforeY = board ? (board.scrollTop + anchorY) / oldZoom : 0;

  mapZoom = nextZoom;
  renderMap();

  requestAnimationFrame(() => {
    if (!board) return;
    board.scrollLeft = beforeX * mapZoom - anchorX;
    board.scrollTop = beforeY * mapZoom - anchorY;
  });
}

function resetMapZoom() {
  mapZoom = 1;
  renderMap();
  requestAnimationFrame(() => {
    const board = $("mapBoard");
    if (!board) return;
    board.scrollLeft = 0;
    board.scrollTop = 0;
  });
}

function startMapPan(event) {
  if (drawingPolygon || editingLineMode || addPointMode || moveRegionMode) return;
  if (event.button !== 0 && event.button !== 1) return;

  const board = $("mapBoard");
  if (!board) return;

  const isBaseTarget = event.target === board
    || event.target === $("mapCanvas")
    || event.target === $("mapImage")
    || event.target === $("mapEmpty")
    || event.target === $("mapSvg");

  if (!isBaseTarget) return;

  event.preventDefault();
  isMapPanning = true;
  mapPanStart = {
    x: event.clientX,
    y: event.clientY,
    left: board.scrollLeft,
    top: board.scrollTop
  };
  board.classList.add("panning");
  board.setPointerCapture?.(event.pointerId);
}

function moveMapPan(event) {
  if (!isMapPanning || !mapPanStart) return;
  const board = $("mapBoard");
  if (!board) return;

  board.scrollLeft = mapPanStart.left - (event.clientX - mapPanStart.x);
  board.scrollTop = mapPanStart.top - (event.clientY - mapPanStart.y);
}

function endMapPan(event) {
  if (!isMapPanning) return;
  const board = $("mapBoard");
  isMapPanning = false;
  mapPanStart = null;
  if (board) {
    board.classList.remove("panning");
    board.releasePointerCapture?.(event.pointerId);
  }
}

function handleMapWheel(event) {
  const board = $("mapBoard");
  if (!board) return;

  if (event.ctrlKey || event.shiftKey || event.altKey) {
    event.preventDefault();
    zoomMap(event.deltaY < 0 ? 0.2 : -0.2, event);
    return;
  }

  event.preventDefault();
  zoomMap(event.deltaY < 0 ? 0.1 : -0.1, event);
}

function mapPinTypeName(type) {
  return { kingdom: "왕국", city: "도시", ruin: "유적", landmark: "장소", danger: "위험 지역" }[type] || "장소";
}

function parseMapLink(value) {
  if (!value) return null;
  const [category, id] = value.split(":");
  if (!category || !id) return null;
  return { category, id };
}

function fillMapPinLinkSelect(selected = "") {
  const select = $("mapPinLink");
  select.innerHTML = `<option value="">연결 없음</option>`;
  ["places", "factions", "events", "characters", "items", "abilities"].forEach((category) => {
    const group = document.createElement("optgroup");
    group.label = categories[category];
    state[category].forEach((item) => {
      const option = new Option(item.title, `${category}:${item.id}`);
      option.selected = option.value === selected;
      group.appendChild(option);
    });
    if (group.children.length) select.appendChild(group);
  });
}


function createInstantPinAt(x, y) {
  const linkValue = $("regionLinkSelect")?.value || "";
  const linked = parseMapLink(linkValue);
  const linkedItem = linked ? findItem(linked.category, linked.id) : null;

  const pin = {
    id: uid(),
    title: linkedItem?.title || `핀 ${getActiveMap().pins.length + 1}`,
    type: linked?.category === "factions" ? "kingdom" : linked?.category === "places" ? "city" : "landmark",
    desc: linkedItem?.summary || "",
    link: linkValue,
    x,
    y
  };

  getActiveMap().pins.push(pin);
  selectedMapPinId = pin.id;
  selectedPolygonId = null;
  saveState();
  renderMap();
}

function toggleQuickPinMode() {
  quickPinMode = !quickPinMode;
  drawingPolygon = false;
  polygonDraft = [];
  editingLineMode = false;
  addPointMode = false;
  moveRegionMode = false;
  updateMapHint();
  renderMap();
}

function openMapPinModal(id = null, position = null) {
  editingMapPinId = id;
  const pin = id ? getActiveMap().pins.find((item) => item.id === id) : null;
  pendingMapPinPosition = position;
  $("mapPinTitle").value = pin?.title || "";
  $("mapPinType").value = pin?.type || "landmark";
  $("mapPinDesc").value = pin?.desc || "";
  fillMapPinLinkSelect(pin?.link || "");
  openModal("mapPinModal");
}

function saveMapPin() {
  const title = $("mapPinTitle").value.trim();
  if (!title) return showToast("핀 이름을 적어주세요.");
  const data = { title, type: $("mapPinType").value, desc: $("mapPinDesc").value.trim(), link: $("mapPinLink").value };
  if (editingMapPinId) {
    const pin = getActiveMap().pins.find((item) => item.id === editingMapPinId);
    if (pin) Object.assign(pin, data);
  } else {
    const pos = pendingMapPinPosition || { x: 50, y: 50 };
    const pin = { id: uid(), ...data, x: pos.x, y: pos.y };
    getActiveMap().pins.push(pin);
    selectedMapPinId = pin.id;
  }
  pendingMapPinPosition = null;
  saveState();
  closeModal("mapPinModal");
  renderMap();
}

function deleteMapPin() {
  if (!selectedMapPinId) return showToast("삭제할 핀을 선택해주세요.");
  getActiveMap().pins = getActiveMap().pins.filter((pin) => pin.id !== selectedMapPinId);
  selectedMapPinId = null;
  saveState();
  renderMap();
}

function editMapPin() {
  if (!selectedMapPinId) return showToast("수정할 핀을 선택해주세요.");
  openMapPinModal(selectedMapPinId);
}

function openLinkedMapPin(pin) {
  const linked = parseMapLink(pin.link);
  if (!linked) return openMapPinModal(pin.id);
  openDetail(linked.category, linked.id);
}

function dragMapPin(el, pin) {
  el.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    const board = $("mapCanvas");
    const rect = board.getBoundingClientRect();
    let moved = false;
    el.setPointerCapture(event.pointerId);
    const move = (e) => {
      moved = true;
      pin.x = Math.max(1, Math.min(99, ((e.clientX - rect.left) / rect.width) * 100));
      pin.y = Math.max(1, Math.min(99, ((e.clientY - rect.top) / rect.height) * 100));
      el.style.left = `${pin.x}%`;
      el.style.top = `${pin.y}%`;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (moved) {
        selectedMapPinId = pin.id;
        saveState();
        renderMap();
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function setMapImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    getActiveMap().image = reader.result;
    saveState();
    renderMap();
  };
  reader.readAsDataURL(file);
}

function addMapPinFromBoard(event) {
  const board = $("mapCanvas");
  const rect = board.getBoundingClientRect();
  const x = Math.max(1, Math.min(99, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(1, Math.min(99, ((event.clientY - rect.top) / rect.height) * 100));
  createInstantPinAt(x, y);
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
  on("addMapBtn", "click", addMap);
  on("renameMapBtn", "click", renameMap);
  on("deleteMapBtn", "click", deleteMap);
  on("mapImageBtn", "click", () => $("mapImageInput").click());
  on("mapImageInput", "change", (event) => {
    setMapImage(event.target.files[0]);
    event.target.value = "";
  });
  on("addMapPinBtn", "click", () => openMapPinModal());
  on("editMapPinBtn", "click", editMapPin);
  on("deleteMapPinBtn", "click", deleteMapPin);
  on("saveMapPinBtn", "click", saveMapPin);
  on("zoomInBtn", "click", () => zoomMap(0.2));
  on("zoomOutBtn", "click", () => zoomMap(-0.2));
  on("zoomResetBtn", "click", resetMapZoom);
  on("regionColorInput", "input", (event) => {
    syncRegionColorInputs(event.target.value);
  });
  on("regionHexInput", "change", (event) => {
    syncRegionColorInputs(event.target.value);
  });
  on("quickPinBtn", "click", toggleQuickPinMode);
  on("startPolygonBtn", "click", toggleLineDrawing);
  on("editLineBtn", "click", toggleLineEdit);
  on("addPointBtn", "click", toggleAddPointMode);
  on("deletePointBtn", "click", deleteSelectedPoint);
  on("moveRegionBtn", "click", toggleMoveRegionMode);
  on("deleteLineBtn", "click", deletePolygon);
  on("mapBoard", "click", (event) => {
    const baseTarget = event.target === $("mapBoard") || event.target === $("mapCanvas") || event.target === $("mapImage") || event.target === $("mapEmpty") || event.target === $("mapSvg");
    if (isMapPanning) return;
    if (!baseTarget) return;

    if (quickPinMode) {
      const rect = $("mapCanvas").getBoundingClientRect();
      const x = Math.max(1, Math.min(99, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(1, Math.min(99, ((event.clientY - rect.top) / rect.height) * 100));
      createInstantPinAt(x, y);
      return;
    }

    if (drawingPolygon) {
      addPolygonPointFromEvent(event);
      return;
    }

    if (addPointMode && selectedPolygonId) {
      addPointToSelectedPolygon(event);
      return;
    }

    selectedMapPinId = null;
    selectedPolygonId = null;
    selectedVertexIndex = -1;
    editingLineMode = false;
    addPointMode = false;
    moveRegionMode = false;
    renderMap();
  });
  on("mapBoard", "dblclick", (event) => {
    const baseTarget = event.target === $("mapBoard") || event.target === $("mapCanvas") || event.target === $("mapImage") || event.target === $("mapEmpty") || event.target === $("mapSvg");
    if (baseTarget && !drawingPolygon) addMapPinFromBoard(event);
  });

  on("mapBoard", "pointerdown", startMapPan);
  on("mapBoard", "pointermove", moveMapPan);
  on("mapBoard", "pointerup", endMapPan);
  on("mapBoard", "pointercancel", endMapPan);
  on("mapBoard", "mouseleave", endMapPan);
  on("mapBoard", "wheel", handleMapWheel);

  $("relationBoard").addEventListener("click", (event) => {
    if (event.target === $("relationBoard") || event.target === $("relationSvg")) {
      selectedNodeId = null;
      selectedEdgeId = null;
      connectNodes = [];
      renderRelations();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && drawingPolygon) {
      event.preventDefault();
      undoPolygonPoint();
      return;
    }

    if (event.key === "Enter" && drawingPolygon) {
      event.preventDefault();
      completeLineDrawing();
      return;
    }

    if (event.key === "Escape" && drawingPolygon) {
      drawingPolygon = false;
      polygonDraft = [];
      updateMapHint();
      renderMap();
      return;
    }

    if (event.key === "Escape" && editingLineMode) {
      editingLineMode = false;
      updateMapHint();
      renderMap();
      return;
    }

    if (event.key === "Escape" && quickPinMode) {
      quickPinMode = false;
      updateMapHint();
      renderMap();
      return;
    }

    if (event.key === "Escape") {
      document.body.classList.remove("menu-open");
      document.querySelectorAll(".modal-bg.show").forEach((modal) => closeModal(modal.id));
    }

    if ((event.key === "Delete" || event.key === "Backspace") && currentCategory === "map" && selectedPolygonId) {
      if (editingLineMode && selectedVertexIndex >= 0) deleteSelectedPoint();
      else deletePolygon();
    }
  });
}

function init() {
  ensureMaps();
  currentMapId = state.currentMapId || state.maps[0].id;
  fillCategorySelects();
  initEvents();
  render();
}

init();
