const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "setting-drawer-stable-v1";

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

const dataCategories = [
  "characters",
  "places",
  "factions",
  "events",
  "items",
  "abilities"
];

const templates = {
  character: {
    name: "캐릭터",
    category: "characters",
    tags: "캐릭터",
    body: `이름:

나이:

성격:

원하는 것:

두려워하는 것:

관계:

숨기고 있는 것:

변화:`
  },
  place: {
    name: "지역",
    category: "places",
    tags: "지역",
    body: `이름:

환경:

분위기:

사는 사람들:

중요한 장소:

위험한 점:

관련 사건:`
  },
  faction: {
    name: "조직",
    category: "factions",
    tags: "조직",
    body: `이름:

사상:

지도자:

구성원:

목적:

전투 방식:

적대 관계:

비밀:`
  },
  event: {
    name: "사건",
    category: "events",
    tags: "사건",
    body: `이름:

발생 시점:

원인:

전개:

결과:

관련 인물:

남은 흔적:`
  },
  item: {
    name: "아이템",
    category: "items",
    tags: "아이템",
    body: `이름:

외형:

소유자:

기능:

기원:

사용 조건:

관련 사건:`
  },
  ability: {
    name: "능력",
    category: "abilities",
    tags: "능력",
    body: `이름:

사용자:

효과:

조건:

한계:

부작용:

약점:`
  }
};

const emptyFolders = {
  characters: [],
  places: [],
  factions: [],
  events: [],
  items: [],
  abilities: [],
  notes: []
};

const emptyState = {
  characters: [],
  places: [],
  factions: [],
  events: [],
  items: [],
  abilities: [],
  folders: structuredClone(emptyFolders),
  timelineMaps: [
    {
      id: "default-timeline",
      name: "기본 타임라인",
      points: []
    }
  ],
  activeTimelineMapId: "default-timeline",
  relationMaps: [
    {
      id: "default-map",
      name: "기본 관계도",
      nodes: [],
      edges: []
    }
  ],
  activeRelationMapId: "default-map"
};

let state = loadState();
let currentDrawerFileName = "";

let currentCategory = "all";
let currentFolderId = "";
let currentTag = "";
let editingCard = null;
let detailTarget = null;
let formImage = "";
let selectedLinks = [];

let editingFolderId = null;

let selectedTimelineId = null;
let editingTimelineId = null;
let editingTimelineMapId = null;
let pendingTimelineX = 50;
let pendingTimelineY = 50;
let pendingDotX = 50;

let editingNodeId = null;
let selectedNodeId = null;
let selectedEdgeId = null;
let connectMode = false;
let connectNodes = [];
let editingMapId = null;

let draggedCardId = null;
let draggedCardCategory = null;

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function now() {
  return new Date().toISOString();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(emptyState);
  }

  try {
    const data = JSON.parse(saved);

    Object.keys(emptyState).forEach((key) => {
      if (data[key] === undefined) data[key] = structuredClone(emptyState[key]);
    });

    if (data.timelinePoints && !data.timelineMaps) {
      data.timelineMaps = [
        {
          id: "default-timeline",
          name: "기본 타임라인",
          points: data.timelinePoints
        }
      ];
      data.activeTimelineMapId = "default-timeline";
      delete data.timelinePoints;
    }

    if (!data.timelineMaps || data.timelineMaps.length === 0) {
      data.timelineMaps = structuredClone(emptyState.timelineMaps);
      data.activeTimelineMapId = "default-timeline";
    }

    if (!data.activeTimelineMapId) {
      data.activeTimelineMapId = data.timelineMaps[0].id;
    }

    dataCategories.forEach((category) => {
      if (!data[category]) data[category] = [];
      if (!data.folders[category]) data.folders[category] = [];

      data[category].forEach((item, index) => {
        if (item.folderId === undefined) item.folderId = "";
        if (item.links === undefined) item.links = [];
        if (item.order === undefined) item.order = index;
      });
    });

    if (!data.relationMaps || data.relationMaps.length === 0) {
      data.relationMaps = structuredClone(emptyState.relationMaps);
      data.activeRelationMapId = "default-map";
    }

    return data;
  } catch {
    return structuredClone(emptyState);
  }
}

function saveState() {
  repairAllBidirectionalLinks();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateSaveText();
}

function updateSaveText(message = "") {
  const text = $("saveText");
  if (!text) return;

  const time = new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const fileText = currentDrawerFileName ? ` · ${currentDrawerFileName}` : "";
  text.textContent = message || `저장됨 · ${time}${fileText}`;
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");

  setTimeout(() => {
    $("toast").classList.remove("show");
  }, 1400);
}

function isDesktopApp() {
  return Boolean(window.settingDrawerFile);
}

async function saveDrawerFile(forceSaveAs = false) {
  saveState();

  if (!isDesktopApp()) {
    exportData();
    return;
  }

  const result = await window.settingDrawerFile.save(state, {
    forceSaveAs,
    suggestedName: "my-world.drawer"
  });

  if (result?.ok) {
    currentDrawerFileName = result.fileName || "";
    updateSaveText();
    showToast(forceSaveAs ? "다른 이름으로 저장했습니다." : "파일로 저장했습니다.");
  } else if (!result?.canceled) {
    showToast("파일 저장에 실패했습니다.");
  }
}

async function openDrawerFile() {
  if (!isDesktopApp()) {
    $("importFile").click();
    return;
  }

  const result = await window.settingDrawerFile.open();

  if (result?.ok) {
    state = normalizeImportedState(result.data);
    currentDrawerFileName = result.fileName || "";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    currentCategory = "all";
    currentFolderId = "";
    currentTag = "";
    render();
    updateSaveText("파일을 열었습니다" + (currentDrawerFileName ? ` · ${currentDrawerFileName}` : ""));
    showToast("파일을 열었습니다.");
  } else if (!result?.canceled) {
    showToast("파일을 열 수 없습니다.");
  }
}

function normalizeImportedState(data) {
  const merged = { ...structuredClone(emptyState), ...data };

  if (data.timelinePoints && !data.timelineMaps) {
    merged.timelineMaps = [
      {
        id: "default-timeline",
        name: "기본 타임라인",
        points: data.timelinePoints
      }
    ];
    merged.activeTimelineMapId = "default-timeline";
  }

  if (!merged.timelineMaps || merged.timelineMaps.length === 0) {
    merged.timelineMaps = structuredClone(emptyState.timelineMaps || []);
  }

  if (!merged.relationMaps || merged.relationMaps.length === 0) {
    merged.relationMaps = structuredClone(emptyState.relationMaps);
    merged.activeRelationMapId = "default-map";
  }

  if (!merged.folders) merged.folders = structuredClone(emptyFolders);

  dataCategories.forEach((category) => {
    if (!merged[category]) merged[category] = [];
    if (!merged.folders[category]) merged.folders[category] = [];

    merged[category].forEach((item, index) => {
      if (item.folderId === undefined) item.folderId = "";
      if (item.links === undefined) item.links = [];
      if (item.order === undefined) item.order = index;
    });
  });

  return merged;
}

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getItems() {
  const result = [];

  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      result.push({ ...item, category });
    });
  });

  return result;
}

function findItem(category, id) {
  return state[category]?.find((item) => item.id === id);
}

function getFolderName(category, folderId) {
  if (!folderId) return "폴더 없음";
  const folder = state.folders[category]?.find((item) => item.id === folderId);
  return folder ? folder.name : "삭제된 폴더";
}

