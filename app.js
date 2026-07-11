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
let sidebarPanel = "explorer";
let expandedCategories = new Set();
let expandedFolders = new Set();
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
let relationZoom = 1;
let relationPanX = 0;
let relationPanY = 0;
let isRelationPanning = false;
let relationPanStart = null;
let timelineZoom = 1;
let timelineCenter = Date.now();
let timelineSearchQuery = "";
let selectedMapPinId = null;
let editingMapPinId = null;
let pendingMapPinPosition = null;
let selectedPolygonId = null;
let editingPolygonId = null;
let drawingPolygon = false;
let polygonDraft = [];
let mapZoom = 1;
let mapPanX = 0;
let mapPanY = 0;
let currentMapId = "";
let editingLineMode = false;
let addPointMode = false;
let moveRegionMode = false;
let quickPinMode = false;
let currentToolPanel = "home";
let isMapPanning = false;
let mapPanStart = null;
let selectedVertexIndex = -1;

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

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
  merged.relation.edges.forEach((edge) => {
    edge.color ??= "#6d5038";
    edge.direction ??= "forward";
    edge.midX ??= null;
    edge.midY ??= null;
  });
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

function makeStorageSafeState(source) {
  const copy = JSON.parse(JSON.stringify(source));

  // localStorage 용량 초과 방지: 지도 배경 이미지는 큰 base64라 저장에서 제외합니다.
  // 현재 화면에는 그대로 보이지만, 새로고침 후에는 다시 배경 이미지를 넣어야 합니다.
  if (Array.isArray(copy.maps)) {
    copy.maps.forEach((map) => {
      if (map.image && map.image.length > 300000) {
        map.image = "";
      }
    });
  }

  if (copy.map && copy.map.image && copy.map.image.length > 300000) {
    copy.map.image = "";
  }

  return copy;
}

function saveState() {
  repairLinks();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeStorageSafeState(state)));
  } catch (error) {
    console.warn("저장 공간이 부족합니다. 이미지 없이 설정만 저장합니다.", error);

    try {
      const safeState = makeStorageSafeState(state);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
      showToast("이미지가 커서 설정만 저장했습니다.");
    } catch (secondError) {
      console.warn("설정 저장도 실패했습니다.", secondError);
      showToast("저장공간이 부족합니다. 브라우저 저장공간을 비워주세요.");
    }
  }
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
  try {
    renderSidebar();
    renderTitle();
    renderMainMode();
    renderFolders();
    renderTags();

    if (currentCategory === "timeline") renderTimeline();
    else if (currentCategory === "relations") renderRelations();
    else if (currentCategory === "map") renderMap();
    else renderCards();
  } catch (error) {
    console.error(error);
    showToast("화면을 그리는 중 오류가 발생했습니다.");
  }
}

function switchCategory(key) {
  currentCategory = key;
  currentFolderId = "";
  currentTag = "";
  selectedTimelineId = null;
  selectedNodeId = null;
  selectedEdgeId = null;
  connectNodes = [];
  detailTarget = null;
  if (dataCategories.includes(key)) expandedCategories.add(key);
  document.body.classList.remove("menu-open");
  render();
}

const chevronIcon = (open) => `<svg class="chev ${open ? "open" : ""}" viewBox="0 0 24 24" width="11" height="11"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const folderIcon = `<svg viewBox="0 0 24 24" width="13" height="13"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="currentColor"/></svg>`;
const fileIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 2h8l4 4v16H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 2v4h4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
const plusIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const viewIcons = {
  timeline: `<svg viewBox="0 0 24 24" width="13" height="13"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  relations: `<svg viewBox="0 0 24 24" width="13" height="13"><circle cx="6" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.2 7.2L11 16M15.8 7.2L13 16M8.6 6h6.8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  map: `<svg viewBox="0 0 24 24" width="13" height="13"><path d="M9 4l-6 2.2v14L9 18l6 2.2 6-2.2v-14L15 6.2 9 4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`
};
const fileAddIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 2h8l4 4v16H6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 2v4h4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 14.5h6M12 11.5v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const folderAddIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 11.5v5M9.5 14h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const trashIcon = `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function insertInlineInput(parentEl, iconHTML, placeholder, onSubmit) {
  const row = document.createElement("div");
  row.className = "explorer-row inline-input-row";
  row.innerHTML = `<span class="explorer-icon">${iconHTML}</span><input type="text" class="explorer-inline-input" placeholder="${placeholder}" />`;
  parentEl.appendChild(row);
  const input = row.querySelector("input");
  input.focus();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    row.remove();
    if (commit && value) onSubmit(value);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    else if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
}

function createFileIn(category, folderId) {
  const cleanTitle = "제목 없음";
  const id = uid();
  state[category].push({
    id,
    title: cleanTitle,
    summary: "",
    body: "",
    dateText: "",
    folderId: folderId || "",
    tags: ["미분류"],
    links: [],
    image: "",
    pinned: false,
    order: state[category].length,
    createdAt: now(),
    updatedAt: now()
  });
  saveState();
  currentCategory = category;
  currentFolderId = folderId || "";
  expandedCategories.add(category);
  if (folderId) expandedFolders.add(folderId);
  render();
  openDetail(category, id);
  requestAnimationFrame(() => {
    const titleInput = $("editorTitleInput");
    if (titleInput) { titleInput.select(); titleInput.focus(); }
  });
}

function createFolderIn(category, name) {
  const folder = { id: uid(), name };
  state.folders[category].push(folder);
  saveState();
  expandedCategories.add(category);
  renderSidebar();
}

function deleteFolderDirect(category, folderId) {
  if (!confirm("폴더를 삭제할까요? 안의 파일은 삭제되지 않고 폴더 밖으로 나갑니다.")) return;
  state.folders[category] = state.folders[category].filter((folder) => folder.id !== folderId);
  state[category].forEach((item) => {
    if (item.folderId === folderId) item.folderId = "";
  });
  if (currentFolderId === folderId) currentFolderId = "";
  expandedFolders.delete(folderId);
  saveState();
  render();
}

function createExplorerNoteRow(item, category) {
  const row = document.createElement("div");
  row.className = "explorer-row note-row";
  row.innerHTML = `
    <span class="explorer-icon file">${fileIcon}</span>
    <span class="explorer-label">${escapeHTML(item.title)}</span>
    <span class="explorer-actions">
      <button class="explorer-action" type="button" title="파일 삭제">${trashIcon}</button>
    </span>
  `;
  row.querySelector(".explorer-label").addEventListener("click", () => {
    currentCategory = category;
    render();
    openDetail(category, item.id);
  });
  row.querySelector(".explorer-action").addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCard(category, item.id);
  });
  return row;
}

function renderExplorerAll() {
  const row = $("explorerAllRow");
  const count = $("explorerAllCount");
  if (!row || !count) return;
  count.textContent = getAllItems().length;
  row.classList.toggle("active", currentCategory === "all");
}

function renderExplorerTree() {
  const tree = $("explorerTree");
  if (!tree) return;
  tree.innerHTML = "";

  dataCategories.forEach((category) => {
    const items = state[category];
    const isOpen = expandedCategories.has(category);

    const catRow = document.createElement("div");
    catRow.className = `explorer-row cat-row ${currentCategory === category ? "active" : ""}`;
    catRow.innerHTML = `
      <button class="chev-btn" type="button">${chevronIcon(isOpen)}</button>
      <span class="explorer-icon">${folderIcon}</span>
      <span class="explorer-label">${categories[category]}</span>
      <span class="explorer-count">${items.length}</span>
      <span class="explorer-actions">
        <button class="explorer-action" type="button" title="새 파일">${fileAddIcon}</button>
        <button class="explorer-action" type="button" title="새 폴더">${folderAddIcon}</button>
      </span>
    `;
    const [fileAddBtn, folderAddBtn] = catRow.querySelectorAll(".explorer-action");
    catRow.querySelector(".explorer-label").addEventListener("click", () => switchCategory(category));
    catRow.querySelector(".chev-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      if (expandedCategories.has(category)) expandedCategories.delete(category);
      else expandedCategories.add(category);
      renderExplorerTree();
    });
    fileAddBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      createFileIn(category, "");
    });
    folderAddBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      expandedCategories.add(category);
      if (!isOpen) renderExplorerTree();
      const wrap = tree.querySelector(`.explorer-children[data-category="${category}"]`);
      insertInlineInput(wrap || tree, folderAddIcon, "새 폴더 이름", (name) => createFolderIn(category, name));
    });
    tree.appendChild(catRow);

    if (!isOpen) return;

    const childWrap = document.createElement("div");
    childWrap.className = "explorer-children";
    childWrap.dataset.category = category;

    state.folders[category].forEach((folder) => {
      const folderItems = items.filter((item) => item.folderId === folder.id);
      const folderOpen = expandedFolders.has(folder.id);
      const folderRow = document.createElement("div");
      folderRow.className = `explorer-row folder-row ${currentCategory === category && currentFolderId === folder.id ? "active" : ""}`;
      folderRow.innerHTML = `
        <button class="chev-btn" type="button">${chevronIcon(folderOpen)}</button>
        <span class="explorer-icon">${folderIcon}</span>
        <span class="explorer-label">${escapeHTML(folder.name)}</span>
        <span class="explorer-count">${folderItems.length}</span>
        <span class="explorer-actions">
          <button class="explorer-action" type="button" title="새 파일">${fileAddIcon}</button>
          <button class="explorer-action" type="button" title="폴더 삭제">${trashIcon}</button>
        </span>
      `;
      const [folderFileAddBtn, folderDeleteBtn] = folderRow.querySelectorAll(".explorer-action");
      folderRow.querySelector(".explorer-label").addEventListener("click", () => {
        currentCategory = category;
        currentFolderId = folder.id;
        currentTag = "";
        expandedFolders.add(folder.id);
        render();
      });
      folderRow.querySelector(".chev-btn").addEventListener("click", (event) => {
        event.stopPropagation();
        if (expandedFolders.has(folder.id)) expandedFolders.delete(folder.id);
        else expandedFolders.add(folder.id);
        renderExplorerTree();
      });
      folderFileAddBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        createFileIn(category, folder.id);
      });
      folderDeleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteFolderDirect(category, folder.id);
      });
      childWrap.appendChild(folderRow);

      if (folderOpen) {
        folderItems.forEach((item) => childWrap.appendChild(createExplorerNoteRow(item, category)));
      }
    });

    items.filter((item) => !item.folderId).forEach((item) => {
      childWrap.appendChild(createExplorerNoteRow(item, category));
    });

    tree.appendChild(childWrap);
  });

  const sep = document.createElement("div");
  sep.className = "explorer-sep";
  tree.appendChild(sep);

  ["timeline", "relations", "map"].forEach((key) => {
    const row = document.createElement("div");
    row.className = `explorer-row view-row ${currentCategory === key ? "active" : ""}`;
    row.innerHTML = `<span class="explorer-icon">${viewIcons[key]}</span><span class="explorer-label">${categories[key]}</span>`;
    row.addEventListener("click", () => switchCategory(key));
    tree.appendChild(row);
  });
}

function renderSidebarSearch() {
  const input = $("sidebarSearchInput");
  const results = $("sidebarSearchResults");
  if (!input || !results) return;
  const keyword = input.value.trim().toLowerCase();
  results.innerHTML = "";
  if (!keyword) return;

  const matches = [];
  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      const haystack = [item.title, item.summary, item.body, item.tags.join(" ")].join(" ").toLowerCase();
      if (haystack.includes(keyword)) matches.push({ category, item });
    });
  });

  if (!matches.length) {
    results.innerHTML = `<div class="search-empty">검색 결과가 없습니다.</div>`;
    return;
  }

  matches.slice(0, 80).forEach(({ category, item }) => {
    const row = document.createElement("div");
    row.className = "search-result-row";
    row.innerHTML = `
      <span class="explorer-icon file">${fileIcon}</span>
      <span class="search-result-title">${escapeHTML(item.title)}</span>
      <span class="search-result-cat">${categories[category]}</span>
    `;
    row.addEventListener("click", () => {
      currentCategory = category;
      render();
      openDetail(category, item.id);
    });
    results.appendChild(row);
  });
}

function renderTagCloud() {
  const box = $("tagCloud");
  if (!box) return;
  box.innerHTML = "";

  const counts = new Map();
  dataCategories.forEach((category) => {
    state[category].forEach((item) => {
      item.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
  });

  if (!counts.size) {
    box.innerHTML = `<div class="search-empty">태그가 없습니다.</div>`;
    return;
  }

  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `tag-cloud-item ${currentTag === tag ? "active" : ""}`;
      row.innerHTML = `<span>#${escapeHTML(tag)}</span><span class="tag-cloud-count">${count}</span>`;
      row.addEventListener("click", () => {
        currentCategory = "all";
        currentTag = tag;
        render();
      });
      box.appendChild(row);
    });
}