function countCategory(category) {
  if (category === "all") {
    return getItems().filter((item) => !item.archived).length;
  }

  if (category === "timeline") {
    return getActiveTimeline().points.length;
  }

  if (category === "relations") {
    return state.relationMaps.length;
  }

  return state[category].filter((item) => !item.archived).length;
}

function getVisibleItems() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const archiveMode = $("viewSelect").value === "archive";

  let items = getItems();

  if (dataCategories.includes(currentCategory)) {
    items = items.filter((item) => item.category === currentCategory);
  }

  items = items.filter((item) => Boolean(item.archived) === archiveMode);

  if (dataCategories.includes(currentCategory) && currentFolderId) {
    if (currentFolderId === "__none") {
      items = items.filter((item) => !item.folderId);
    } else {
      items = items.filter((item) => item.folderId === currentFolderId);
    }
  }

  if (currentTag) {
    items = items.filter((item) => item.tags.includes(currentTag));
  }

  if (keyword) {
    items = items.filter((item) => {
      const text = [
        item.title,
        item.summary,
        item.body,
        item.dateText,
        item.tags.join(" "),
        getFolderName(item.category, item.folderId),
        categories[item.category]
      ].join(" ").toLowerCase();

      return text.includes(keyword);
    });
  }

  return sortItems(items);
}

function sortItems(items) {
  const mode = $("sortSelect").value;
  const copy = [...items];

  copy.sort((a, b) => {
    if (Number(b.pinned) !== Number(a.pinned)) {
      return Number(b.pinned) - Number(a.pinned);
    }

    if (mode === "title") {
      return (a.title || "").localeCompare(b.title || "", "ko");
    }

    if (mode === "created") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    if (mode === "updated") {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    }

    return (a.order ?? 0) - (b.order ?? 0);
  });

  return copy;
}

function render() {
  renderNav();
  renderFolders();
  renderTags();
  renderTitle();
  renderMain();
}

function renderNav() {
  $("nav").innerHTML = "";

  Object.keys(categories).forEach((category) => {
    const button = document.createElement("button");
    button.className = currentCategory === category ? "active" : "";
    button.innerHTML = `<span>${categories[category]}</span><span>${countCategory(category)}</span>`;

    button.addEventListener("click", () => {
      currentCategory = category;
      currentFolderId = "";
      currentTag = "";
      render();
    });

    $("nav").appendChild(button);
  });
}

function renderTitle() {
  if (currentCategory === "timeline") {
    $("pageTitle").textContent = "타임라인";
    const timeline = getActiveTimeline();
    $("pageDesc").textContent = `${timeline.name} · ${timeline.points.length}개의 점`;
    return;
  }

  if (currentCategory === "relations") {
    const map = getActiveMap();
    $("pageTitle").textContent = "관계도";
    $("pageDesc").textContent = `${map.name} · ${map.nodes.length}개의 노드, ${map.edges.length}개의 선`;
    return;
  }

  $("pageTitle").textContent = $("viewSelect").value === "archive" ? "보관함" : categories[currentCategory];

  let text = `${getVisibleItems().length}개의 설정`;

  if (dataCategories.includes(currentCategory) && currentFolderId) {
    text += ` · ${currentFolderId === "__none" ? "폴더 없음" : getFolderName(currentCategory, currentFolderId)}`;
  }

  $("pageDesc").textContent = text;
}

function renderFolders() {
  $("folderRow").innerHTML = "";

  if (!dataCategories.includes(currentCategory)) {
    $("folderRow").style.display = "none";
    return;
  }

  $("folderRow").style.display = "flex";

  const all = createPill("폴더 전체", !currentFolderId, () => {
    currentFolderId = "";
    render();
  });
  $("folderRow").appendChild(all);

  const none = createPill("폴더 없음", currentFolderId === "__none", () => {
    currentFolderId = "__none";
    render();
  });
  $("folderRow").appendChild(none);

  state.folders[currentCategory].forEach((folder) => {
    const count = state[currentCategory].filter((item) => !item.archived && item.folderId === folder.id).length;

    const button = createPill(`${folder.name} ${count}`, currentFolderId === folder.id, () => {
      currentFolderId = folder.id;
      render();
    });

    button.addEventListener("dblclick", () => openFolderModal(currentCategory, folder.id));

    $("folderRow").appendChild(button);
  });

  const add = createPill("폴더 추가", false, () => openFolderModal(currentCategory));
  $("folderRow").appendChild(add);

  if (currentFolderId && currentFolderId !== "__none") {
    const edit = createPill("현재 폴더 이름", false, () => openFolderModal(currentCategory, currentFolderId));
    $("folderRow").appendChild(edit);
  }
}

function renderTags() {
  $("tagRow").innerHTML = "";

  if (currentCategory === "timeline" || currentCategory === "relations") {
    $("tagRow").style.display = "none";
    return;
  }

  $("tagRow").style.display = "flex";

  const items = getVisibleItems();
  const tags = new Set();

  items.forEach((item) => {
    item.tags.forEach((tag) => tags.add(tag));
  });

  $("tagRow").appendChild(createPill("태그 전체", !currentTag, () => {
    currentTag = "";
    render();
  }));

  Array.from(tags).sort((a, b) => a.localeCompare(b, "ko")).forEach((tag) => {
    $("tagRow").appendChild(createPill(tag, currentTag === tag, () => {
      currentTag = tag;
      render();
    }));
  });
}

function createPill(text, active, onClick) {
  const button = document.createElement("button");
  button.className = "pill" + (active ? " active" : "");
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function renderMain() {
  const isTimeline = currentCategory === "timeline";
  const isRelation = currentCategory === "relations";

  $("cardGrid").style.display = isTimeline || isRelation ? "none" : "grid";
  $("timelineView").style.display = isTimeline ? "block" : "none";
  $("relationView").style.display = isRelation ? "block" : "none";
  $("listTools").style.display = isTimeline || isRelation ? "none" : "grid";
  $("emptyBox").style.display = "none";

  if (isTimeline) {
    renderTimeline();
    return;
  }

  if (isRelation) {
    renderRelations();
    return;
  }

  renderCards();
}

function renderCards() {
  const items = getVisibleItems();
  $("cardGrid").innerHTML = "";

  items.forEach((item) => {
    $("cardGrid").appendChild(createCard(item));
  });

  $("emptyBox").style.display = items.length === 0 ? "block" : "none";
}

function createCardRelationSummary(item) {
  const linked = normalizeLinks(item.links || [])
    .map((link) => {
      const target = findItem(link.category, link.id);
      return target ? { ...target, category: link.category } : null;
    })
    .filter(Boolean);

  let targets = [];
  let label = "";

  if (item.category === "factions") {
    targets = linked.filter((target) => target.category === "characters");
    label = "포함";
  } else if (item.category === "characters") {
    const factions = linked.filter((target) => target.category === "factions");
    const abilities = linked.filter((target) => target.category === "abilities");
    targets = [...factions, ...abilities];
    label = "연결";
  } else if (item.category === "abilities") {
    targets = linked.filter((target) => target.category === "characters");
    label = "사용";
  }

  if (!targets.length) return "";

  return `
    <div class="card-relations">
      <strong>${label}</strong>
      ${targets.slice(0, 4).map((target) => `<span>${escapeHTML(target.title)}</span>`).join("")}
      ${targets.length > 4 ? `<em>+${targets.length - 4}</em>` : ""}
    </div>
  `;
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "card" + (item.archived ? " archived" : "");
  card.draggable = canDragCards();
  card.dataset.id = item.id;
  card.dataset.category = item.category;

  card.addEventListener("dragstart", () => {
    if (!canDragCards()) return;
    draggedCardId = item.id;
    draggedCardCategory = item.category;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    draggedCardId = null;
    draggedCardCategory = null;
    document.querySelectorAll(".card").forEach((el) => el.classList.remove("dragging", "drop-target"));
  });

  card.addEventListener("dragover", (event) => {
    if (!canDragCards()) return;
    if (draggedCardCategory !== item.category) return;
    event.preventDefault();
    card.classList.add("drop-target");
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drop-target");
  });

  card.addEventListener("drop", (event) => {
    if (!canDragCards()) return;
    event.preventDefault();
    reorderCards(item.category, draggedCardId, item.id);
  });

  const image = item.image
    ? `<img src="${item.image}" alt="${escapeHTML(item.title)}">`
    : "이미지 없음";
  const relationSummary = createCardRelationSummary(item);

  card.innerHTML = `
    <div class="card-image">${image}</div>
    <h3>${escapeHTML(item.title || "제목 없음")}</h3>
    <div class="card-summary">${escapeHTML(item.summary || item.body || "내용 없음")}</div>
    ${relationSummary}
    <div class="tags">
      ${item.folderId ? `<span class="tag">${escapeHTML(getFolderName(item.category, item.folderId))}</span>` : ""}
      ${item.dateText ? `<span class="tag">${escapeHTML(item.dateText)}</span>` : ""}
      ${item.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
    </div>
    <div class="card-actions"></div>
  `;

  const actions = card.querySelector(".card-actions");

  actions.appendChild(actionButton("열기", "primary", () => openDetail(item.category, item.id)));
  actions.appendChild(actionButton("수정", "", () => openEditCard(item.category, item.id)));
  actions.appendChild(actionButton(item.pinned ? "고정 해제" : "고정", "", () => togglePin(item.category, item.id)));
  actions.appendChild(actionButton(item.archived ? "보관 해제" : "보관", "", () => toggleArchive(item.category, item.id)));
  actions.appendChild(actionButton("삭제", "danger", () => deleteCard(item.category, item.id)));

  return card;
}

function actionButton(text, className, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function canDragCards() {
  return dataCategories.includes(currentCategory)
    && $("viewSelect").value === "normal"
    && $("sortSelect").value === "manual"
    && !$("searchInput").value.trim()
    && !currentTag;
}

function reorderCards(category, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;

  const list = state[category];
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);

  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);

  list.forEach((item, index) => {
    item.order = index;
    item.updatedAt = now();
  });

  saveState();
  render();
}

function fillCategorySelects() {
  $("cardCategory").innerHTML = "";
  $("folderCategory").innerHTML = "";
  $("importCategory").innerHTML = `<option value="all">전체</option>`;

  dataCategories.forEach((category) => {
    const label = categories[category];

    $("cardCategory").appendChild(new Option(label, category));
    $("folderCategory").appendChild(new Option(label, category));
    $("importCategory").appendChild(new Option(label, category));
  });
}

function fillFolderSelect(category, selected = "") {
  $("cardFolder").innerHTML = "";
  $("cardFolder").appendChild(new Option("폴더 없음", ""));

  state.folders[category].forEach((folder) => {
    $("cardFolder").appendChild(new Option(folder.name, folder.id));
  });

  $("cardFolder").value = selected || "";
}

function openNewCard(category = null) {
  editingCard = null;
  formImage = "";
  selectedLinks = [];

  $("cardModalTitle").textContent = "새 설정";
  $("cardCategory").disabled = false;
  $("cardCategory").value = category || (dataCategories.includes(currentCategory) ? currentCategory : "characters");

  fillFolderSelect($("cardCategory").value, dataCategories.includes(currentCategory) ? currentFolderId : "");

  $("cardDate").value = "";
  $("cardTitle").value = "";
  $("cardSummary").value = "";
  $("cardBody").value = "";
  $("cardTags").value = "";
  renderImagePreview();
  renderLinkPicker();

  openModal("cardModal");
}

function openEditCard(category, id) {
  const item = findItem(category, id);
  if (!item) return;

  editingCard = { category, id };
  formImage = item.image || "";
  selectedLinks = item.links || [];

  $("cardModalTitle").textContent = "수정";
  $("cardCategory").disabled = true;
  $("cardCategory").value = category;
  fillFolderSelect(category, item.folderId || "");

  $("cardDate").value = item.dateText || "";
  $("cardTitle").value = item.title || "";
  $("cardSummary").value = item.summary || "";
  $("cardBody").value = item.body || "";
  $("cardTags").value = item.tags.join(", ");
  renderImagePreview();
  renderLinkPicker(category, id);

  closeModal("detailModal");
  openModal("cardModal");
}

function renderImagePreview() {
  $("imagePreview").innerHTML = formImage ? `<img src="${formImage}" alt="이미지">` : "이미지 없음";
}

function linkKey(link) {
  return `${link.category}:${link.id}`;
}

function isSameLink(a, b) {
  return a.category === b.category && a.id === b.id;
}

function normalizeLinks(links = []) {
  const seen = new Set();
  const result = [];

  links.forEach((link) => {
    if (!link || !link.category || !link.id) return;
    if (!state[link.category]) return;
    if (!findItem(link.category, link.id)) return;

    const key = linkKey(link);
    if (seen.has(key)) return;

    seen.add(key);
    result.push({ category: link.category, id: link.id });
  });

  return result;
}

function ensureLink(targetCategory, targetId, link) {
  const target = findItem(targetCategory, targetId);
  if (!target) return;

  target.links = normalizeLinks(target.links || []);

  if (!target.links.some((item) => isSameLink(item, link))) {
    target.links.push({ category: link.category, id: link.id });
    target.updatedAt = now();
  }
}

function removeLink(targetCategory, targetId, link) {
  const target = findItem(targetCategory, targetId);
  if (!target || !target.links) return;

  target.links = target.links.filter((item) => !isSameLink(item, link));
  target.updatedAt = now();
}

function syncBidirectionalLinks(sourceCategory, sourceId, nextLinks, prevLinks = []) {
  const sourceLink = { category: sourceCategory, id: sourceId };
  const next = normalizeLinks(nextLinks);
  const prev = normalizeLinks(prevLinks);

  next.forEach((link) => ensureLink(link.category, link.id, sourceLink));

  prev.forEach((oldLink) => {
    const stillLinked = next.some((newLink) => isSameLink(newLink, oldLink));
    if (!stillLinked) removeLink(oldLink.category, oldLink.id, sourceLink);
  });

  return next;
}

function repairAllBidirectionalLinks() {
  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      item.links = normalizeLinks(item.links || []);
    });
  });

  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      item.links.forEach((link) => {
        ensureLink(link.category, link.id, { category, id: item.id });
      });
    });
  });
}