function renderSidebar() {
  renderExplorerAll();
  renderExplorerTree();
  renderSidebarSearch();
  renderTagCloud();

  const titleEl = $("sidePanelTitle");
  if (titleEl) titleEl.textContent = sidebarPanel === "search" ? "검색" : sidebarPanel === "tags" ? "태그" : "탐색기";

  $("explorerPanel")?.classList.toggle("hidden", sidebarPanel !== "explorer");
  $("searchPanel")?.classList.toggle("hidden", sidebarPanel !== "search");
  $("tagsPanel")?.classList.toggle("hidden", sidebarPanel !== "tags");

  document.querySelectorAll(".rail-btn[data-panel]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panel === sidebarPanel);
  });
  document.querySelectorAll(".rail-btn[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === currentCategory);
  });
}

function renderTitle() {
  $("pageTitle").textContent = categories[currentCategory];
  $("pageDesc").textContent = categoryDesc[currentCategory];
  const tabLabel = $("pageTabLabel");
  if (tabLabel) tabLabel.textContent = categories[currentCategory];
}

function renderMainMode() {
  const specialView = currentCategory === "timeline" ? "timeline"
    : currentCategory === "relations" ? "relations"
    : currentCategory === "map" ? "map"
    : null;

  $("timelineView").classList.toggle("hidden", specialView !== "timeline");
  $("relationView").classList.toggle("hidden", specialView !== "relations");
  $("mapView").classList.toggle("hidden", specialView !== "map");

  if (specialView) {
    $("browseView")?.classList.add("hidden");
    $("editorView")?.classList.add("hidden");
  } else {
    renderEditor();
  }
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

  $("cardModalTitle").textContent = "속성";
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

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[\[(.+?)\]\]/g, '<span class="wikilink">$1</span>')
    .replace(/(^|\s)#([\w가-힣_-]+)/g, '$1<span class="md-tag">#$2</span>');
}