function renderLinkPicker(editCategory = null, editId = null) {
  const box = $("linkPicker");
  box.innerHTML = "";

  const currentCategoryValue = editCategory || $("cardCategory").value;
  const items = getItems().filter((item) => !(item.category === editCategory && item.id === editId));

  if (items.length === 0) {
    box.innerHTML = `<span style="color: var(--muted)">연결할 설정이 없습니다.</span>`;
    return;
  }

  const guide = document.createElement("div");
  guide.className = "link-guide";

  if (currentCategoryValue === "factions") {
    guide.textContent = "조직에 포함될 캐릭터를 체크하면 캐릭터 카드에도 자동으로 소속 조직이 연결됩니다.";
  } else if (currentCategoryValue === "characters") {
    guide.textContent = "캐릭터와 조직, 능력을 연결하면 상대 카드에도 자동으로 연결됩니다.";
  } else if (currentCategoryValue === "abilities") {
    guide.textContent = "능력을 사용하는 캐릭터를 체크하면 캐릭터 카드에도 자동으로 능력이 연결됩니다.";
  } else {
    guide.textContent = "체크한 설정은 양방향으로 연결됩니다.";
  }

  box.appendChild(guide);

  const preferredOrder = currentCategoryValue === "factions"
    ? ["characters", "abilities", "places", "events", "items", "factions"]
    : currentCategoryValue === "characters"
      ? ["factions", "abilities", "characters", "places", "events", "items"]
      : currentCategoryValue === "abilities"
        ? ["characters", "factions", "abilities", "places", "events", "items"]
        : dataCategories;

  preferredOrder.forEach((category) => {
    const groupItems = items.filter((item) => item.category === category);
    if (groupItems.length === 0) return;

    const group = document.createElement("div");
    group.className = "link-group";

    const title = document.createElement("div");
    title.className = "link-group-title";

    if (currentCategoryValue === "factions" && category === "characters") {
      title.textContent = "포함 캐릭터";
    } else if (currentCategoryValue === "characters" && category === "factions") {
      title.textContent = "소속 조직";
    } else if (currentCategoryValue === "characters" && category === "abilities") {
      title.textContent = "보유 능력";
    } else if (currentCategoryValue === "abilities" && category === "characters") {
      title.textContent = "사용 캐릭터";
    } else {
      title.textContent = categories[category];
    }

    group.appendChild(title);

    groupItems.forEach((item) => {
      const value = `${item.category}:${item.id}`;
      const checked = selectedLinks.some((link) => link.category === item.category && link.id === item.id);

      const label = document.createElement("label");
      label.className = "link-option";
      label.innerHTML = `
        <input type="checkbox" value="${value}" ${checked ? "checked" : ""}>
        <span>${escapeHTML(item.title || "제목 없음")} · ${escapeHTML(categories[item.category])}</span>
      `;

      group.appendChild(label);
    });

    box.appendChild(group);
  });
}

function readLinks() {
  const links = Array.from($("linkPicker").querySelectorAll("input:checked")).map((input) => {
    const [category, id] = input.value.split(":");
    return { category, id };
  });

  return normalizeLinks(links);
}

function saveCard() {
  const category = $("cardCategory").value;
  const title = $("cardTitle").value.trim();

  if (!title) {
    showToast("제목을 적어주세요.");
    return;
  }

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

  if (data.tags.length === 0) data.tags = ["미분류"];

  if (editingCard) {
    const item = findItem(editingCard.category, editingCard.id);
    const prevLinks = normalizeLinks(item.links || []);

    Object.assign(item, data);
    item.links = syncBidirectionalLinks(editingCard.category, editingCard.id, data.links, prevLinks);
  } else {
    const id = uid();

    state[category].push({
      id,
      ...data,
      links: [],
      pinned: false,
      archived: false,
      order: state[category].length,
      createdAt: now()
    });

    const item = findItem(category, id);
    item.links = syncBidirectionalLinks(category, id, data.links, []);

    currentCategory = category;
    currentFolderId = data.folderId;
  }

  saveState();
  closeModal("cardModal");
  render();
}

function openDetail(category, id) {
  const item = findItem(category, id);
  if (!item) return;

  detailTarget = { category, id };

  $("detailTitle").textContent = item.title || "제목 없음";
  $("detailSummary").textContent = item.summary || "";
  $("detailBody").textContent = item.body || "내용 없음";
  $("detailCategory").textContent = categories[category];
  $("detailFolder").textContent = getFolderName(category, item.folderId);
  $("detailDate").textContent = item.dateText || "-";
  $("detailTags").textContent = item.tags.join(", ");
  $("detailPinBtn").textContent = item.pinned ? "고정 해제" : "고정";
  $("detailArchiveBtn").textContent = item.archived ? "보관 해제" : "보관";

  $("detailImage").innerHTML = item.image ? `<img src="${item.image}" alt="이미지">` : "이미지 없음";

  renderDetailLinks(item.links || []);

  openModal("detailModal");
}

function renderDetailLinks(item) {
  const box = $("detailLinks");
  box.innerHTML = "";

  const links = normalizeLinks(item.links || []);

  if (!links.length) {
    box.innerHTML = `<span style="color: var(--muted); font-size: 13px;">연결된 설정이 없습니다.</span>`;
    return;
  }

  const linkedItems = links
    .map((link) => {
      const target = findItem(link.category, link.id);
      return target ? { ...target, category: link.category } : null;
    })
    .filter(Boolean);

  function appendSection(title, items) {
    if (!items.length) return;

    const section = document.createElement("div");
    section.className = "detail-link-section";

    const h = document.createElement("h4");
    h.textContent = title;
    section.appendChild(h);

    const row = document.createElement("div");
    row.className = "detail-link-row";

    items.forEach((target) => {
      const button = document.createElement("button");
      button.className = "link-chip";
      button.textContent = `${target.title} · ${categories[target.category]}`;
      button.addEventListener("click", () => openDetail(target.category, target.id));
      row.appendChild(button);
    });

    section.appendChild(row);
    box.appendChild(section);
  }

  const shown = new Set();

  function mark(items) {
    items.forEach((target) => shown.add(`${target.category}:${target.id}`));
    return items;
  }

  if (detailTarget?.category === "factions") {
    appendSection("포함 캐릭터", mark(linkedItems.filter((target) => target.category === "characters")));
    appendSection("관련 능력", mark(linkedItems.filter((target) => target.category === "abilities")));
  }

  if (detailTarget?.category === "characters") {
    appendSection("소속 조직", mark(linkedItems.filter((target) => target.category === "factions")));
    appendSection("보유 능력", mark(linkedItems.filter((target) => target.category === "abilities")));
    appendSection("연결 캐릭터", mark(linkedItems.filter((target) => target.category === "characters")));
  }

  if (detailTarget?.category === "abilities") {
    appendSection("사용 캐릭터", mark(linkedItems.filter((target) => target.category === "characters")));
  }

  appendSection("기타 연결", linkedItems.filter((target) => !shown.has(`${target.category}:${target.id}`)));
}

function togglePin(category, id) {
  const item = findItem(category, id);
  if (!item) return;

  item.pinned = !item.pinned;
  item.updatedAt = now();

  saveState();
  render();
}

function toggleArchive(category, id) {
  const item = findItem(category, id);
  if (!item) return;

  item.archived = !item.archived;
  item.updatedAt = now();

  saveState();
  closeModal("detailModal");
  render();
}

function deleteCard(category, id) {
  const item = findItem(category, id);
  if (!item) return;

  if (!confirm(`'${item.title}' 설정을 삭제할까요?`)) return;

  state[category] = state[category].filter((target) => target.id !== id);

  dataCategories.forEach((cat) => {
    state[cat].forEach((target) => {
      target.links = target.links.filter((link) => !(link.category === category && link.id === id));
    });
  });

  state.relationMaps.forEach((map) => {
    const nodeIds = map.nodes
      .filter((node) => node.sourceCategory === category && node.sourceId === id)
      .map((node) => node.id);

    map.nodes = map.nodes.filter((node) => !(node.sourceCategory === category && node.sourceId === id));
    map.edges = map.edges.filter((edge) => !nodeIds.includes(edge.from) && !nodeIds.includes(edge.to));
  });

  saveState();
  closeModal("detailModal");
  render();
}