function renderMarkdownToHTML(markdown) {
  if (!markdown) return "";
  const lines = escapeHTML(markdown).split("\n");
  let html = "";
  let inList = false;
  let inQuote = false;

  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  const closeQuote = () => { if (inQuote) { html += "</blockquote>"; inQuote = false; } };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const listItem = line.match(/^[-*]\s+(.*)$/);
    const quote = line.match(/^&gt;\s?(.*)$/);

    if (heading) {
      closeList(); closeQuote();
      const level = Math.min(heading[1].length + 1, 4);
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
    } else if (listItem) {
      closeQuote();
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMarkdown(listItem[1])}</li>`;
    } else if (quote) {
      closeList();
      if (!inQuote) { html += "<blockquote>"; inQuote = true; }
      html += `<p>${inlineMarkdown(quote[1])}</p>`;
    } else if (line.trim() === "") {
      closeList(); closeQuote();
    } else {
      closeList(); closeQuote();
      html += `<p>${inlineMarkdown(line)}</p>`;
    }
  });
  closeList(); closeQuote();
  return html;
}

function openDetail(category, id) {
  const item = findItem(category, id);
  if (!item) return;
  detailTarget = { category, id };
  currentCategory = category;
  renderSidebar();
  renderEditor();
}

function closeEditor() {
  detailTarget = null;
  renderEditor();
}

function renderEditor() {
  const view = $("editorView");
  const browse = $("browseView");
  if (!view || !browse) return;

  const item = detailTarget ? findItem(detailTarget.category, detailTarget.id) : null;
  if (!item) {
    view.classList.add("hidden");
    browse.classList.remove("hidden");
    return;
  }

  browse.classList.add("hidden");
  view.classList.remove("hidden");

  const titleInput = $("editorTitleInput");
  if (titleInput && document.activeElement !== titleInput) titleInput.value = item.title || "";

  const metaBox = $("editorMeta");
  if (metaBox) {
    metaBox.innerHTML = `
      <span class="editor-meta-pill">${escapeHTML(categories[detailTarget.category] || detailTarget.category)}</span>
      ${item.dateText ? `<span class="editor-meta-pill">${escapeHTML(item.dateText)}</span>` : ""}
      ${(item.tags || []).map((tag) => `<span class="tag-pill">#${escapeHTML(tag)}</span>`).join("")}
    `;
  }

  const textarea = $("editorTextarea");
  if (textarea && document.activeElement !== textarea) textarea.value = item.body || "";

  const preview = $("editorPreview");
  if (preview && !preview.classList.contains("hidden")) {
    preview.innerHTML = item.body ? renderMarkdownToHTML(item.body) : "<p class=\"muted\">내용 없음</p>";
  }

  const pinBtn = $("editorPinBtn");
  if (pinBtn) pinBtn.textContent = item.pinned ? "고정 해제" : "고정";

  renderDetailLinks(item);
}

function renderDetailLinks(item) {
  const box = $("editorLinks");
  if (!box) return;
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
  if (detailTarget && detailTarget.category === category && detailTarget.id === id) detailTarget = null;
  saveState();
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

function timelineTimeOf(point) {
  if (!point) return null;
  if (point.date) {
    const t = new Date(point.date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (point.year) {
    const t = new Date(point.year).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function timelineRangeMs() {
  const baseRange = 4 * 365.25 * 24 * 60 * 60 * 1000; // ~4 years visible at 100%
  return baseRange / timelineZoom;
}

function timelineBounds() {
  const range = timelineRangeMs();
  const center = timelineCenter ?? Date.now();
  return { start: center - range / 2, end: center + range / 2, range };
}

function formatTimelineTick(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function formatTimelineFull(ms) {
  const d = new Date(ms);
  const hours = d.getHours();
  const ampm = hours < 12 ? "오전" : "오후";
  const hour12 = String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${ampm} ${hour12}:${minutes}`;
}

function renderTimeline() {
  const board = $("timelineBoard");
  const axis = $("timelineAxis");
  const eventsLayer = $("timelineEvents");
  const emptyBox = $("timelineEmpty");
  if (!board || !axis || !eventsLayer) return;

  axis.innerHTML = "";
  eventsLayer.innerHTML = "";

  const { start, range } = timelineBounds();
  const query = timelineSearchQuery.trim().toLowerCase();

  const tickCount = 6;
  for (let i = 0; i <= tickCount; i++) {
    const t = start + (range * i) / tickCount;
    const x = (i / tickCount) * 100;

    const gridline = document.createElement("div");
    gridline.className = "tl-gridline";
    gridline.style.left = `${x}%`;
    axis.appendChild(gridline);

    const label = document.createElement("div");
    label.className = "tl-tick-label";
    label.style.left = `${x}%`;
    label.textContent = formatTimelineTick(t);
    axis.appendChild(label);
  }

  const visiblePoints = state.timeline
    .map((point) => ({ point, time: timelineTimeOf(point) ?? Date.now() }))
    .filter(({ point }) => {
      if (!query) return true;
      return point.title.toLowerCase().includes(query) || (point.desc || "").toLowerCase().includes(query);
    })
    .sort((a, b) => a.time - b.time);

  visiblePoints.forEach(({ point, time }, index) => {
    const ratio = (time - start) / range;
    if (ratio < -0.03 || ratio > 1.03) return;
    const x = Math.min(100, Math.max(0, ratio * 100));
    const selected = selectedTimelineId === point.id;

    const dot = document.createElement("div");
    dot.className = `tl-dot ${selected ? "selected" : ""}`;
    dot.style.left = `${x}%`;
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedTimelineId = point.id;
      renderTimeline();
    });
    eventsLayer.appendChild(dot);

    const stem = document.createElement("div");
    stem.className = `tl-stem ${selected ? "selected" : ""}`;
    stem.style.left = `${x}%`;
    eventsLayer.appendChild(stem);

    const card = document.createElement("div");
    card.className = `tl-card ${selected ? "selected" : ""} ${index % 2 ? "row-b" : "row-a"}`;
    card.style.left = `${x}%`;
    card.innerHTML = `
      <strong>${escapeHTML(point.title)}</strong>
      <small>${escapeHTML(formatTimelineFull(time))}</small>
      ${point.year ? `<em>${escapeHTML(point.year)}</em>` : ""}
      ${point.desc ? `<span>${escapeHTML(point.desc)}</span>` : ""}
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
    eventsLayer.appendChild(card);
  });

  if (emptyBox) emptyBox.classList.toggle("hidden", state.timeline.length > 0);

  const countLabel = $("timelineCount");
  if (countLabel) countLabel.textContent = `${state.timeline.length}개`;

  const zoomLabel = $("timelineZoomResetBtn");
  if (zoomLabel) zoomLabel.textContent = `${Math.round(timelineZoom * 100)}%`;
}

function toDatetimeLocalValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openTimelineModal(id = null) {
  editingTimelineId = id;
  const point = state.timeline.find((item) => item.id === id);
  $("timelineTitle").value = point?.title || "";
  $("timelineDate").value = toDatetimeLocalValue(timelineTimeOf(point) ?? Date.now());
  $("timelineYear").value = point?.year || "";
  $("timelineDesc").value = point?.desc || "";
  openModal("timelineModal");
}

function saveTimeline() {
  const title = $("timelineTitle").value.trim();
  if (!title) return;
  const dateValue = $("timelineDate").value;
  const isoDate = dateValue ? new Date(dateValue).toISOString() : new Date().toISOString();

  if (editingTimelineId) {
    const point = state.timeline.find((item) => item.id === editingTimelineId);
    if (point) {
      point.title = title;
      point.date = isoDate;
      point.year = $("timelineYear").value.trim();
      point.desc = $("timelineDesc").value.trim();
    }
  } else {
    const point = {
      id: uid(),
      title,
      date: isoDate,
      year: $("timelineYear").value.trim(),
      desc: $("timelineDesc").value.trim()
    };
    state.timeline.push(point);
    selectedTimelineId = point.id;
    timelineCenter = new Date(isoDate).getTime();
  }
  saveState();
  closeModal("timelineModal");
  renderTimeline();
}

function importTimelineEvents() {
  const imported = new Set(state.timeline.map((point) => point.sourceId).filter(Boolean));
  const candidates = state.events.filter((event) => !imported.has(event.id));

  if (!candidates.length) {
    showToast("불러올 사건 카드가 없습니다.");
    return;
  }

  candidates.forEach((event, index) => {
    const parsed = event.dateText ? new Date(event.dateText) : null;
    const hasValidDate = parsed && !Number.isNaN(parsed.getTime());
    const fallbackTime = Date.now() + (state.timeline.length + index) * 7 * 24 * 60 * 60 * 1000;

    state.timeline.push({
      id: uid(),
      sourceCategory: "events",
      sourceId: event.id,
      title: event.title,
      date: (hasValidDate ? parsed : new Date(fallbackTime)).toISOString(),
      year: event.dateText || "",
      desc: event.summary || event.body || ""
    });
  });

  saveState();
  renderTimeline();
  showToast("사건 카드를 타임라인에 불러왔습니다.");
}

function zoomTimeline(delta) {
  const nextZoom = Math.max(0.4, Math.min(4, Math.round((timelineZoom + delta) * 10) / 10));
  if (nextZoom === timelineZoom) return;
  timelineZoom = nextZoom;
  renderTimeline();
}

function panTimeline(direction) {
  const { range } = timelineBounds();
  timelineCenter = (timelineCenter ?? Date.now()) + direction * range * 0.3;
  renderTimeline();
}

function resetTimelineZoom() {
  timelineZoom = 1;
  timelineCenter = Date.now();
  renderTimeline();
}

function handleTimelineWheel(event) {
  event.preventDefault();
  event.stopPropagation();
  zoomTimeline(event.deltaY < 0 ? 0.2 : -0.2);
}


function relationScreenToWorld(clientX, clientY) {
  const rect = $("relationBoard").getBoundingClientRect();
  return {
    x: (clientX - rect.left - relationPanX) / relationZoom,
    y: (clientY - rect.top - relationPanY) / relationZoom
  };
}

function applyRelationTransform() {
  const canvas = $("relationCanvas");
  if (canvas) canvas.style.setProperty("transform", `translate(${relationPanX}px, ${relationPanY}px) scale(${relationZoom})`, "important");
  const zoomLabel = $("relationZoomResetBtn");
  if (zoomLabel) zoomLabel.textContent = `${Math.round(relationZoom * 100)}%`;
}

function renderRelations() {
  const board = $("relationBoard");
  const canvas = $("relationCanvas");
  const svg = $("relationSvg");
  if (!board || !canvas || !svg) return;

  board.querySelectorAll(".relation-legend,.relation-empty").forEach((el) => el.remove());
  canvas.querySelectorAll(".relation-node,.edge-label,.edge-control-point").forEach((el) => el.remove());
  applyRelationTransform();

  svg.innerHTML = `
    <defs>
      <marker id="arrow-brown" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
        <path d="M0,0 L9,4.5 L0,9 Z" fill="rgba(92,64,36,.75)"></path>
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
    <span><b class="legend-character"></b>카드</span>
    <span><b class="legend-faction"></b>조직</span>
    <span><b class="legend-place"></b>지역</span>
    <span><b class="legend-ability"></b>능력</span>
    <span><b class="legend-event"></b>사건</span>
  `;
  board.appendChild(legend);

  if (!state.relation.nodes.length) {
    const empty = document.createElement("div");
    empty.className = "relation-empty";
    empty.innerHTML = `<strong>관계도가 비어 있습니다.</strong><span>카드 불러오기를 눌러 카드를 배치해보세요.</span>`;
    board.appendChild(empty);
  }

  state.relation.nodes
    .slice()
    .sort((a, b) => Number(b.sourceCategory === "factions") - Number(a.sourceCategory === "factions"))
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
          <em>${source ? categories[category] : "직접 카드"}</em>
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
      canvas.appendChild(el);
    });

  requestAnimationFrame(() => {
    svg.querySelectorAll("path:not(defs path)").forEach((path) => path.remove());
    canvas.querySelectorAll(".edge-label,.edge-control-point").forEach((label) => label.remove());
    state.relation.edges.forEach((edge) => drawEdge(edge));
  });
}

function nodeCenter(id) {
  const el = $("relationCanvas").querySelector(`[data-id="${id}"]`);
  const node = state.relation.nodes.find((item) => item.id === id);
  if (!el) return { x: (node?.x || 0) + 80, y: (node?.y || 0) + 28 };
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
}

function drawEdge(edge) {
  edge.color ??= "#6d5038";
  edge.direction ??= "forward";

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
  path.style.stroke = edge.color;

  if (edge.direction === "forward" || edge.direction === "both") {
    path.setAttribute("marker-end", "url(#arrow-brown)");
  }
  if (edge.direction === "back" || edge.direction === "both") {
    path.setAttribute("marker-start", "url(#arrow-brown)");
  }

  if (selectedEdgeId === edge.id) path.classList.add("selected");
  if (fromNode?.sourceCategory === "factions" || toNode?.sourceCategory === "factions") path.classList.add("from-org");

  path.addEventListener("click", (event) => {
    event.stopPropagation();
    selectedEdgeId = edge.id;
    selectedNodeId = null;
    connectNodes = [];
    syncEdgeControls(edge);
    renderRelations();
  });

  $("relationSvg").appendChild(path);

  if (edge.label) {
    const label = document.createElement("div");
    label.className = `edge-label ${selectedEdgeId === edge.id ? "selected" : ""}`;
    label.textContent = edge.label;
    label.style.left = `${horizontal ? midX : (from.x + to.x) / 2}px`;
    label.style.top = `${horizontal ? (from.y + to.y) / 2 : midY}px`;
    label.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedEdgeId = edge.id;
      syncEdgeControls(edge);
      renderRelations();
    });
    $("relationCanvas").appendChild(label);
  }

  if (selectedEdgeId === edge.id) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = "edge-control-point";
    control.style.left = `${horizontal ? midX : (from.x + to.x) / 2}px`;
    control.style.top = `${horizontal ? (from.y + to.y) / 2 : midY}px`;
    control.title = "드래그해서 선 꺾임 위치 수정";
    dragEdgeControl(control, edge, horizontal);
    $("relationCanvas").appendChild(control);
  }
}

function dragEdgeControl(control, edge, horizontal) {
  control.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    control.setPointerCapture(event.pointerId);

    const move = (e) => {
      const world = relationScreenToWorld(e.clientX, e.clientY);
      edge.midX = world.x;
      edge.midY = world.y;
      $("relationSvg").querySelectorAll("path:not(defs path)").forEach((path) => path.remove());
      $("relationCanvas").querySelectorAll(".edge-label,.edge-control-point").forEach((el) => el.remove());
      state.relation.edges.forEach((item) => drawEdge(item));
    };

    const up = () => {
      control.removeEventListener("pointermove", move);
      control.removeEventListener("pointerup", up);
      saveState();
      renderRelations();
    };

    control.addEventListener("pointermove", move);
    control.addEventListener("pointerup", up);
  });
}

function syncEdgeControls(edge) {
  if (!edge) return;
  const color = $("relEdgeColorInput");
  const direction = $("relEdgeDirectionSelect");
  if (color) color.value = edge.color || "#6d5038";
  if (direction) direction.value = edge.direction || "forward";
  if ($("edgeColor")) $("edgeColor").value = edge.color || "#6d5038";
  if ($("edgeDirection")) $("edgeDirection").value = edge.direction || "forward";
  if ($("edgeName")) $("edgeName").value = edge.label || "";
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
      node.x = Math.max(8, nodeX + (e.clientX - startX) / relationZoom);
      node.y = Math.max(8, nodeY + (e.clientY - startY) / relationZoom);
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;

      $("relationSvg").querySelectorAll("path:not(defs path)").forEach((path) => path.remove());
      $("relationCanvas").querySelectorAll(".edge-label,.edge-control-point").forEach((label) => label.remove());
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
  const edge = { id: uid(), from, to, label: "", color: $("relEdgeColorInput")?.value || "#6d5038", direction: $("relEdgeDirectionSelect")?.value || "forward" };
  state.relation.edges.push(edge);
  selectedEdgeId = edge.id;
  connectNodes = [];
  saveState();
  $("edgeName").value = "";
  syncEdgeControls(edge);
  renderRelations();
  openModal("edgeModal");
}

function saveEdgeName() {
  const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
  if (!edge) return;
  edge.label = $("edgeName").value.trim();
  edge.color = $("edgeColor")?.value || $("relEdgeColorInput")?.value || edge.color || "#6d5038";
  edge.direction = $("edgeDirection")?.value || $("relEdgeDirectionSelect")?.value || edge.direction || "forward";
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
    .filter((item) => !state.relation.nodes.some((node) => node.sourceCategory === item.category && node.sourceId === item.id))
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



function zoomRelation(delta, event = null) {
  const board = $("relationBoard");
  if (!board) return;
  const oldZoom = relationZoom;
  const nextZoom = Math.max(0.4, Math.min(3, Math.round((relationZoom + delta) * 10) / 10));
  if (nextZoom === oldZoom) return;

  const rect = board.getBoundingClientRect();
  const cursorX = event ? event.clientX - rect.left : rect.width / 2;
  const cursorY = event ? event.clientY - rect.top : rect.height / 2;

  const worldX = (cursorX - relationPanX) / oldZoom;
  const worldY = (cursorY - relationPanY) / oldZoom;

  relationZoom = nextZoom;
  relationPanX = cursorX - worldX * nextZoom;
  relationPanY = cursorY - worldY * nextZoom;

  applyRelationTransform();
}

function resetRelationZoom() {
  relationZoom = 1;
  relationPanX = 0;
  relationPanY = 0;
  applyRelationTransform();
}

function handleRelationWheel(event) {
  event.preventDefault();
  event.stopPropagation();
  zoomRelation(event.deltaY < 0 ? 0.1 : -0.1, event);
}


function startRelationPan(event) {
  if (event.button !== 0 && event.button !== 1) return;
  const board = $("relationBoard");
  const baseTarget = event.target === board || event.target === $("relationSvg") || event.target === $("relationCanvas");
  if (!baseTarget) return;

  event.preventDefault();
  isRelationPanning = true;
  relationPanStart = { x: event.clientX, y: event.clientY, panX: relationPanX, panY: relationPanY };
  board.classList.add("panning");
  board.setPointerCapture?.(event.pointerId);
}

function moveRelationPan(event) {
  if (!isRelationPanning || !relationPanStart) return;
  relationPanX = relationPanStart.panX + (event.clientX - relationPanStart.x);
  relationPanY = relationPanStart.panY + (event.clientY - relationPanStart.y);
  applyRelationTransform();
}

function endRelationPan(event) {
  if (!isRelationPanning) return;
  const board = $("relationBoard");
  isRelationPanning = false;
  relationPanStart = null;
  board?.classList.remove("panning");
  board?.releasePointerCapture?.(event.pointerId);
}

function applyEdgeToolbarValues() {
  const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
  if (!edge) return;
  edge.color = $("relEdgeColorInput")?.value || edge.color || "#6d5038";
  edge.direction = $("relEdgeDirectionSelect")?.value || edge.direction || "forward";
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


function getMapCanvasHeight(map, baseWidth) {
  const fallback = 420;
  const aspect = map?.imageAspect || 0;

  if (aspect && Number.isFinite(aspect)) {
    return Math.max(260, Math.round(baseWidth * aspect));
  }

  return fallback;
}

function rememberMapImageAspect(map, imageEl) {
  if (!map || !imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) return;
  map.imageAspect = imageEl.naturalHeight / imageEl.naturalWidth;
  saveState();
}


function applyMapTransform() {
  const canvas = $("mapCanvas");
  if (canvas) canvas.style.setProperty("transform", `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`, "important");
  const zoomLabel = $("zoomResetBtn");
  if (zoomLabel) zoomLabel.textContent = `${Math.round(mapZoom * 100)}%`;
}

function showEmptyMapCanvas() {
  const board = $("mapBoard");
  const canvas = $("mapCanvas");
  const image = $("mapImage");

  if (!board || !canvas) return;

  canvas.classList.remove("has-map-image");
  canvas.classList.add("no-map-image");

  board.style.height = "560px";
  board.style.minHeight = "560px";
  board.style.padding = "0";

  canvas.style.width = "100%";
  canvas.style.height = "560px";
  canvas.style.minHeight = "0px";
  canvas.style.marginLeft = "0px";
  canvas.style.marginRight = "0px";

  if (image) image.classList.add("hidden");

  applyMapTransform();
}


function fitMapToVisibleImage() {
  const board = $("mapBoard");
  const canvas = $("mapCanvas");
  const image = $("mapImage");
  const svg = $("mapSvg");

  if (!board || !canvas || !image || image.classList.contains("hidden")) {
    showEmptyMapCanvas();
    return;
  }

  if (!image.naturalWidth || !image.naturalHeight) {
    showEmptyMapCanvas();
    return;
  }

  canvas.classList.add("has-map-image");
  canvas.classList.remove("no-map-image");

  board.style.height = "560px";
  board.style.minHeight = "560px";
  board.style.padding = "0";

  // 캔버스 자체 크기는 항상 100% 배율 기준으로 고정하고,
  // 확대/축소는 transform(scale)만으로 처리합니다 (배경 이미지 포함 전체가 함께 확대됨).
  const baseWidth = board.clientWidth || canvas.clientWidth || 1000;
  const baseHeight = Math.max(1, Math.round(baseWidth * image.naturalHeight / image.naturalWidth));

  canvas.style.width = `${baseWidth}px`;
  canvas.style.height = `${baseHeight}px`;
  canvas.style.minHeight = "0px";
  canvas.style.marginLeft = "0";
  canvas.style.marginRight = "0";

  image.style.width = "100%";
  image.style.height = "100%";

  if (svg) {
    svg.style.width = "100%";
    svg.style.height = "100%";
  }

  applyMapTransform();
}

function renderMap() {
  const map = getActiveMap();
  renderMapTabs();

  fillRegionLinkSelect();

  const image = $("mapImage");
  const empty = $("mapEmpty");
  const canvas = $("mapCanvas");
  const svg = $("mapSvg");

  if (!canvas || !svg || !image || !empty) {
    console.warn("지도 UI 요소가 아직 준비되지 않았습니다.");
    return;
  }

  canvas.querySelectorAll(".map-pin,.map-pin-card,.polygon-card,.polygon-point").forEach((el) => el.remove());
  svg.innerHTML = "";
  $("mapBoard").classList.toggle("map-drawing", drawingPolygon);
  $("mapBoard").classList.toggle("map-moving-region", moveRegionMode);
  $("mapBoard").classList.toggle("map-quick-pin", quickPinMode);
  updateToolPanel();

  if (map.image) {
    image.onload = () => {
      if (typeof rememberMapImageAspect === "function") rememberMapImageAspect(map, image);
      image.classList.remove("hidden");
      empty.classList.add("hidden");
      fitMapToVisibleImage();
    };
    image.src = map.image;
    image.classList.remove("hidden");
    empty.classList.add("hidden");
    requestAnimationFrame(fitMapToVisibleImage);
    
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    empty.classList.remove("hidden");
    mapZoom = 1;
    mapPanX = 0;
    mapPanY = 0;
    showEmptyMapCanvas();
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
      currentToolPanel = "pin";
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
        <div class="mini-row">
          ${linkedItem ? `<button type="button" data-open-linked>카드 열기</button>` : ""}
          <button type="button" data-edit-pin>핀 수정</button>
          <button type="button" data-delete-pin>핀 삭제</button>
        </div>
      `;

      const openButton = card.querySelector("[data-open-linked]");
      if (openButton) openButton.addEventListener("click", () => openDetail(linked.category, linked.id));

      const editButton = card.querySelector("[data-edit-pin]");
      if (editButton) editButton.addEventListener("click", () => openMapPinModal(pin.id));

      const deleteButton = card.querySelector("[data-delete-pin]");
      if (deleteButton) deleteButton.addEventListener("click", deleteMapPin);

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

    updateToolPanel();

  if (quickPinMode) {
      const rect = $("mapCanvas").getBoundingClientRect();
      const x = Math.max(1, Math.min(99, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(1, Math.min(99, ((event.clientY - rect.top) / rect.height) * 100));
      createInstantPinAt(x, y);
      return;
    }

    if (drawingPolygon) return;
    selectedPolygonId = poly.id;
    selectedMapPinId = null;
    selectedVertexIndex = -1;
    currentToolPanel = "region";

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

  if (selectedPolygonId === poly.id) {
    syncRegionColorInputs(poly.hex || polygonColorToHex(poly.color));
    if ($("regionLinkSelect") && poly.link) $("regionLinkSelect").value = poly.link;
    renderPolygonCard(poly);
  }

  if (selectedPolygonId === poly.id && editingLineMode) {
    poly.points.forEach((point, index) => {
      const handle = document.createElement("button");
      handle.className = `polygon-point edit-point ${selectedVertexIndex === index ? "selected" : ""}`;
      handle.type = "button";
      handle.style.left = `${point.x}%`;
      handle.style.top = `${point.y}%`;
      handle.title = "점을 드래그해서 선 수정";
      handle.style.background = normalizeHexColor(poly.hex || polygonColorToHex(poly.color));
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


function renderPolygonCard(poly) {
  if (drawingPolygon || editingLineMode || addPointMode || moveRegionMode) return;

  const center = polygonCenter(poly.points || []);
  const linked = parseMapLink(poly.link);
  const linkedItem = linked ? findItem(linked.category, linked.id) : null;

  const card = document.createElement("div");
  card.className = "polygon-card map-pin-card";
  card.style.left = `${Math.min(82, Math.max(6, center.x + 2))}%`;
  card.style.top = `${Math.min(82, Math.max(6, center.y + 2))}%`;

  card.innerHTML = `
    <small>영역</small>
    <strong>${escapeHTML(poly.title || linkedItem?.title || "영역")}</strong>
    <p>${escapeHTML(poly.desc || linkedItem?.summary || "배정된 카드가 없습니다.")}</p>
    <div class="mini-row">
      ${linkedItem ? `<button type="button" data-open-region-card>카드 열기</button>` : ""}
      <button type="button" data-assign-region>영역 배정</button>
    </div>
  `;

  const openButton = card.querySelector("[data-open-region-card]");
  if (openButton && linked) {
    openButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openDetail(linked.category, linked.id);
    });
  }

  const assignButton = card.querySelector("[data-assign-region]");
  if (assignButton && typeof assignRegionToSelected === "function") {
    assignButton.addEventListener("click", (event) => {
      event.stopPropagation();
      assignRegionToSelected();
    });
  }

  $("mapCanvas").appendChild(card);
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


function setToolPanel(panel) {
  currentToolPanel = panel;

  if (panel !== "pin") quickPinMode = false;
  if (panel !== "region") {
    drawingPolygon = false;
    polygonDraft = [];
    editingLineMode = false;
    addPointMode = false;
    moveRegionMode = false;
  }

  updateToolPanel();
  updateMapHint();
  renderMap();
}

function updateToolPanel() {
  ["toolHomePanel", "pinToolPanel", "regionToolPanel"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  const id = currentToolPanel === "pin" ? "pinToolPanel"
    : currentToolPanel === "region" ? "regionToolPanel"
      : "toolHomePanel";
  const panel = $(id);
  if (panel) panel.classList.remove("hidden");
}

function assignRegionToSelected() {
  if (!selectedPolygonId) return showToast("배정할 영역을 먼저 선택해주세요.");

  const poly = getActiveMap().polygons.find((item) => item.id === selectedPolygonId);
  if (!poly) return;

  const linkValue = $("regionLinkSelect")?.value || "";
  const linked = parseMapLink(linkValue);
  const linkedItem = linked ? findItem(linked.category, linked.id) : null;

  poly.link = linkValue;
  if (linkedItem) {
    poly.title = linkedItem.title;
    poly.desc = linkedItem.summary || poly.desc || "";
  }

  saveState();
  renderMap();
  showToast("영역에 카드를 배정했습니다.");
}

function applySelectedRegionColor() {
  const hex = normalizeHexColor($("regionHexInput")?.value || $("regionColorInput")?.value || "#d8b674");
  syncRegionColorInputs(hex);

  if (!selectedPolygonId) return;

  const poly = getActiveMap().polygons.find((item) => item.id === selectedPolygonId);
  if (!poly) return;

  poly.color = "custom";
  poly.hex = hex;
  saveState();
  renderMap();
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
    $("mapHint").textContent = "하단 바에서 핀/영역을 선택해 작업합니다. 영역 색상은 HEX로 수정할 수 있고, 선택한 영역에는 지역 카드를 배정할 수 있습니다.";
  }
}

function zoomMap(delta, anchorEvent = null) {
  const board = $("mapBoard");
  if (!board) return;
  const oldZoom = mapZoom;
  const nextZoom = Math.max(1, Math.min(6, Math.round((mapZoom + delta) * 10) / 10));
  if (nextZoom === oldZoom) return;

  const rect = board.getBoundingClientRect();
  const cursorX = anchorEvent ? anchorEvent.clientX - rect.left : rect.width / 2;
  const cursorY = anchorEvent ? anchorEvent.clientY - rect.top : rect.height / 2;

  const worldX = (cursorX - mapPanX) / oldZoom;
  const worldY = (cursorY - mapPanY) / oldZoom;

  mapZoom = nextZoom;
  mapPanX = cursorX - worldX * mapZoom;
  mapPanY = cursorY - worldY * mapZoom;

  clampMapPan();
  applyMapTransform();
}

function clampMapPan() {
  const board = $("mapBoard");
  const canvas = $("mapCanvas");
  if (!board || !canvas) return;

  const viewW = board.clientWidth;
  const viewH = board.clientHeight;
  const canvasW = canvas.offsetWidth * mapZoom;
  const canvasH = canvas.offsetHeight * mapZoom;

  const minX = Math.min(0, viewW - canvasW);
  const minY = Math.min(0, viewH - canvasH);
  mapPanX = Math.max(minX, Math.min(0, mapPanX));
  mapPanY = Math.max(minY, Math.min(0, mapPanY));
}

function resetMapZoom() {
  mapZoom = 1;
  mapPanX = 0;
  mapPanY = 0;
  applyMapTransform();
}

function startMapPan(event) {
  const wheelPan = event.button === 1;
  if (drawingPolygon) return;
  if ((editingLineMode || addPointMode || moveRegionMode) && !wheelPan) return;
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
    panX: mapPanX,
    panY: mapPanY
  };
  board.classList.add("panning");
  board.setPointerCapture?.(event.pointerId);
}

function moveMapPan(event) {
  if (!isMapPanning || !mapPanStart) return;
  mapPanX = mapPanStart.panX + (event.clientX - mapPanStart.x);
  mapPanY = mapPanStart.panY + (event.clientY - mapPanStart.y);
  clampMapPan();
  applyMapTransform();
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


function resizeImageForStorage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("이미지 파일이 아닙니다."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));

      image.onload = () => {
        const maxSide = 1600;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/jpeg", 0.78);

        if (dataUrl.length > 2800000) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.62);
        }

        resolve(dataUrl);
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}


function resizeImageForDisplay(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 넣을 수 있습니다."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));

    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));

      image.onload = () => {
        const maxSide = 1800;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function setMapImage(file) {
  if (!file) return;

  resizeImageForDisplay(file)
    .then((dataUrl) => {
      const map = getActiveMap ? getActiveMap() : state.map;
      if (!map) return;

      map.image = dataUrl;
      const tempImage = new Image();
      tempImage.onload = () => {
        map.imageAspect = tempImage.naturalHeight / tempImage.naturalWidth;
        saveState();
        renderMap();
      };
      tempImage.src = dataUrl;

      // 이미지까지 localStorage에 넣으면 용량 초과가 자주 나서,
      // 화면에는 바로 반영하고 설정 저장은 이미지 제외 방식으로 처리합니다.
      saveState();
      renderMap();
      showToast("배경 이미지를 추가했습니다.");
    })
    .catch((error) => {
      console.error(error);
      showToast(error.message || "이미지를 불러오지 못했습니다.");
    });
}


function addMapPinFromBoard(event) {
  const board = $("mapCanvas");
  const rect = board.getBoundingClientRect();
  const x = Math.max(1, Math.min(99, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(1, Math.min(99, ((event.clientY - rect.top) / rect.height) * 100));
  createInstantPinAt(x, y);
}


function sanitizeFilename(name) {
  return String(name || "").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 120) || "제목 없음";
}

function yamlScalar(value) {
  const str = String(value ?? "");
  if (str === "") return '""';
  if (/^[A-Za-z0-9가-힣._-]+$/.test(str)) return str;
  return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

function yamlUnquote(raw) {
  const trimmed = String(raw ?? "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function buildFrontmatter(fields) {
  const lines = ["---"];
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (!value.length) {
        lines.push(`${key}: []`);
        return;
      }
      lines.push(`${key}:`);
      value.forEach((entry) => lines.push(`  - ${yamlScalar(entry)}`));
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  });
  lines.push("---");
  return lines.join("\n");
}

function parseFrontmatter(text) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: source };

  const data = {};
  const rawLines = match[1].split("\n");
  let currentKey = null;

  rawLines.forEach((line) => {
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(yamlUnquote(listItem[1]));
      return;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) return;
    const key = kv[1];
    const rawValue = kv[2].trim();
    currentKey = key;
    if (rawValue === "") {
      data[key] = [];
    } else if (rawValue === "[]") {
      data[key] = [];
      currentKey = null;
    } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      data[key] = rawValue.slice(1, -1).split(",").map((part) => yamlUnquote(part.trim())).filter(Boolean);
      currentKey = null;
    } else if (rawValue === "true" || rawValue === "false") {
      data[key] = rawValue === "true";
      currentKey = null;
    } else {
      data[key] = yamlUnquote(rawValue);
      currentKey = null;
    }
  });

  return { data, body: source.slice(match[0].length).replace(/^\n+/, "") };
}