function openFolderModal(category = null, folderId = null) {
  editingFolderId = folderId;
  const targetCategory = category || (dataCategories.includes(currentCategory) ? currentCategory : "characters");

  $("folderCategory").value = targetCategory;

  if (folderId) {
    const folder = state.folders[targetCategory].find((item) => item.id === folderId);
    $("folderModalTitle").textContent = "폴더 수정";
    $("folderName").value = folder ? folder.name : "";
    $("deleteFolderBtn").style.display = "";
  } else {
    $("folderModalTitle").textContent = "폴더 추가";
    $("folderName").value = "";
    $("deleteFolderBtn").style.display = "none";
  }

  openModal("folderModal");
}

function saveFolder() {
  const category = $("folderCategory").value;
  const name = $("folderName").value.trim();

  if (!name) {
    showToast("폴더 이름을 적어주세요.");
    return;
  }

  if (editingFolderId) {
    const folder = state.folders[category].find((item) => item.id === editingFolderId);
    if (folder) folder.name = name;
  } else {
    const folder = { id: uid(), name };
    state.folders[category].push(folder);

    if (currentCategory === category) {
      currentFolderId = folder.id;
    }
  }

  saveState();
  closeModal("folderModal");
  render();
}

function deleteFolder() {
  const category = $("folderCategory").value;

  if (!editingFolderId) return;

  const folder = state.folders[category].find((item) => item.id === editingFolderId);

  if (!folder) return;
  if (!confirm(`'${folder.name}' 폴더를 삭제할까요? 설정은 삭제되지 않습니다.`)) return;

  state.folders[category] = state.folders[category].filter((item) => item.id !== editingFolderId);

  state[category].forEach((item) => {
    if (item.folderId === editingFolderId) item.folderId = "";
  });

  currentFolderId = "";
  saveState();
  closeModal("folderModal");
  render();
}

function renderTemplates() {
  $("templateList").innerHTML = "";

  Object.keys(templates).forEach((key) => {
    const template = templates[key];

    const button = document.createElement("button");
    button.className = "template-card";
    button.innerHTML = `<strong>${template.name}</strong><span>${template.tags}</span>`;

    button.addEventListener("click", () => {
      closeModal("templateModal");
      openNewCard(template.category);
      $("cardBody").value = template.body;
      $("cardTags").value = template.tags;
    });

    $("templateList").appendChild(button);
  });
}

function saveQuickMemo() {
  const text = $("quickInput").value.trim();

  if (!text) {
    showToast("설정을 적어주세요.");
    return;
  }

  state.notes.push({
    id: uid(),
    title: text.slice(0, 28),
    summary: text,
    body: text,
    dateText: "",
    folderId: "",
    tags: ["빠른설정"],
    links: [],
    image: "",
    pinned: false,
    archived: false,
    order: state.notes.length,
    createdAt: now(),
    updatedAt: now()
  });

  $("quickInput").value = "";
  currentCategory = "notes";

  saveState();
  render();
}


function getActiveTimeline() {
  let timeline = state.timelineMaps.find((item) => item.id === state.activeTimelineMapId);

  if (!timeline) {
    timeline = state.timelineMaps[0];
    state.activeTimelineMapId = timeline.id;
  }

  return timeline;
}

function renderTimelineTabs() {
  const box = $("timelineTabs");
  box.innerHTML = "";

  state.timelineMaps.forEach((timeline) => {
    const button = document.createElement("button");
    button.textContent = timeline.name;
    button.className = timeline.id === state.activeTimelineMapId ? "active" : "";

    button.addEventListener("click", () => {
      state.activeTimelineMapId = timeline.id;
      selectedTimelineId = null;
      saveState();
      render();
    });

    button.addEventListener("dblclick", () => openTimelineMapModal(timeline.id));

    box.appendChild(button);
  });

  box.appendChild(actionButton("탭 추가", "primary", () => openTimelineMapModal()));
  box.appendChild(actionButton("탭 이름", "", () => openTimelineMapModal(state.activeTimelineMapId)));
  box.appendChild(actionButton("탭 삭제", "danger", deleteActiveTimelineMap));
}

function openTimelineMapModal(id = null) {
  editingTimelineMapId = id;

  if (id) {
    const timeline = state.timelineMaps.find((item) => item.id === id);
    $("timelineMapModalTitle").textContent = "타임라인 탭 수정";
    $("timelineMapName").value = timeline ? timeline.name : "";
  } else {
    $("timelineMapModalTitle").textContent = "타임라인 탭 추가";
    $("timelineMapName").value = "";
  }

  openModal("timelineMapModal");
}

function saveTimelineMap() {
  const name = $("timelineMapName").value.trim();

  if (!name) {
    showToast("이름을 적어주세요.");
    return;
  }

  if (editingTimelineMapId) {
    const timeline = state.timelineMaps.find((item) => item.id === editingTimelineMapId);
    if (timeline) timeline.name = name;
  } else {
    const id = uid();
    state.timelineMaps.push({ id, name, points: [] });
    state.activeTimelineMapId = id;
  }

  saveState();
  closeModal("timelineMapModal");
  render();
}

function deleteActiveTimelineMap() {
  if (state.timelineMaps.length <= 1) {
    showToast("타임라인 탭은 하나 이상 필요합니다.");
    return;
  }

  const timeline = getActiveTimeline();

  if (!confirm(`'${timeline.name}' 타임라인 탭을 삭제할까요?`)) return;

  state.timelineMaps = state.timelineMaps.filter((item) => item.id !== timeline.id);
  state.activeTimelineMapId = state.timelineMaps[0].id;
  selectedTimelineId = null;

  saveState();
  render();
}

function renderTimeline() {
  const board = $("timelineBoard");
  const svg = $("timelineSvg");
  const timeline = getActiveTimeline();

  board.querySelectorAll(".timeline-dot, .timeline-card").forEach((el) => el.remove());
  svg.innerHTML = "";
  renderTimelineTabs();

  $("emptyBox").style.display = "none";

  const boardRect = board.getBoundingClientRect();
  const width = boardRect.width || 1000;
  const height = boardRect.height || 500;
  const centerY = height / 2;

  timeline.points.forEach((point) => {
    normalizeTimelinePoint(point);

    const line = createTimelineLine(point, width, centerY, height);
    svg.appendChild(line);

    const dot = document.createElement("div");
    dot.className = "timeline-dot" + (selectedTimelineId === point.id ? " selected" : "");
    dot.style.left = `${point.dotX}%`;
    dot.style.top = "50%";
    dot.title = "선 위에서 좌우로 움직이는 점";
    dot.dataset.pointId = point.id;

    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTimelineId = point.id;
      renderTimeline();
    });

    makeTimelineDotDraggable(dot, point);
    board.appendChild(dot);

    const card = document.createElement("div");
    card.className = "timeline-card"
      + (point.locked ? " locked" : "")
      + (selectedTimelineId === point.id ? " selected" : "");
    card.style.left = `${point.cardX}%`;
    card.style.top = `${point.cardY}%`;
    card.dataset.pointId = point.id;

    card.innerHTML = `
      <strong>${escapeHTML(point.title || "이름 없음")}</strong>
      <span>${escapeHTML(point.desc || "설명 없음")}</span>
      ${point.locked ? "<em>고정됨</em>" : ""}
    `;

    card.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTimelineId = point.id;
      renderTimeline();
    });

    card.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      openTimelineModal(point.id);
    });

    makeTimelineCardDraggable(card, point);
    board.appendChild(card);
  });
}

function normalizeTimelinePoint(point) {
  if (point.dotX === undefined) point.dotX = point.x ?? 50;
  if (point.cardX === undefined) point.cardX = point.x ?? point.dotX ?? 50;
  if (point.cardY === undefined) point.cardY = point.y ?? 34;
}

function createTimelineLine(point, width, centerY, height) {
  const dotX = width * (point.dotX / 100);
  const cardX = width * (point.cardX / 100);
  const cardY = height * (point.cardY / 100);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", dotX);
  line.setAttribute("y1", centerY);
  line.setAttribute("x2", cardX);
  line.setAttribute("y2", cardY);

  return line;
}

function updateTimelineVisual(point, dotEl = null, cardEl = null) {
  const board = $("timelineBoard");
  const svg = $("timelineSvg");
  const timeline = getActiveTimeline();
  const rect = board.getBoundingClientRect();
  const width = rect.width || 1000;
  const height = rect.height || 500;
  const centerY = height / 2;

  svg.innerHTML = "";

  timeline.points.forEach((target) => {
    normalizeTimelinePoint(target);
    svg.appendChild(createTimelineLine(target, width, centerY, height));
  });

  if (dotEl) {
    dotEl.style.left = `${point.dotX}%`;
    dotEl.style.top = "50%";
  }

  if (cardEl) {
    cardEl.style.left = `${point.cardX}%`;
    cardEl.style.top = `${point.cardY}%`;
  }
}

function makeTimelineDotDraggable(dot, point) {
  dot.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    selectedTimelineId = point.id;

    if (point.locked) {
      renderTimeline();
      return;
    }

    let dragging = true;
    dot.classList.add("dragging");
    dot.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      if (!dragging) return;

      const rect = $("timelineBoard").getBoundingClientRect();
      let x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      x = Math.max(6, Math.min(94, x));

      point.dotX = x;
      updateTimelineVisual(point, dot, null);
    };

    const up = () => {
      dragging = false;
      dot.classList.remove("dragging");
      dot.removeEventListener("pointermove", move);
      dot.removeEventListener("pointerup", up);
      saveState();
      renderTimeline();
    };

    dot.addEventListener("pointermove", move);
    dot.addEventListener("pointerup", up);
  });
}

function makeTimelineCardDraggable(card, point) {
  card.addEventListener("pointerdown", (event) => {
    event.stopPropagation();

    selectedTimelineId = point.id;

    if (point.locked) {
      renderTimeline();
      return;
    }

    const rect = $("timelineBoard").getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const offsetX = event.clientX - cardRect.left - cardRect.width / 2;
    const offsetY = event.clientY - cardRect.top - cardRect.height / 2;

    let dragging = true;
    card.classList.add("dragging");
    card.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      if (!dragging) return;

      let x = ((moveEvent.clientX - rect.left - offsetX) / rect.width) * 100;
      let y = ((moveEvent.clientY - rect.top - offsetY) / rect.height) * 100;

      x = Math.max(8, Math.min(92, x));
      y = Math.max(12, Math.min(88, y));

      point.cardX = x;
      point.cardY = y;

      updateTimelineVisual(point, null, card);
    };

    const up = () => {
      dragging = false;
      card.classList.remove("dragging");
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerup", up);
      saveState();
      renderTimeline();
    };

    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", up);
  });
}

function openTimelineModal(id = null, x = 50, y = 50) {
  editingTimelineId = id;

  if (id) {
    const point = getActiveTimeline().points.find((item) => item.id === id);
    if (!point) return;

    $("timelineModalTitle").textContent = "타임라인 점 수정";
    $("timelineTitle").value = point.title || "";
    $("timelineDesc").value = point.desc || "";
  } else {
    $("timelineModalTitle").textContent = "타임라인 점 추가";
    $("timelineTitle").value = "";
    $("timelineDesc").value = "";
    pendingDotX = x;
    pendingTimelineX = x;
    pendingTimelineY = y < 50 ? Math.max(12, y) : Math.min(88, y);
  }

  openModal("timelineModal");
}

function saveTimelinePoint() {
  const title = $("timelineTitle").value.trim();
  const desc = $("timelineDesc").value.trim();

  if (!title) {
    showToast("제목을 적어주세요.");
    return;
  }

  if (editingTimelineId) {
    const point = state.timelinePoints.find((item) => item.id === editingTimelineId);
    if (point) {
      point.title = title;
      point.desc = desc;
    }
  } else {
    getActiveTimeline().points.push({
      id: uid(),
      title,
      desc,
      dotX: pendingDotX,
      cardX: pendingTimelineX,
      cardY: pendingTimelineY,
      locked: false
    });
  }

  saveState();
  closeModal("timelineModal");
  render();
}

function getActiveMap() {
  let map = state.relationMaps.find((item) => item.id === state.activeRelationMapId);

  if (!map) {
    map = state.relationMaps[0];
    state.activeRelationMapId = map.id;
  }

  return map;
}

function renderRelations() {
  renderRelationTabs();

  const board = $("relationBoard");
  const svg = $("relationSvg");
  const map = getActiveMap();

  board.querySelectorAll(".relation-node, .edge-label").forEach((el) => el.remove());
  svg.innerHTML = "";

  map.edges = map.edges.filter((edge) => {
    return map.nodes.some((node) => node.id === edge.from)
      && map.nodes.some((node) => node.id === edge.to);
  });

  map.nodes.forEach((node) => {
    const source = node.sourceId ? findItem(node.sourceCategory, node.sourceId) : null;
    const title = source ? source.title : node.name || "이름 없음";
    const desc = source ? source.summary || source.body || "" : node.desc || "";
    const type = source ? categories[node.sourceCategory] : "직접 노드";

    const selected = selectedNodeId === node.id;
    const picked = connectNodes.includes(node.id);

    const el = document.createElement("div");
    el.className = "relation-node"
      + (node.sourceId ? " from-card" : "")
      + (selected ? " selected" : "")
      + (picked ? " connect-selected" : "");
    el.dataset.nodeId = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    el.innerHTML = `
      <strong>${escapeHTML(title || "이름 없음")}</strong>
      <span>${escapeHTML(desc || "설명 없음")}</span>
      <em>${escapeHTML(type)}</em>
    `;

    el.addEventListener("click", (event) => {
      event.stopPropagation();

      if (event.shiftKey) {
        toggleRelationPick(node.id);
        return;
      }

      selectedNodeId = selectedNodeId === node.id ? null : node.id;
      selectedEdgeId = null;
      renderRelations();
    });

    el.addEventListener("dblclick", (event) => {
      event.stopPropagation();

      if (node.sourceId) {
        openDetail(node.sourceCategory, node.sourceId);
      } else {
        openNodeModal(node.id);
      }
    });

    makeRelationNodeDraggable(el, node);
    board.appendChild(el);
  });

  requestAnimationFrame(updateRelationLinesOnly);
}

function toggleRelationPick(id) {
  selectedEdgeId = null;
  selectedNodeId = id;

  if (connectNodes.includes(id)) {
    connectNodes = connectNodes.filter((nodeId) => nodeId !== id);
  } else {
    if (connectNodes.length >= 2) {
      connectNodes = [];
    }

    connectNodes.push(id);
  }

  if (connectNodes.length === 1) {
    showToast("연결할 두 번째 노드를 Shift + 클릭하세요.");
  }

  if (connectNodes.length === 2) {
    showToast("선 연결을 누르면 관계 이름을 정할 수 있습니다.");
  }

  renderRelations();
}