function cardToMarkdown(category, item) {
  const folderName = item.folderId
    ? (state.folders[category]?.find((folder) => folder.id === item.folderId)?.name || "")
    : "";
  const links = normalizeLinks(item.links || []);
  const linkRefs = links
    .map((link) => {
      const target = findItem(link.category, link.id);
      return target ? `${link.category}:${target.title}` : null;
    })
    .filter(Boolean);

  const frontmatter = buildFrontmatter({
    title: item.title || "제목 없음",
    category,
    folder: folderName,
    tags: item.tags || [],
    date: item.dateText || "",
    pinned: !!item.pinned,
    links: linkRefs,
    ...(item.image ? { image: item.image } : {})
  });

  const parts = [frontmatter, "", `# ${item.title || "제목 없음"}`, ""];
  if (item.summary) {
    parts.push(`> ${item.summary}`, "");
  }
  if (item.body) {
    parts.push(item.body, "");
  }
  if (links.length) {
    parts.push("## 연결된 설정", "");
    links.forEach((link) => {
      const target = findItem(link.category, link.id);
      if (target) parts.push(`- [[${target.title}]] · ${categories[link.category] || link.category}`);
    });
    parts.push("");
  }

  return parts.join("\n");
}

function markdownFileToCard(text, fallbackTitle) {
  const { data, body } = parseFrontmatter(text);
  let cleanBody = body;

  const headingMatch = cleanBody.match(/^#\s+.+\n+/);
  if (headingMatch) cleanBody = cleanBody.slice(headingMatch[0].length);

  let summary = typeof data.summary === "string" ? data.summary : "";
  const quoteMatch = cleanBody.match(/^>\s?(.+)\n+/);
  if (quoteMatch && !summary) {
    summary = quoteMatch[1].trim();
    cleanBody = cleanBody.slice(quoteMatch[0].length);
  }

  cleanBody = cleanBody.replace(/\n?##\s*연결된 설정[\s\S]*$/, "").trim();

  const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
  const linkRefs = Array.isArray(data.links) ? data.links : (data.links ? [data.links] : []);

  return {
    category: dataCategories.includes(data.category) ? data.category : null,
    title: (typeof data.title === "string" && data.title.trim()) || fallbackTitle || "제목 없음",
    summary,
    body: cleanBody,
    dateText: typeof data.date === "string" ? data.date : "",
    folderName: typeof data.folder === "string" ? data.folder : "",
    tags,
    pinned: data.pinned === true,
    linkRefs,
    image: typeof data.image === "string" ? data.image : ""
  };
}

function applyImportedCard(parsed, defaultCategory) {
  const category = parsed.category || defaultCategory;
  if (!dataCategories.includes(category)) return null;

  let folderId = "";
  if (parsed.folderName) {
    let folder = state.folders[category].find((item) => item.name === parsed.folderName);
    if (!folder) {
      folder = { id: uid(), name: parsed.folderName };
      state.folders[category].push(folder);
    }
    folderId = folder.id;
  }

  const id = uid();
  state[category].push({
    id,
    title: parsed.title,
    summary: parsed.summary,
    body: parsed.body,
    dateText: parsed.dateText,
    folderId,
    tags: parsed.tags.length ? parsed.tags : ["미분류"],
    links: [],
    image: parsed.image || "",
    pinned: parsed.pinned,
    order: state[category].length,
    createdAt: now(),
    updatedAt: now()
  });

  return { category, id, linkRefs: parsed.linkRefs };
}

function resolveImportedLinks(created) {
  created.forEach(({ category, id, linkRefs }) => {
    if (!linkRefs?.length) return;
    const links = [];
    linkRefs.forEach((ref) => {
      const raw = String(ref);
      const sepIndex = raw.indexOf(":");
      if (sepIndex < 0) return;
      const cat = raw.slice(0, sepIndex);
      const title = raw.slice(sepIndex + 1);
      if (!dataCategories.includes(cat)) return;
      const target = state[cat].find((entry) => entry.title === title);
      if (target) links.push({ category: cat, id: target.id });
    });
    if (links.length) {
      const item = findItem(category, id);
      if (item) item.links = syncLinks(category, id, links, []);
    }
  });
}

async function exportData() {
  if (typeof JSZip === "undefined") {
    showToast("내보내기에는 인터넷 연결이 필요합니다.");
    return;
  }

  const zip = new JSZip();
  let count = 0;

  dataCategories.forEach((category) => {
    const folder = zip.folder(categories[category] || category);
    state[category].forEach((item) => {
      folder.file(`${sanitizeFilename(item.title)}.md`, cardToMarkdown(category, item));
      count += 1;
    });
  });

  if (!count) {
    showToast("내보낼 설정이 없습니다.");
    return;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "설정서랍-vault.zip";
  a.click();
  URL.revokeObjectURL(url);
  showToast(`.md 파일 ${count}개를 내보냈습니다.`);
}

function exportSingleCard() {
  if (!detailTarget) return;
  const { category, id } = detailTarget;
  const item = findItem(category, id);
  if (!item) return;

  const blob = new Blob([cardToMarkdown(category, item)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(item.title)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// 예전 버전(state 전체를 JSON으로 감싼 단일 md)으로 내보낸 백업 파일도 계속 불러올 수 있도록 남겨둡니다.
function legacyMarkdownToState(text) {
  const fenced = String(text || "").match(/```setting-drawer\s*([\s\S]*?)```/);
  return fenced ? JSON.parse(fenced[1]) : null;
}

async function importData(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const mdFiles = [];

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      if (typeof JSZip === "undefined") {
        showToast("ZIP을 가져오려면 인터넷 연결이 필요합니다.");
        continue;
      }
      try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(md|markdown)$/i.test(entry.name));
        for (const entry of entries) {
          mdFiles.push({ name: entry.name.split("/").pop(), text: await entry.async("string") });
        }
      } catch {
        showToast(`${file.name}을(를) 열 수 없습니다.`);
      }
    } else if (/\.(md|markdown)$/i.test(file.name)) {
      mdFiles.push({ name: file.name, text: await file.text() });
    }
  }

  if (!mdFiles.length) {
    showToast("가져올 .md 파일이 없습니다.");
    return;
  }

  // 예전 전체 백업 형식(md 하나에 JSON 전체)인지 먼저 확인합니다.
  if (mdFiles.length === 1) {
    const legacy = legacyMarkdownToState(mdFiles[0].text);
    if (legacy) {
      state = normalizeState(legacy);
      saveState();
      currentCategory = "all";
      render();
      showToast("이전 형식 백업을 가져왔습니다.");
      return;
    }
  }

  const defaultCategory = dataCategories.includes(currentCategory) ? currentCategory : "characters";
  const created = [];

  mdFiles.forEach(({ name, text }) => {
    const parsed = markdownFileToCard(text, name.replace(/\.(md|markdown)$/i, ""));
    const result = applyImportedCard(parsed, defaultCategory);
    if (result) created.push(result);
  });

  resolveImportedLinks(created);
  saveState();
  currentCategory = "all";
  render();
  showToast(`노트 ${created.length}개를 가져왔습니다.`);
}

function startNewFile() {
  const category = dataCategories.includes(currentCategory) ? currentCategory : "characters";
  const folderId = dataCategories.includes(currentCategory) && currentFolderId && currentFolderId !== "__none" ? currentFolderId : "";
  createFileIn(category, folderId);
}

function initEvents() {
  $("drawerBackdrop").addEventListener("click", () => document.body.classList.remove("menu-open"));
  $("closeDrawerBtn").addEventListener("click", () => document.body.classList.remove("menu-open"));

  document.querySelectorAll(".rail-btn[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      const isMobile = window.matchMedia("(max-width: 980px)").matches;
      if (isMobile && sidebarPanel === panel && document.body.classList.contains("menu-open")) {
        document.body.classList.remove("menu-open");
        return;
      }
      sidebarPanel = panel;
      if (isMobile) document.body.classList.add("menu-open");
      renderSidebar();
      if (panel === "search") $("sidebarSearchInput")?.focus();
    });
  });
  document.querySelectorAll(".rail-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchCategory(btn.dataset.view));
  });
  on("railWriteBtn", "click", () => startNewFile());
  on("explorerAllRow", "click", () => switchCategory("all"));
  on("sidebarSearchInput", "input", renderSidebarSearch);

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  document.querySelectorAll(".modal-bg").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal.id);
    });
  });

  $("writeBtn").addEventListener("click", () => startNewFile());
  $("saveBtn").addEventListener("click", () => {
    saveState();
    showToast("저장했습니다.");
  });
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (event) => {
    const files = event.target.files;
    if (files && files.length) importData(files);
    event.target.value = "";
  });
  on("exportCardBtn", "click", exportSingleCard);

  on("pageTabAdd", "click", () => startNewFile());
  on("pageTabClose", "click", () => switchCategory("all"));

  $("searchInput").addEventListener("input", render);
  $("sortSelect").addEventListener("change", render);
  $("emptyBox").addEventListener("click", () => startNewFile());

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

  const saveEditorTitle = debounce((value) => {
    if (!detailTarget) return;
    const item = findItem(detailTarget.category, detailTarget.id);
    if (!item) return;
    item.title = value.trim() || "제목 없음";
    item.updatedAt = now();
    saveState();
    renderSidebar();
    renderTitle();
  }, 350);

  const saveEditorBody = debounce((value) => {
    if (!detailTarget) return;
    const item = findItem(detailTarget.category, detailTarget.id);
    if (!item) return;
    item.body = value;
    item.updatedAt = now();
    saveState();
  }, 350);

  on("editorTitleInput", "input", (event) => saveEditorTitle(event.target.value));
  on("editorTextarea", "input", (event) => saveEditorBody(event.target.value));

  on("editorPreviewToggle", "click", () => {
    if (!detailTarget) return;
    const item = findItem(detailTarget.category, detailTarget.id);
    const textarea = $("editorTextarea");
    const preview = $("editorPreview");
    const showingPreview = !preview.classList.contains("hidden");
    if (showingPreview) {
      preview.classList.add("hidden");
      textarea.classList.remove("hidden");
      $("editorPreviewToggle").textContent = "미리보기";
    } else {
      preview.innerHTML = item?.body ? renderMarkdownToHTML(item.body) : "<p class=\"muted\">내용 없음</p>";
      preview.classList.remove("hidden");
      textarea.classList.add("hidden");
      $("editorPreviewToggle").textContent = "편집";
    }
  });

  on("editorPropsBtn", "click", () => {
    if (!detailTarget) return;
    const item = findItem(detailTarget.category, detailTarget.id);
    if (item) {
      const titleVal = $("editorTitleInput")?.value;
      const bodyVal = $("editorTextarea")?.value;
      if (typeof titleVal === "string") item.title = titleVal.trim() || "제목 없음";
      if (typeof bodyVal === "string") item.body = bodyVal;
    }
    openCardModal(detailTarget.category, detailTarget.id);
  });
  on("editorPinBtn", "click", () => {
    if (!detailTarget) return;
    togglePin(detailTarget.category, detailTarget.id);
    openDetail(detailTarget.category, detailTarget.id);
  });
  on("editorExportBtn", "click", exportSingleCard);
  on("editorDeleteBtn", "click", () => {
    if (!detailTarget) return;
    deleteCard(detailTarget.category, detailTarget.id);
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
    if (event.target === $("timelineBoard") || event.target.classList.contains("tl-line") || event.target.id === "timelineEvents" || event.target.id === "timelineAxis") {
      selectedTimelineId = null;
      renderTimeline();
    }
  });
  on("timelinePrevBtn", "click", () => panTimeline(-1));
  on("timelineNextBtn", "click", () => panTimeline(1));
  on("timelineResetBtn", "click", resetTimelineZoom);
  on("timelineSearchInput", "input", (event) => {
    timelineSearchQuery = event.target.value || "";
    renderTimeline();
  });

  $("addNodeBtn").addEventListener("click", () => openNodeModal());
  $("saveNodeBtn").addEventListener("click", saveNode);
  $("importNodeBtn").addEventListener("click", openImportNodes);
  $("importSearch").addEventListener("input", renderImportList);
  $("importCategory").addEventListener("change", renderImportList);
  on("connectBtn", "click", connectNodesNow);
  on("edgeNameBtn", "click", () => {
    if (!selectedEdgeId) return showToast("선 하나를 선택해주세요.");
    const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
    $("edgeName").value = edge?.label || "";
    openModal("edgeModal");
  });
  $("saveEdgeBtn").addEventListener("click", saveEdgeName);
  on("deleteEdgeBtn", "click", deleteSelectedEdge);
  on("deleteNodeBtn", "click", deleteSelectedNode);
  on("organizeBtn", "click", organizeMembers);
  on("importTimelineBtn", "click", importTimelineEvents);
  on("timelineZoomInBtn", "click", () => zoomTimeline(0.2));
  on("timelineZoomOutBtn", "click", () => zoomTimeline(-0.2));
  on("timelineZoomResetBtn", "click", resetTimelineZoom);

  on("relCardCreateBtn", "click", () => openNodeModal());
  on("relCardImportBtn", "click", openImportNodes);
  on("relCardDeleteBtn", "click", deleteSelectedNode);
  on("relEdgeCreateBtn", "click", connectNodesNow);
  on("relEdgeEditBtn", "click", () => {
    const edge = state.relation.edges.find((item) => item.id === selectedEdgeId);
    if (!edge) return showToast("수정할 선을 선택해주세요.");
    syncEdgeControls(edge);
    openModal("edgeModal");
  });
  on("relEdgeDeleteBtn", "click", deleteSelectedEdge);
  on("relEdgeColorInput", "input", applyEdgeToolbarValues);
  on("relEdgeDirectionSelect", "change", applyEdgeToolbarValues);
  on("relOrgCreateBtn", "click", () => {
    state.relation.nodes.push({ id: uid(), name: "조직", desc: "", sourceCategory: "factions", x: 70, y: 70 });
    saveState();
    renderRelations();
  });
  on("relOrgDeleteBtn", "click", deleteSelectedNode);
  on("relationZoomInBtn", "click", () => zoomRelation(0.2));
  on("relationZoomOutBtn", "click", () => zoomRelation(-0.2));
  on("relationZoomResetBtn", "click", resetRelationZoom);
  on("relationBoard", "pointerdown", startRelationPan);
  on("relationBoard", "pointermove", moveRelationPan);
  on("relationBoard", "pointerup", endRelationPan);
  on("relationBoard", "pointercancel", endRelationPan);
  on("relationBoard", "mouseleave", endRelationPan);
  on("relationBoard", "wheel", handleRelationWheel);
  on("timelineBoard", "wheel", handleTimelineWheel);
  on("addMapBtn", "click", addMap);
  on("renameMapBtn", "click", renameMap);
  on("deleteMapBtn", "click", deleteMap);
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
    applySelectedRegionColor();
  });
  on("regionHexInput", "change", (event) => {
    syncRegionColorInputs(event.target.value);
    applySelectedRegionColor();
  });
  on("toolPinBtn", "click", () => setToolPanel("pin"));
  on("toolRegionBtn", "click", () => setToolPanel("region"));
  document.querySelectorAll(".toolBackBtn").forEach((button) => {
    button.addEventListener("click", () => setToolPanel("home"));
  });
  on("quickPinBtn", "click", toggleQuickPinMode);
  on("startPolygonBtn", "click", toggleLineDrawing);
  on("editLineBtn", "click", toggleLineEdit);
  on("addPointBtn", "click", toggleAddPointMode);
  on("deletePointBtn", "click", deleteSelectedPoint);
  on("moveRegionBtn", "click", toggleMoveRegionMode);
  on("assignRegionBtn", "click", assignRegionToSelected);
  on("deleteLineBtn", "click", deletePolygon);
  on("mapBoard", "click", (event) => {
    if (isMapPanning) return;

    if (drawingPolygon && $("mapCanvas")?.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      addPolygonPointFromEvent(event);
      return;
    }

    const baseTarget = event.target === $("mapBoard") || event.target === $("mapCanvas") || event.target === $("mapImage") || event.target === $("mapEmpty") || event.target === $("mapSvg");
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
  on("mapBoard", "contextmenu", (event) => {
    if (!drawingPolygon) return;
    event.preventDefault();
    completeLineDrawing();
  });

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