function renderRelationTabs() {
  const box = $("relationTabs");
  box.innerHTML = "";

  state.relationMaps.forEach((map) => {
    const button = document.createElement("button");
    button.textContent = map.name;
    button.className = map.id === state.activeRelationMapId ? "primary" : "";

    button.addEventListener("click", () => {
      state.activeRelationMapId = map.id;
      selectedNodeId = null;
      selectedEdgeId = null;
      connectMode = false;
      saveState();
      render();
    });

    button.addEventListener("dblclick", () => openMapModal(map.id));

    box.appendChild(button);
  });

  box.appendChild(actionButton("탭 추가", "primary", () => openMapModal()));
  box.appendChild(actionButton("탭 이름", "", () => openMapModal(state.activeRelationMapId)));
  box.appendChild(actionButton("탭 삭제", "danger", deleteActiveMap));
}

function makeRelationNodeDraggable(el, node) {
  el.addEventListener("pointerdown", (event) => {
    if (event.shiftKey) return;

    event.stopPropagation();

    selectedNodeId = node.id;
    selectedEdgeId = null;

    let dragging = true;
    const rect = el.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    el.classList.add("dragging");
    el.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      if (!dragging) return;

      const boardRect = $("relationBoard").getBoundingClientRect();
      let x = moveEvent.clientX - boardRect.left - offsetX;
      let y = moveEvent.clientY - boardRect.top - offsetY;

      x = Math.max(10, Math.min(boardRect.width - el.offsetWidth - 10, x));
      y = Math.max(10, Math.min(boardRect.height - el.offsetHeight - 10, y));

      node.x = x;
      node.y = y;

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      updateRelationLinesOnly();
    };

    const up = (upEvent) => {
      dragging = false;

      try {
        el.releasePointerCapture(upEvent.pointerId);
      } catch {}

      el.classList.remove("dragging");
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);

      saveState();
      renderRelations();
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function updateRelationLinesOnly() {
  const board = $("relationBoard");
  const svg = $("relationSvg");
  const map = getActiveMap();

  svg.innerHTML = "";
  board.querySelectorAll(".edge-label").forEach((label) => label.remove());

  const boardRect = board.getBoundingClientRect();

  function getNodeCenter(id) {
    const el = board.querySelector(`.relation-node[data-node-id="${id}"]`);
    const node = map.nodes.find((item) => item.id === id);

    if (!el || !node) {
      return {
        x: (node?.x || 0) + 80,
        y: (node?.y || 0) + 28
      };
    }

    const rect = el.getBoundingClientRect();

    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    };
  }

  map.edges.forEach((edge) => {
    const from = getNodeCenter(edge.from);
    const to = getNodeCenter(edge.to);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.style.pointerEvents = "stroke";

    if (selectedEdgeId === edge.id) {
      line.classList.add("selected");
    }

    line.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedEdgeId = edge.id;
      selectedNodeId = null;
      connectNodes = [];
      renderRelations();
    });

    svg.appendChild(line);

    if (edge.label) {
      const label = document.createElement("div");
      label.className = "edge-label";
      label.textContent = edge.label;
      label.style.left = `${(from.x + to.x) / 2}px`;
      label.style.top = `${(from.y + to.y) / 2}px`;
      board.appendChild(label);
    }
  });
}

function openNodeModal(id = null) {
  editingNodeId = id;

  const map = getActiveMap();

  if (id) {
    const node = map.nodes.find((item) => item.id === id);
    if (!node) return;

    $("nodeModalTitle").textContent = "노드 수정";
    $("nodeName").value = node.name || "";
    $("nodeDesc").value = node.desc || "";
  } else {
    $("nodeModalTitle").textContent = "노드 추가";
    $("nodeName").value = "";
    $("nodeDesc").value = "";
  }

  openModal("nodeModal");
}

function saveNode() {
  const name = $("nodeName").value.trim();
  const desc = $("nodeDesc").value.trim();

  if (!name) {
    showToast("이름을 적어주세요.");
    return;
  }

  const map = getActiveMap();

  if (editingNodeId) {
    const node = map.nodes.find((item) => item.id === editingNodeId);
    if (node) {
      node.name = name;
      node.desc = desc;
    }
  } else {
    map.nodes.push({
      id: uid(),
      name,
      desc,
      x: 240 + Math.random() * 240,
      y: 150 + Math.random() * 200
    });
  }

  saveState();
  closeModal("nodeModal");
  render();
}

function selectNodeForConnect(id) {
  toggleRelationPick(id);
}

function connectPickedNodes() {
  if (connectNodes.length !== 2) {
    showToast("노드 2개를 Shift + 클릭으로 먼저 선택해주세요.");
    return;
  }

  const [from, to] = connectNodes;

  if (from === to) {
    showToast("서로 다른 노드 2개를 선택해주세요.");
    return;
  }

  const map = getActiveMap();
  const exists = map.edges.some((edge) => {
    return (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from);
  });

  if (exists) {
    showToast("이미 연결된 노드입니다.");
    connectNodes = [];
    renderRelations();
    return;
  }

  const edgeId = uid();
  map.edges.push({
    id: edgeId,
    from,
    to,
    label: ""
  });

  selectedEdgeId = edgeId;
  selectedNodeId = null;
  connectNodes = [];
  connectMode = false;

  saveState();
  $("edgeName").value = "";
  renderRelations();
  openModal("edgeModal");
}

function openMapModal(id = null) {
  editingMapId = id;

  if (id) {
    const map = state.relationMaps.find((item) => item.id === id);
    $("mapName").value = map ? map.name : "";
  } else {
    $("mapName").value = "";
  }

  openModal("mapModal");
}

function saveMap() {
  const name = $("mapName").value.trim();

  if (!name) {
    showToast("이름을 적어주세요.");
    return;
  }

  if (editingMapId) {
    const map = state.relationMaps.find((item) => item.id === editingMapId);
    if (map) map.name = name;
  } else {
    const id = uid();
    state.relationMaps.push({ id, name, nodes: [], edges: [] });
    state.activeRelationMapId = id;
  }

  saveState();
  closeModal("mapModal");
  render();
}

function deleteActiveMap() {
  if (state.relationMaps.length <= 1) {
    showToast("관계도 탭은 하나 이상 필요합니다.");
    return;
  }

  const map = getActiveMap();

  if (!confirm(`'${map.name}' 관계도 탭을 삭제할까요?`)) return;

  state.relationMaps = state.relationMaps.filter((item) => item.id !== map.id);
  state.activeRelationMapId = state.relationMaps[0].id;

  saveState();
  render();
}

function openImportCards() {
  $("importSearch").value = "";
  $("importCategory").value = "all";
  renderImportCards();
  openModal("importCardModal");
}

function renderImportCards() {
  const keyword = $("importSearch").value.trim().toLowerCase();
  const categoryFilter = $("importCategory").value;
  const map = getActiveMap();

  let items = getItems().filter((item) => !item.archived);

  if (categoryFilter !== "all") {
    items = items.filter((item) => item.category === categoryFilter);
  }

  if (keyword) {
    items = items.filter((item) => {
      return [item.title, item.summary, item.body, categories[item.category]]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }

  $("importList").innerHTML = "";

  items.forEach((item) => {
    const already = map.nodes.some((node) => node.sourceCategory === item.category && node.sourceId === item.id);

    const button = document.createElement("button");
    button.className = "import-card";
    button.disabled = already;
    button.innerHTML = `
      <strong>${escapeHTML(item.title || "제목 없음")}</strong>
      <span>${escapeHTML(categories[item.category])}${already ? " · 이미 있음" : ""}<br>${escapeHTML(item.summary || item.body || "")}</span>
    `;

    button.addEventListener("click", () => {
      map.nodes.push({
        id: uid(),
        name: item.title || "제목 없음",
        desc: item.summary || "",
        sourceCategory: item.category,
        sourceId: item.id,
        x: 240 + Math.random() * 300,
        y: 160 + Math.random() * 220
      });

      saveState();
      closeModal("importCardModal");
      render();
    });

    $("importList").appendChild(button);
  });
}

function saveEdgeName() {
  const map = getActiveMap();
  const edge = map.edges.find((item) => item.id === selectedEdgeId);

  if (!edge) {
    showToast("선을 선택해주세요.");
    return;
  }

  edge.label = $("edgeName").value.trim();

  saveState();
  closeModal("edgeModal");
  renderRelations();
}

function deleteSelectedEdge() {
  if (!selectedEdgeId) {
    showToast("삭제할 선을 선택해주세요.");
    return;
  }

  const map = getActiveMap();
  map.edges = map.edges.filter((edge) => edge.id !== selectedEdgeId);
  selectedEdgeId = null;

  saveState();
  renderRelations();
}

function deleteSelectedNode() {
  if (!selectedNodeId) {
    showToast("삭제할 노드를 선택해주세요.");
    return;
  }

  const map = getActiveMap();
  map.nodes = map.nodes.filter((node) => node.id !== selectedNodeId);
  map.edges = map.edges.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId);
  selectedNodeId = null;

  saveState();
  renderRelations();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });

  downloadBlob(blob, "setting-drawer.json");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = normalizeImportedState(data);

      saveState();
      currentCategory = "all";
      currentFolderId = "";
      currentTag = "";
      render();
      showToast("가져왔습니다.");
    } catch {
      showToast("파일을 읽을 수 없습니다.");
    }
  };

  reader.readAsText(file);
}

function clearAll() {
  if (!confirm("모든 설정과 관계도를 비울까요?")) return;

  state = structuredClone(emptyState);
  currentCategory = "all";
  currentFolderId = "";
  currentTag = "";

  saveState();
  render();
}

function initEvents() {
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  document.querySelectorAll(".modal-bg").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });

  $("newCardBtn").addEventListener("click", () => openNewCard());
  $("writeCardBtn").addEventListener("click", () => openNewCard());
  $("saveNowBtn").addEventListener("click", () => saveDrawerFile(false));
  $("templateBtn").addEventListener("click", () => openModal("templateModal"));
  $("exportBtn").addEventListener("click", () => saveDrawerFile(true));
  $("importBtn").addEventListener("click", openDrawerFile);
  $("clearBtn").addEventListener("click", clearAll);

  $("importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importData(file);
    event.target.value = "";
  });

  $("emptyBox").addEventListener("click", () => {
    if (currentCategory !== "timeline" && currentCategory !== "relations") openNewCard();
  });

  $("searchInput").addEventListener("input", render);
  $("sortSelect").addEventListener("change", render);
  $("viewSelect").addEventListener("change", render);

  $("cardCategory").addEventListener("change", () => {
    fillFolderSelect($("cardCategory").value, "");
    selectedLinks = readLinks();
    renderLinkPicker(editingCard?.category || null, editingCard?.id || null);
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

  $("detailEditBtn").addEventListener("click", () => {
    if (!detailTarget) return;
    openEditCard(detailTarget.category, detailTarget.id);
  });
  $("detailDeleteBtn").addEventListener("click", () => {
    if (!detailTarget) return;
    deleteCard(detailTarget.category, detailTarget.id);
  });
  $("detailPinBtn").addEventListener("click", () => {
    if (!detailTarget) return;
    togglePin(detailTarget.category, detailTarget.id);
    openDetail(detailTarget.category, detailTarget.id);
  });
  $("detailArchiveBtn").addEventListener("click", () => {
    if (!detailTarget) return;
    toggleArchive(detailTarget.category, detailTarget.id);
  });

  $("saveFolderBtn").addEventListener("click", saveFolder);
  $("deleteFolderBtn").addEventListener("click", deleteFolder);

  $("addTimelineBtn").addEventListener("click", () => openTimelineModal(null, 50, 50));
  $("editTimelineBtn").addEventListener("click", () => {
    if (!selectedTimelineId) {
      showToast("수정할 점을 선택해주세요.");
      return;
    }
    openTimelineModal(selectedTimelineId);
  });
  $("lockTimelineBtn").addEventListener("click", () => {
    if (!selectedTimelineId) {
      showToast("고정할 점을 선택해주세요.");
      return;
    }

    const point = getActiveTimeline().points.find((item) => item.id === selectedTimelineId);
    if (!point) return;

    point.locked = !point.locked;
    saveState();
    renderTimeline();
  });
  $("deleteTimelineBtn").addEventListener("click", () => {
    if (!selectedTimelineId) {
      showToast("삭제할 점을 선택해주세요.");
      return;
    }

    getActiveTimeline().points = getActiveTimeline().points.filter((item) => item.id !== selectedTimelineId);
    selectedTimelineId = null;
    saveState();
    render();
  });
  $("saveTimelineBtn").addEventListener("click", saveTimelinePoint);

  $("timelineBoard").addEventListener("click", (event) => {
    if (event.target.classList.contains("timeline-center-line")) {
      const rect = $("timelineBoard").getBoundingClientRect();
      const x = Math.max(6, Math.min(94, ((event.clientX - rect.left) / rect.width) * 100));
      const y = 34;

      openTimelineModal(null, x, y);
      return;
    }

    if (event.target === $("timelineBoard") || event.target === $("timelineSvg")) {
      selectedTimelineId = null;
      renderTimeline();
    }
  });

  $("saveTimelineMapBtn").addEventListener("click", saveTimelineMap);

  $("addRelationNodeBtn").addEventListener("click", () => openNodeModal());
  $("saveNodeBtn").addEventListener("click", saveNode);
  $("connectNodeBtn").addEventListener("click", connectPickedNodes);
  $("importCardNodeBtn").addEventListener("click", openImportCards);
  $("importSearch").addEventListener("input", renderImportCards);
  $("importCategory").addEventListener("change", renderImportCards);

  $("editEdgeBtn").addEventListener("click", () => {
    if (connectNodes.length === 2) {
      connectPickedNodes();
      return;
    }

    if (!selectedEdgeId) {
      showToast("이름을 붙일 선을 선택하거나, 노드 2개를 Shift + 클릭해주세요.");
      return;
    }

    const edge = getActiveMap().edges.find((item) => item.id === selectedEdgeId);
    $("edgeName").value = edge?.label || "";
    openModal("edgeModal");
  });
  $("saveEdgeBtn").addEventListener("click", saveEdgeName);
  $("deleteEdgeBtn").addEventListener("click", deleteSelectedEdge);
  $("deleteNodeBtn").addEventListener("click", deleteSelectedNode);

  $("saveMapBtn").addEventListener("click", saveMap);

  $("relationBoard").addEventListener("click", () => {
    selectedNodeId = null;
    selectedEdgeId = null;
    connectNodes = [];
    connectMode = false;
    renderRelations();
  });

  if (isDesktopApp()) {
    window.settingDrawerFile.onMenuSave(() => saveDrawerFile(false));
    window.settingDrawerFile.onMenuSaveAs(() => saveDrawerFile(true));
    window.settingDrawerFile.onMenuOpen(() => openDrawerFile());
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      [
        "cardModal",
        "detailModal",
        "folderModal",
        "templateModal",
        "timelineMapModal",
        "timelineModal",
        "nodeModal",
        "mapModal",
        "edgeModal",
        "importCardModal"
      ].forEach(closeModal);
    }
  });
}

function init() {
  fillCategorySelects();
  renderTemplates();
  updateSaveText();
  initEvents();
  render();
}

init();
