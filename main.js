let unitMap = new Map();
const rarityMap = {
  0: "基本",
  1: "EX",
  2: "稀有",
  3: "激稀有",
  4: "超激稀有",
  5: "傳說稀有"
};

function openDB(dbName = "MyBCDB", storeName = "tsv") {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function getFromDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tsv", "readonly");
    const store = tx.objectStore("tsv");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToDB(key, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tsv", "readwrite");
    const store = tx.objectStore("tsv");
    const record = {
      data,
      timestamp: Date.now()
    };
    store.put(record, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fetchData(url) {
  try {
    const cached = await getFromDB(url);
    const now = Date.now();

    if (cached && cached.data && cached.timestamp) {
      const cacheTTL = 5 * 24 * 60 * 60 * 1000; // 5 天
      if (now - cached.timestamp < cacheTTL) {
        return parseTSV(cached.data); // 有效期限內，使用快取
      }
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response was not ok ' + res.status);
    const text = await res.text();
    await saveToDB(url, text); // 更新快取
    return parseTSV(text);

  } catch (error) {
    console.error('Fetch error:', error);
  }
}

function parseTSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

async function main() {
  const cats = await fetchData('https://raw.githubusercontent.com/battlecatsinfo/battlecatsinfo.github.io/master/data/cat.tsv');
  const catstats = await fetchData('https://raw.githubusercontent.com/battlecatsinfo/battlecatsinfo.github.io/master/data/catstat.tsv');
  
  cats.forEach((cat, i) => {
    const unit = {
      id: i.toString(),
      rarity: cat.rarity,
      form_index: cat.form_count - 1,
      cat: cat,
      forms: []
    };
    unitMap.set(unit.id, unit);
  });
  catstats.forEach(catstat => {
    unitMap.get(catstat.id).forms.push(catstat);
  });
  
  unitMap.forEach(unit => {
    const rarity = unit.rarity;
    const forms = unit.forms;
    const correctTab = document.querySelector(`#available-units-container .tab-content[data-tab="${unit.rarity}"]`);
    if (correctTab) {
      const img = document.createElement("img");
      getUnitImgSrc(unit).then(src => {
        img.src = src;
      });
      img.className = "unit";
      img.dataset.name = unit.forms[unit.form_index].name_tw;
      img.dataset.id = `${unit.id}`;
      correctTab.appendChild(img);
      tippy(img, {
        content: generateTooltipContent(unit),
        allowHTML: true,
        placement: 'top',
        theme: 'my-light',
        animation: 'scale',
        interactive: true,
        popperOptions: {
          modifiers: [{
            name: 'eventListeners',
            options: { scroll: false } // 🚫 不允許自動因顯示 tooltip 而 scroll
          }]
        },
        maxWidth: 500
      });
    }
  });
  updateTabCounts();
  loadState();
}

main();

const TRAITS = {
  TB_RED:     1,        // Red 紅色敵人
  TB_FLOAT:   2,        // Floating 飄浮敵人
  TB_BLACK:   4,        // Black 黑色敵人
  TB_METAL:   8,        // Metal 鋼鐵敵人
  TB_ANGEL:   16,       // Angel 天使敵人
  TB_ALIEN:   32,       // Alien 異星戰士
  TB_ZOMBIE:  64,       // Zombie 不死生物
  TB_RELIC:   128,      // Relic 古代種
  TB_WHITE:   256,      // Traitless 無屬性敵人
  TB_EVA:     512,      // EVA Angel 使徒
  TB_WITCH:   1024,     // Witch 魔女
  TB_DEMON:   2048,     // Aku 惡魔
  TB_INFN:    4096,     // Dojo Base 道場塔 [UNOFFICIAL]
  TB_BEAST:   8192,     // Behemoth 超獸
  TB_BARON:   16384,    // Colossus 超生命體
  TB_SAGE:    32768     // Sage 超賢者
};

const TRAIT_INFO = {
  TB_RED:     { class: 'trait-red',        label: '紅色敵人' },
  TB_FLOAT:   { class: 'trait-float',      label: '飄浮敵人' },
  TB_BLACK:   { class: 'trait-black',      label: '黑色敵人' },
  TB_METAL:   { class: 'trait-metal',      label: '鋼鐵敵人' },
  TB_ANGEL:   { class: 'trait-angel',      label: '天使敵人' },
  TB_ALIEN:   { class: 'trait-alien',      label: '異星戰士' },
  TB_ZOMBIE:  { class: 'trait-zombie',     label: '不死生物' },
  TB_RELIC:   { class: 'trait-relic',      label: '古代種' },
  TB_WHITE:   { class: 'trait-traitless',  label: '無屬性敵人' },
  TB_EVA:     { class: 'trait-eva',        label: '使徒' },
  TB_WITCH:   { class: 'trait-witch',      label: '魔女' },
  TB_DEMON:   { class: 'trait-aku',        label: '惡魔' },
  TB_INFN:    { class: 'trait-infn',       label: '道場塔' },
  TB_BEAST:   { class: 'trait-beast',      label: '超獸' },
  TB_BARON:   { class: 'trait-baron',      label: '超生命體' },
  TB_SAGE:    { class: 'trait-sage',       label: '超賢者' }
};

const ATTACK_TYPES = {
  ATK_SINGLE:      1,
  ATK_RANGE:       2,
  ATK_LD:          4,
  ATK_OMNI:        8,
  ATK_KB_REVENGE:  16
};

const ATTACK_TYPE_INFO = {
  ATK_SINGLE:      { class: 'attack-single',         label: '單體攻擊' },
  ATK_RANGE:       { class: 'attack-area',           label: '範圍攻擊' },
  ATK_LD:          { class: 'attack-long-distance',  label: '遠距攻擊' },
  ATK_OMNI:        { class: 'attack-omni',           label: '全方位攻擊' },
  ATK_KB_REVENGE:  { class: 'attack-kb-revenge',     label: '擊退反擊' }
};

const IMMUNITIES = {
  IMU_WAVE:        1,
  IMU_STOP:        2,
  IMU_SLOW:        4,
  IMU_KB:          8,
  IMU_SURGE:       16,
  IMU_WEAK:        32,
  IMU_WARP:        64,
  IMU_CURSE:       128,
  IMU_TOXIC:       256,
  IMU_BOSSWAVE:    512,
  IMU_EXPLOSION:   1024
};

const IMMUNITY_INFO = {
  IMU_WAVE:        { class: 'immunity-wave',        label: '波動傷害無效' },
  IMU_STOP:        { class: 'immunity-stop',        label: '動作停止無效' },
  IMU_SLOW:        { class: 'immunity-slow',        label: '動作變慢無效' },
  IMU_KB:          { class: 'immunity-kb',          label: '打飛敵人無效' },
  IMU_SURGE:       { class: 'immunity-surge',       label: '烈波傷害無效' },
  IMU_WEAK:        { class: 'immunity-weaken',      label: '攻擊力下降無效' },
  IMU_WARP:        { class: 'immunity-warp',        label: '傳送無效' },
  IMU_CURSE:       { class: 'immunity-curse',       label: '古代詛咒無效' },
  IMU_TOXIC:       { class: 'immunity-toxic',       label: '毒擊傷害無效' },
  IMU_BOSSWAVE:    { class: 'immunity-bosswave',    label: '魔王震波無效' },
  IMU_EXPLOSION:   { class: 'immunity-explosion',   label: '爆波傷害無效' }
};

function getBitflagIcons(bitValue, flagMap, infoMap) {
  return Object.entries(flagMap)
    .filter(([_, bit]) => (bitValue & bit) !== 0)
    .map(([key]) => {
      const info = infoMap[key];
      return info
        ? `<span class="icon ${info.class}" title="${info.label}"></span>`
        : '';
    })
    .join('');
}

const EFFECTS = {
  AB_WEAK:     21,  // 攻擊力下降（Weaken）
  AB_STOP:     22,  // 使動作停止（Freeze）
  AB_SLOW:     23,  // 使動作變慢（Slow）
  AB_ONLY:     24,  // 只能攻擊（Attacks Only）
  AB_GOOD:     25,  // 善於攻擊（Strong Against）
  AB_RESIST:   26,  // 很耐打（Resistant）
  AB_RESISTS:  27,  // 超級耐打（Insanely Tough）
  AB_MASSIVE:  28,  // 超大傷害（Massive Damage）
  AB_MASSIVES: 29,  // 極度傷害（Insane Damage）
  AB_KB:       30,  // 打飛敵人（Knockback）
  AB_WARP:     31,  // 傳送（Warp）
  AB_CURSE:    33,  // 詛咒（Curse）
  AB_IMUATK:   32   // 攻擊無效（Dodge Attack）
};

const EFFECT_INFO = {
  AB_WEAK:       { class: 'effect-weaken',           label: '攻擊力下降' },
  AB_STOP:       { class: 'effect-freeze',           label: '使動作停止' },
  AB_SLOW:       { class: 'effect-slow',             label: '使動作變慢' },
  AB_ONLY:       { class: 'effect-attacks-only',     label: '只能攻擊' },
  AB_GOOD:       { class: 'effect-strong-against',   label: '善於攻擊' },
  AB_RESIST:     { class: 'effect-resistant',        label: '很耐打' },
  AB_RESISTS:    { class: 'effect-insanely-tough',   label: '超級耐打' },
  AB_MASSIVE:    { class: 'effect-massive-damage',   label: '超大傷害' },
  AB_MASSIVES:   { class: 'effect-insane-damage',    label: '極度傷害' },
  AB_KB:         { class: 'effect-knockback',        label: '打飛敵人' },
  AB_WARP:       { class: 'effect-warp',             label: '傳送' },
  AB_CURSE:      { class: 'effect-curse',            label: '詛咒' },
  AB_IMUATK:     { class: 'effect-dodge-attack',     label: '攻擊無效' }
};

const ABILITIES = {
  AB_STRENGTHEN:     1,  // 攻擊力上升（Strengthen）
  AB_LETHAL:         2,  // 死血存活（Survive）
  AB_ATKBASE:        3,  // 善於攻城（Base Destroyer）
  AB_CRIT:           4,  // 會心一擊（Critical）
  AB_ZKILL:          5,  // 終結不死（Zombie Killer）
  AB_CKILL:          6,  // 靈魂攻擊（Soulstrike）
  AB_BREAK:          7,  // 破壞護盾（Barrier Breaker）
  AB_SHIELDBREAK:    8,  // 破壞惡魔盾（Shield Piercing）
  AB_S:              9,  // 渾身一擊（Savage Blow）
  AB_BOUNTY:         10, // 得到很多金錢（Extra Money）
  AB_METALIC:        11, // 鋼鐵特性（Metal）
  AB_MINIWAVE:       12, // 小波動（Mini-Wave）
  AB_WAVE:           13, // 波動（Wave）
  AB_MINISURGE:      14, // 小烈波（Mini-Surge）
  AB_SURGE:          15, // 烈波攻擊（Surge）
  AB_WAVES:          16, // 波動滅止（Wave Shield）
  AB_BAIL:           17, // 超生命體特效（Colossus Slayer）
  AB_BSTHUNT:        18, // 超獸特效（Behemoth Slayer）
  AB_WKILL:          19, // 終結魔女（Witch Killer）
  AB_EKILL:          20, // 終結使徒（Eva Angel Killer）
  AB_BURROW:         34, // 鑽地（Burrow）[UNOFFICIAL]
  AB_REVIVE:         35, // 復活（Revive）[UNOFFICIAL]
  AB_POIATK:         36, // 毒擊（Toxic）
  AB_SUICIDE:        37, // 一次攻擊（Kamikaze/Suicide）[UNOFFICIAL]
  AB_BARRIER:        38, // 護盾（Barrier）
  AB_DSHIELD:        39, // 惡魔盾（Aku Shield）
  AB_COUNTER:        40, // 烈波反擊（Counter-Surge）
  AB_DEATHSURGE:     41, // 遺留烈波（Death Surge）
  AB_SAGE:           42, // 超賢者特效（Sage Slayer）
  AB_SUMMON:         43, // 召喚（Conjure/Summon）
  AB_MK:             44, // 鋼鐵殺手（Metal Killer）
  AB_EXPLOSION:      45, // 爆波（Explosion）
};

const ABILITY_INFO = {
  AB_STRENGTHEN:   { class: 'ability-strengthen',         label: '攻擊力上升' },
  AB_LETHAL:       { class: 'ability-survive',            label: '死前存活' },
  AB_ATKBASE:      { class: 'ability-base-destroyer',     label: '善於攻城' },
  AB_CRIT:         { class: 'ability-critical',           label: '會心一擊' },
  AB_ZKILL:        { class: 'ability-zombie-killer',      label: '終結不死' },
  AB_CKILL:        { class: 'ability-soulstrike',         label: '靈魂攻擊' },
  AB_BREAK:        { class: 'ability-barrier-breaker',    label: '破壞護盾' },
  AB_SHIELDBREAK:  { class: 'ability-shield-piercing',    label: '破壞惡魔盾' },
  AB_S:            { class: 'ability-savage-blow',        label: '渾身一擊' },
  AB_BOUNTY:       { class: 'ability-extra-money',        label: '得到很多金錢' },
  AB_METALIC:      { class: 'ability-metal',              label: '鋼鐵特性' },
  AB_MINIWAVE:     { class: 'ability-mini-wave',          label: '小波動' },
  AB_WAVE:         { class: 'ability-wave',               label: '波動' },
  AB_MINISURGE:    { class: 'ability-mini-surge',         label: '小烈波' },
  AB_SURGE:        { class: 'ability-surge',              label: '烈波攻擊' },
  AB_WAVES:        { class: 'ability-wave-shield',        label: '波動滅止' },
  AB_BAIL:         { class: 'ability-colossus-slayer',    label: '超生命體特效' },
  AB_BSTHUNT:      { class: 'ability-behemoth-slayer',    label: '超獸特效' },
  AB_WKILL:        { class: 'ability-witch-killer',       label: '終結魔女' },
  AB_EKILL:        { class: 'ability-eva-angel-killer',   label: '終結使徒' },
  AB_BURROW:       { class: 'ability-burrow',             label: '鑽地' },
  AB_REVIVE:       { class: 'ability-revive',             label: '復活' },
  AB_POIATK:       { class: 'ability-toxic',              label: '毒擊' },
  AB_SUICIDE:      { class: 'ability-kamikaze',           label: '一次攻擊' },
  AB_BARRIER:      { class: 'ability-barrier',            label: '護盾' },
  AB_DSHIELD:      { class: 'ability-shield',             label: '惡魔盾' },
  AB_COUNTER:      { class: 'ability-counter-surge',      label: '烈波反擊' },
  AB_DEATHSURGE:   { class: 'ability-death-surge',        label: '遺留烈波' },
  AB_SAGE:         { class: 'ability-sage-slayer',        label: '超賢者特效' },
  AB_SUMMON:       { class: 'ability-conjure',            label: '召喚' },
  AB_MK:           { class: 'ability-metal-killer',       label: '鋼鐵殺手' },
  AB_EXPLOSION:    { class: 'ability-explosion',          label: '爆波' }
};

function getAbilityIconsFromList(abilityIds, abilityMap, infoMap) {
  return abilityIds
    .slice()               // 複製一份，避免改到原陣列
    .sort((a, b) => a - b) // 升冪排序ID
    .map(id => {
      const key = Object.keys(abilityMap).find(k => abilityMap[k] === id);
      if (!key) return '';
      const info = infoMap[key];
      return info
        ? `<span class="icon ${info.class}" title="${info.label}"></span>`
        : '';
    })
    .join('');
}

function extractAbilityIds(str) {
  return str
    .split('|')
    .map(part => parseInt(part.split(/[&@]/)[0]))
    .filter(n => !isNaN(n));
}

function generateTooltipContent(unit) {
  const form = unit.forms[unit.form_index];
  let arrow = "";
  let immunity = "";
  if (form.trait > 0) {
    arrow = `<span class="icon arrow" title="效果"></span>`;
  }
  if (form.immunity > 0) {
    immunity = `<div>抗性 ${getBitflagIcons(form.immunity, IMMUNITIES, IMMUNITY_INFO)}</div>`;
  }
  const abilityIds = extractAbilityIds(form.ability);
  const abilities = getAbilityIconsFromList(abilityIds, ABILITIES, ABILITY_INFO)
  const attackType = getBitflagIcons(form.attack_type, ATTACK_TYPES, ATTACK_TYPE_INFO);
  return `
    <div class="tooltip-content" data-id="${unit.id}">
      <div class="rarity-row">${rarityMap[unit.rarity]}</div>
      <div style="text-align: center;">${form.name_tw}(TW)</div>
      <div style="text-align: center;">${form.name_jp}(JP)</div>
      <div style="text-align: center;">${form.description.replaceAll("|", "<BR>")}</div>
      <div>${getBitflagIcons(form.trait, TRAITS, TRAIT_INFO)}${arrow}${getAbilityIconsFromList(abilityIds, EFFECTS, EFFECT_INFO)}</div>
      ${immunity}
      <div>能力 ${abilities}${attackType}</div>
    </div>
  `;
}

let isMultiSelectMode = false;
document.getElementById("toggleMultiSelectBtn").addEventListener("click", e => {
  isMultiSelectMode = !isMultiSelectMode;
  e.target.textContent = "多選：" + (isMultiSelectMode ? "開" : "關");
  showToast(isMultiSelectMode ? "開啟多選" : "關閉多選");
});

let isClearedHidden = false;
document.getElementById("toggleClearedHiddenBtn").addEventListener("click", e => {
  const root = document.body;
  isClearedHidden = !isClearedHidden;

  root.classList.toggle("hide-cleared", isClearedHidden);
  e.target.textContent = isClearedHidden ? "已通關：隱藏" : "已通關：顯示";
  showToast(isClearedHidden ? "隱藏已通關" : "顯示已通關");
});

function showToast(message) {
  const div = document.createElement("div");
  div.textContent = message;

  Object.assign(div.style, {
    position: "fixed",
    top: "30%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    padding: "12px 20px",
    fontSize: "16px",
    borderRadius: "10px",
    zIndex: 9999,
    pointerEvents: "none", // 不擋住滑鼠操作
    opacity: 0,
    transition: "opacity 0.3s ease"
  });

  document.body.appendChild(div);

  // 淡入
  requestAnimationFrame(() => {
    div.style.opacity = 1;
  });

  // 淡出並移除
  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => div.remove(), 300);
  }, 1200);
}

function switchForm(id) {
  if (resultSet.length === 0 && id == null) return;
  id ??= resultSet[currentIndex];
  const unit = unitMap.get(id);
  let index = parseInt(unit.form_index || "0", 10);
  index = (index + 1) % unit.forms.length;
  unit.form_index = index;
  const img = document.querySelector(`img.unit[data-id="${id}"]`);
  getUnitImgSrc(unit).then(src => {
    img.src = src;
  });
  img.dataset.name = unit.forms[unit.form_index].name_tw;
  img._tippy.setContent(generateTooltipContent(unit));
  img._tippy.show();
  saveState();
}

// switch form & selected
document.addEventListener("click", e => {
  if (e.target.closest('.tool-panel')) return;
  const img = e.target;
  const isMultiple = e.ctrlKey || e.metaKey || isMultiSelectMode;
  if (img.tagName === "IMG" && img.matches(".unit") && !isMultiple) {
    switchForm(img.dataset.id);
  }
  
  const clickedUnit = e.target.closest('.unit');
  if (isMultiple) {
    if (clickedUnit){
      // 多選模式：切換選取狀態
      clickedUnit.classList.toggle('selected');
    }
  } else {
    document.querySelectorAll('.unit').forEach(el => el.classList.remove('selected'));
  }
});


useCache = false;
async function getUnitImgSrc(unit) {
  let imgUrl = `https://battlecatsinfo.github.io/img/u/${unit.id}/${unit.form_index}.png`;
  
  if (unit.cat.egg_id.length > 0 && unit.form_index < 2) {
    const eggid = unit.cat.egg_id.split(',');
    const imgId = unit.form_index == 1 ? eggid[1] : '0';
    imgUrl = `https://battlecatsinfo.github.io/img/s/${imgId}/${unit.form_index}.png`;
  }
  if (!useCache) {
    return imgUrl;
  }
  
  const IMAGE_KEY = `${unit.id}-${unit.form_index}`;
  const db = await openImageDB();
  const tx = db.transaction("images", "readonly");
  const store = tx.objectStore("images");
  const getReq = store.get(IMAGE_KEY);

  const result = await new Promise((resolve, reject) => {
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error);
  });

  if (result && result.blob instanceof Blob) {
    return URL.createObjectURL(result.blob);
  }

  // 若沒快取，抓圖 + 儲存進 IndexedDB
  const response = await fetch(imgUrl);
  const blob = await response.blob();

  const tx2 = db.transaction("images", "readwrite");
  const store2 = tx2.objectStore("images");
  store2.put({ id: IMAGE_KEY, blob });
  
  return URL.createObjectURL(blob);
}

function openImageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ImageDB", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function updateTabCounts() {
  const unitBlocks = document.querySelectorAll('.unit-block');
  unitBlocks.forEach(unitBlock => {
    const tabs = unitBlock.querySelectorAll('.tab-btn');
    let total = 0;
    tabs.forEach(btn => {
      const rarity = btn.dataset.tab;
      const label = rarityMap[btn.dataset.tab];
      const tabContent = unitBlock.querySelector(`.tab-content[data-tab="${rarity}"]`);
      const count = tabContent.querySelectorAll('.unit').length;
      btn.textContent = `${label} (${count})`;
      total += count;
    });
    // 更新右邊統計欄
    const totalLabel = unitBlock.querySelector('.tab-stats .total');
    if (totalLabel) {
      totalLabel.textContent = total;
    }
  });
}

document.body.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.stage, .tooltip-content');
  if (!el) return;
  if (el.classList.contains('stage')) {
    const match = el.dataset.id?.match(/stage-(\d+)/);
    if (!match) return;
    const stageId = match[1];
    const link = `https://battlecatsinfo.github.io/stage.html?s=15-0-${stageId}.html`;
    window.open(link, '_blank');
  }
  else if (el.classList.contains('tooltip-content')) {
    const unitId = el.dataset.id;
    const link = `https://battlecatsinfo.github.io/unit.html?id=${unitId}`;
    window.open(link, '_blank');
  }
});

// tabs switch
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
  
   // 找到最近的 .tabs 容器
    const tabsContainer = btn.closest(".tabs");
    const palette = tabsContainer.closest(".palette");

    // 在這個 palette 範圍內切換 tab
    palette.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    palette.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));

    btn.classList.add("active");
    palette.querySelector(`.tab-content[data-tab="${target}"]`).classList.add("active");
  });
});

let draggedElement = null;
let dragSource = null;
document.addEventListener("dragstart", e => {
  const target = e.target;
  if (target.tagName === "IMG" && (target.classList.contains("unit") || target.classList.contains("stage"))) {
    draggedElement = target;
    dragSource = target.parentElement;
  }
});

function init() {
  const wrapper = document.getElementById("canvas-wrapper");
  const canvases = wrapper.querySelectorAll(".canvas");

  canvases.forEach(canvas => {
    const imgs = canvas.querySelectorAll("img");
    imgs.forEach(img => {
      img.setAttribute("draggable", true);
      const palette = getPaletteByImg(img);
      if (palette) palette.appendChild(img);
    });
    canvas.remove(); // 移除整個 canvas 區塊
  });
  
  const tabs = document.getElementById("disable-units-container");
  const tabContents = tabs.querySelectorAll(".tab-content");
  
  tabContents.forEach(tabContent => {
    const imgs = tabContent.querySelectorAll("img");
  
    imgs.forEach(img => {
      const palette = getPaletteByImg(img);
      if (palette) palette.appendChild(img);
    });
    
  });
  updateTabCounts();
  saveState(); // 更新本地儲存
}

function dropToCanvas(event) {
  event.preventDefault();
  if (!draggedElement) return;

  const canvas = event.currentTarget;
  const isDraggingStage = draggedElement.classList.contains('stage');
  const existingStage = canvas.querySelector('img.stage');

  // 如果是要放 stage 且已有 stage，直接跳出
  if (isDraggingStage && existingStage) {
    showToast("這個區塊已經有關卡圖片了！");
    draggedElement = null;
    dragSource = null;
    return;
  }

  if (dragSource && dragSource !== canvas) {
    if (draggedElement.classList.contains('unit')) {
      const unitGroup = canvas.querySelector('.unit-group');
      const selectedUnits = document.querySelectorAll('.unit.selected');
      const draggedIsSelected = Array.from(selectedUnits).includes(draggedElement);
      const fragment = document.createDocumentFragment();

      if (selectedUnits.length > 1 && draggedIsSelected) {
        selectedUnits.forEach(el => fragment.appendChild(el));
        unitGroup.appendChild(fragment);
      } else {
        unitGroup.appendChild(draggedElement);
      }
    }
    else if (isDraggingStage) {
      canvas.querySelector('.stage-wrapper').appendChild(draggedElement);
    }

    updateTabCounts();
    saveState();
  }

  draggedElement = null;
  dragSource = null;
}

function dropToStages(event) {
  event.preventDefault();
  if (!draggedElement) return;

  // 限制只能是關卡圖（class="stage"）
  if (!draggedElement.classList.contains('stage')) {
    return;
  }

  const palette = event.currentTarget;
  if (dragSource && dragSource !== palette) {
    palette.appendChild(draggedElement);
    saveState();
  }
  draggedElement = null;
  dragSource = null;
}

function switchToTab(dropTarget, rarity) {
  // 取消所有 tab 按鈕 active 狀態
  dropTarget.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // 啟用指定按鈕
  const targetBtn = dropTarget.querySelector(`.tab-btn[data-tab="${rarity}"]`);
  if (targetBtn) targetBtn.classList.add('active');

  // 隱藏所有內容
  dropTarget.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // 顯示對應 tab 內容
  const targetContent = dropTarget.querySelector(`.tab-content[data-tab="${rarity}"]`);
  if (targetContent) targetContent.classList.add('active');
}

function dropToTabs(event) {
  event.preventDefault();
  if (!draggedElement) return;

  const dropTarget = event.currentTarget;
  const selectedUnits = document.querySelectorAll('.unit.selected');

  // 檢查 draggedElement 是否在 selectedUnits 中
  const draggedIsSelected = Array.from(selectedUnits).includes(draggedElement);
  const isMultiSelect = selectedUnits.length > 1 && draggedIsSelected;
  if (isMultiSelect) {
    const fragmentMap = new Map(); // rarity -> DocumentFragment

    selectedUnits.forEach(el => {
      const unit = unitMap.get(el.dataset.id);
      if (!unit) return;

      const rarity = unit.rarity;
      if (!fragmentMap.has(rarity)) {
        fragmentMap.set(rarity, document.createDocumentFragment());
      }

      fragmentMap.get(rarity).appendChild(el);
    });

    // 把每個稀有度的 fragment 丟到正確 tab-content
    fragmentMap.forEach((fragment, rarity) => {
      const correctTab = dropTarget.querySelector(`.tab-content[data-tab="${rarity}"]`);
      if (correctTab) {
        correctTab.appendChild(fragment);
        // 切換到這個 tab
        switchToTab(dropTarget, rarity);
      }
    });

  } else {
    // 單選邏輯
    const unit = unitMap.get(draggedElement.dataset.id);
    const rarity = unit.rarity;
    const correctTab = dropTarget.querySelector(`.tab-content[data-tab="${rarity}"]`);

    if (correctTab) {
      correctTab.appendChild(draggedElement);
      switchToTab(dropTarget, rarity);
    }
  }

  updateTabCounts();
  saveState();

  draggedElement = null;
  dragSource = null;
}

function getPaletteByImg(img) {
  if (img.classList.contains("stage")) {
    return document.getElementById("stages-container");
  } 
  else if (img.classList.contains("unit")) {
    const unit = unitMap.get(img.dataset.id);
    return document.querySelector(`#available-units-container .tab-content[data-tab="${unit.rarity}"]`);
  }
  return null;
}

function getDelBtn(wrapper, canvas) {
  const delBtn = document.createElement("button");
  delBtn.textContent = "✖";
  delBtn.title = "刪除此關卡區域";
  delBtn.classList.add("stage-btn", "del-btn");

  delBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (confirm("確定刪除此關卡區域？")) {
      const imgs = canvas.querySelectorAll("img");
      imgs.forEach(img => {
        const palette = getPaletteByImg(img);
        if (palette) palette.appendChild(img);
        img.setAttribute("draggable", true);
      });
      wrapper.removeChild(canvas);
      updateTabCounts();
      saveState();
    }
  });

  return delBtn;
}

function getClearBtn(canvas) {
  const btn = document.createElement("button");
  btn.textContent = "✔";
  btn.title = "標記為已通關";
  btn.classList.add("stage-btn", "clear-btn");

  btn.addEventListener("click", e => {
    e.stopPropagation();

    const img = canvas.querySelector("img.stage");
    if (img) {
      markStageCleared(img);
    }
  });

  return btn;
}

function markStageCleared(img) {
  const wrapper = img.closest(".stage-wrapper");
  const canvas = img.closest(".canvas");
  if (!wrapper || !canvas) return;

  const isNowCleared = !wrapper.classList.contains("cleared");

  img.setAttribute("draggable", !isNowCleared);

  if (isNowCleared) {
    if (isClearedHidden) {
      // 👉 先淡出
      canvas.classList.add("fading-out");

      setTimeout(() => {
        wrapper.classList.add("cleared");           // ✅ 動畫後才加 cleared
        canvas.classList.remove("fading-out");
        saveState();                                // ✅ 動畫後儲存狀態
      }, 500); // 和 CSS transition 一致
    } else {
      wrapper.classList.add("cleared");
      saveState();
    }
  } else {
    // 取消通關
    wrapper.classList.remove("cleared");
    canvas.classList.remove("fading-out");
    img.setAttribute("draggable", true);
    saveState();
  }
}

function clearAllClearedStages() {
  const confirmed = confirm("確定要取消所有通關標記嗎？");
  if (!confirmed) return;

  const clearedWrappers = document.querySelectorAll(".stage-wrapper.cleared");
  clearedWrappers.forEach(wrapper => {
    wrapper.classList.remove("cleared");

    const img = wrapper.querySelector("img.stage");
    if (img) {
      img.setAttribute("draggable", true);
    }
  });

  saveState(); // 更新 localStorage
  showToast?.("已取消所有通關標記");
}

document.getElementById('canvas-wrapper').addEventListener('click', function (e) {
  const clickedCanvas = e.target.closest('.canvas');

  // 如果有點到某個 .canvas
  if (clickedCanvas) {
    document.querySelectorAll('.canvas').forEach(el => el.classList.remove('selected'));
    clickedCanvas.classList.add('selected');
  } 
  // 如果點到空白處（wrapper 內但不是 canvas）
  else {
    document.querySelectorAll('.canvas.selected').forEach(el => el.classList.remove('selected'));
  }
});

function addCanvas() {
  const wrapper = document.getElementById("canvas-wrapper");
  const newCanvas = document.createElement("div");
  newCanvas.className = "canvas";
  newCanvas.ondragover = e => e.preventDefault();
  newCanvas.ondrop = dropToCanvas;
  newCanvas.style.position = "relative";

  // 刪除按鈕
  const delBtn = getDelBtn(wrapper, newCanvas);
  newCanvas.appendChild(delBtn);
  
  // 新增✔通關按鈕
  const clearBtn = getClearBtn(newCanvas);
  newCanvas.appendChild(clearBtn);
  
  
  const stageWrapper = document.createElement("div");
  stageWrapper.className = "stage-wrapper";
  newCanvas.appendChild(stageWrapper);

  // 內容容器
  const unitGroup = document.createElement("div");
  unitGroup.className = "unit-group";
  newCanvas.appendChild(unitGroup);

  // 找目前被選中的 canvas
  const selected = document.querySelector(".canvas.selected");

  if (selected && selected.parentNode === wrapper) {
    selected.after(newCanvas); // 插入在選中的後面
  } else {
    wrapper.appendChild(newCanvas); // 沒選中時就加在最後
  }

  // 移除所有選取，再選中這個新加的
  document.querySelectorAll('.canvas').forEach(el => el.classList.remove('selected'));
  newCanvas.classList.add('selected');
  newCanvas.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

  saveState();
}
function collectAppState() {
  const wrapper = document.getElementById("canvas-wrapper");
  const disablePalette = document.getElementById("disable-units-container");

  const data = {
    canvasZones: [],
    disabledUnits: {},
    unitFormIndexes: {}
  };

  // 收集 canvas 區塊資料
  wrapper.querySelectorAll(".canvas").forEach(zone => {
    const img = zone.querySelector("img.stage"); // 直接取第一個 stage
    const unitImgs = Array.from(zone.querySelectorAll("img.unit"));

    const stageData = img ? {
      id: img.dataset.id,
      title: img.title,
      isCleared: img.closest(".stage-wrapper")?.classList.contains("cleared") || false
    } : null;

    const zoneData = {
      stage: stageData,  // 改用單一物件
      units: unitImgs.map(img => ({
        id: img.dataset.id,
        name: img.dataset.name
      }))
    };

    data.canvasZones.push(zoneData);
  });

  // 收集禁用單位
  if (disablePalette) {
    disablePalette.querySelectorAll(".tab-content").forEach(tab => {
      const tabId = tab.dataset.tab;
      const units = Array.from(tab.querySelectorAll(".unit")).map(img => ({
        id: img.dataset.id || null,
        name: img.dataset.name
      }));
      data.disabledUnits[tabId] = units;
    });
  }

  // 收集 formIndex
  unitMap.forEach((unit, id) => {
    data.unitFormIndexes[id] = unit.form_index;
  });

  return data;
}

function exportState() {
  const wrapper = document.getElementById("canvas-wrapper");
  const disablePalette = document.getElementById("disable-units-container");
  const data = collectAppState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "canvas_data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function saveState() {
  const data = collectAppState();
  localStorage.setItem("lsCanvasZones", JSON.stringify(data.canvasZones));
  localStorage.setItem("lsDisabledUnits", JSON.stringify(data.disabledUnits));
  localStorage.setItem("lsUnitFormIndexes", JSON.stringify(data.unitFormIndexes));
}

function loadState() {
  const lsCanvasZones = localStorage.getItem("lsCanvasZones");
  if (!lsCanvasZones) return;

  try {
    const canvasZones = JSON.parse(lsCanvasZones);
    const wrapper = document.getElementById("canvas-wrapper");
    wrapper.innerHTML = "";
  
    const lsUnitFormIndexes = localStorage.getItem("lsUnitFormIndexes");
    const unitFormIndexes = JSON.parse(lsUnitFormIndexes);
    Object.keys(unitFormIndexes).forEach(id => {
      const img = document.querySelector(`img.unit[data-id="${id}"]`);
      const unit = unitMap.get(id);
      if (unit.form_index != unitFormIndexes[id]) {
        unit.form_index = unitFormIndexes[id];
        getUnitImgSrc(unit).then(src => {
          img.src = src;
        });
        img.dataset.name = unit.forms[unit.form_index].name_tw;
        img._tippy.setContent(generateTooltipContent(unit));
      }
    });

    canvasZones.forEach(zoneDatas => {
      const canvas = document.createElement("div");
      canvas.className = "canvas";
      canvas.style.position = "relative";
      canvas.ondragover = e => e.preventDefault();
      canvas.ondrop = dropToCanvas;

      const delBtn = getDelBtn(wrapper, canvas);
      canvas.appendChild(delBtn);
      
      // 新增✔通關按鈕
      const clearBtn = getClearBtn(canvas);
      canvas.appendChild(clearBtn);

      // 搬移 stage 單位
      const stageWrapper = document.createElement("div");
      stageWrapper.className = "stage-wrapper";
      canvas.appendChild(stageWrapper);
      // 兼容新舊資料結構
      const stageData = zoneDatas.stage || (zoneDatas.stages ? zoneDatas.stages[0] : null);
      if (stageData) {
        const imgStage = document.querySelector(`img.stage[data-id="${stageData.id}"]`);
        if (imgStage) stageWrapper.appendChild(imgStage);
        if (stageData.isCleared) {
          stageWrapper.classList.add('cleared');
          imgStage.setAttribute('draggable', false);
        }
      }
      
      // 搬移 cat 單位
      const unitGroup = document.createElement("div");
      unitGroup.className = "unit-group";
      canvas.appendChild(unitGroup);
      zoneDatas.units.forEach(unit => {
        const img = document.querySelector(`img.unit[data-id="${unit.id}"]`);
        if (img) unitGroup.appendChild(img);
      });

      wrapper.appendChild(canvas);
    });

    // 處理 disabledUnits palette（只搬移，不 create）
    const lsDisabledUnits = localStorage.getItem("lsDisabledUnits");
    const disabledUnits = JSON.parse(lsDisabledUnits);
    const disablePalette = document.getElementById("disable-units-container");

    Object.keys(disabledUnits).forEach(rarity => {
      const tabContent = disablePalette.querySelector(`.tab-content[data-tab="${rarity}"]`);
      disabledUnits[rarity].forEach(unit => {
        const img = document.querySelector(`img.unit[data-id="${unit.id}"]`);
        if (img) tabContent.appendChild(img);
      });
    });
  
    updateTabCounts();
  } catch (e) {
    console.warn("載入失敗", e);
  }
}

document.getElementById("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      init();
      const data = JSON.parse(evt.target.result);
      localStorage.setItem("lsCanvasZones", JSON.stringify(data.canvasZones));
      localStorage.setItem("lsDisabledUnits", JSON.stringify(data.disabledUnits));
      localStorage.setItem("lsUnitFormIndexes", JSON.stringify(data.unitFormIndexes));
      loadState();
    } catch {
      alert("格式錯誤");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.querySelectorAll('.icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('selected');
  });
});

function getSelectedFilters(group) {
  const selected = document.querySelectorAll(`.filters-group.${group}-group .icon-btn.selected`);
  return Array.from(selected).map(el => ({ ...el.dataset }));
}

let isOr = true;

function toggleLogic() {
  isOr = !isOr;
  const btn = document.getElementById('logicToggle');
  btn.textContent = isOr ? 'OR' : 'AND';
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('selected');
  });
});

// 取得選取稀有度條件
function getSelectedRarities() {
  return [...document.querySelectorAll('.filter-btn.selected')]
    .map(btn => btn.dataset.rarity);
}

function clearFilters() {
  document.querySelectorAll('.icon-btn.selected, .filter-btn.selected').forEach(btn => {
    btn.classList.remove('selected');
  });

  const searchBox = document.querySelector('#search-box');
  if (searchBox) searchBox.value = '';
  resultSet = [];
  document.querySelectorAll('#search-results-length, #search-results').forEach(el => {
    el.textContent = "";
  });
  document.querySelectorAll('.unit.selected').forEach(el => el.classList.remove('selected'));
}

function getUnitLocation(id) {
  const img = document.querySelector(`img.unit[data-id="${id}"]`);
  if (!img) return null;

  if (img.closest('#available-units-container')) return 'available';
  if (img.closest('#disable-units-container')) return 'disabled';
  if (img.closest('#canvas-wrapper')) return 'deploy';

  return null;
}

let resultSet = [];
let currentIndex = -1;

document.getElementById('search-box').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    searchUnits(); // 直接執行搜尋
  }
});
document.addEventListener('keydown', e => {
  if (e.code  === 'KeyQ') {
    query();
  }
  else if (e.code  === 'KeyS') {
    switchForm();
  }
  else if (e.code  === 'KeyA') {
    add();
  }
  else if (e.code  === 'Escape') {
    document.querySelectorAll('.unit.selected').forEach(el => el.classList.remove('selected'));
  }
});

function matchBitflag(unit, field, selectedBitflag, logicMode) {
  return selectedBitflag === 0 ||
    unit.forms.some(form => {
      if (!form[field]) return false;
      return logicMode === 'OR'
        ? (form[field] & selectedBitflag) !== 0
        : (form[field] & selectedBitflag) === selectedBitflag;
    });
}

function matchIdList(unit, selectedIds, logicMode) {
  return selectedIds.length === 0 || unit.forms.some(form => {
    const ids = extractAbilityIds(form.ability);
    if (!Array.isArray(ids)) return false;

    return logicMode === 'OR'
      ? selectedIds.some(id => ids.includes(id))
      : selectedIds.every(id => ids.includes(id));
  });
}

function searchUnits() {
  const searchBox = document.querySelector('#search-box');
  const lowerKeyword = searchBox.value.toLowerCase();
  const selectedScope = document.getElementById("unit-Scope").value; // "", "available", "deploy", "disabled"
  const selectedRarities = getSelectedRarities(); // e.g., ["3", "4"]
  const selectedLogic = document.getElementById('logicToggle');
  const logicMode = selectedLogic.textContent.trim(); // 'OR' 或 'AND'
  let selectedTraitsBitflag = 0;
  getSelectedFilters("traits").forEach(obj => {
    if (TRAITS[obj.trait]) {
      selectedTraitsBitflag |= TRAITS[obj.trait];
    }
  });
  let selectedAttackTypesBitflag = 0;
  getSelectedFilters("attack-types").forEach(obj => {
    if (ATTACK_TYPES[obj.attack]) {
      selectedAttackTypesBitflag |= ATTACK_TYPES[obj.attack];
    }
  });
  let selectedImmunitiesBitflag = 0;
  getSelectedFilters("immunities").forEach(obj => {
    if (IMMUNITIES[obj.immunity]) {
      selectedImmunitiesBitflag |= IMMUNITIES[obj.immunity];
    }
  });
  const selectedEffects = getSelectedFilters("effects").map(obj => obj.effect);
  const selectedEffectIds = selectedEffects.map(effect => EFFECTS[effect]).filter(Boolean);
  const selectedAbilities = getSelectedFilters("abilities").map(obj => obj.ability);
  const selectedAbilityIds = selectedAbilities.map(ability => ABILITIES[ability]).filter(Boolean);
  
  resultSet = [];
  unitMap.forEach(unit => {
    const unitScope = getUnitLocation(unit.id);
    const matchScope = selectedScope === "" || unitScope === selectedScope;
    const matchNameTW = unit.forms.some(form => form.name_tw.toLowerCase().includes(lowerKeyword));
    const matchNameJP = unit.forms.some(form => form.name_jp.toLowerCase().includes(lowerKeyword));
    const matchName = matchNameTW || matchNameJP;
    const matchRarity = selectedRarities.length === 0 || selectedRarities.includes(String(unit.rarity));
    const matchTraits = matchBitflag(unit, 'trait', selectedTraitsBitflag, logicMode);
    const matchAttackTypes = matchBitflag(unit, 'attack_type', selectedAttackTypesBitflag, logicMode);
    const matchImmunities = matchBitflag(unit, 'immunity', selectedImmunitiesBitflag, logicMode);
    const matchEffects = matchIdList(unit, selectedEffectIds, logicMode);
    const matchAbilities = matchIdList(unit, selectedAbilityIds, logicMode);
  
    const subFilters = [
      { active: selectedEffectIds.length > 0, match: matchEffects },
      { active: selectedAbilityIds.length > 0, match: matchAbilities },
      { active: selectedAttackTypesBitflag !== 0, match: matchAttackTypes },
      { active: selectedImmunitiesBitflag !== 0, match: matchImmunities }
    ];

    const activeMatches = subFilters.filter(c => c.active).map(c => c.match);
    const isSubFilterMatch = activeMatches.length === 0 ||
      (logicMode === 'AND'
        ? activeMatches.every(Boolean)
        : activeMatches.some(Boolean));

    if (matchScope && matchName && matchRarity && matchTraits && isSubFilterMatch) {
      resultSet.push(unit.id);
    }
  });

  currentIndex = resultSet.length > 0 ? 0 : -1;
  document.querySelector('#search-results-length').textContent = `${resultSet.length} 符合`;
  if (currentIndex !== -1) {
    highlightUnit(resultSet[currentIndex]);
  } else {
    document.querySelector('#search-results').textContent = "";
  }
}

function highlightUnit(id) {
  // 在所有可能容器中尋找圖片
  const img = document.querySelector(`img.unit[data-id="${id}"]`);
  
  if (img) {
    // 自動切換到對應 tab（僅限於 tab 區塊）
    const tabContent = img.closest(".tab-content");
    if (tabContent) {
      const container = tabContent.closest(".unit-block");
      const tabValue = tabContent.dataset.tab;
      
      // 找到對應的 tab 按鈕並觸發切換
      const tabBtn = container.querySelector(`.tab-btn[data-tab="${tabValue}"]`);
      if (tabBtn && !tabBtn.classList.contains("active")) {
        tabBtn.click();
      }
    }

    // 滾動與高亮
    img.scrollIntoView({ behavior: "smooth", block: "nearest" });
    img.classList.remove("highlight"); // 移除舊的再加，重置動畫
    void img.offsetWidth; // 觸發 reflow，強制動畫重新啟動
    img.classList.add("highlight");

    document.querySelectorAll('.unit.selected').forEach(el => el.classList.remove('selected'));
    img.classList.add("selected");
    setTimeout(() => img.classList.remove("highlight"), 1000);
    const canvas = img.closest(".canvas");
    const isHidden = canvas && canvas.offsetParent === null;
    if (!isHidden) showTippyWhenVisible(img);

    document.querySelector('#search-results').textContent = `${currentIndex + 1}`;
  } else {
    console.warn(`Unit with ID ${id} not found in DOM`);
  }
}

function showTippyWhenVisible(img) {
  const observer = new IntersectionObserver(([entry], obs) => {
    if (entry.isIntersecting) {
      img._tippy.show();
      obs.disconnect(); // 只監聽一次
    }
  }, { threshold: 0.8 });

  observer.observe(img);
}

function next() {
  if (resultSet.length === 0) return;
  currentIndex = (currentIndex + 1) % resultSet.length;
  highlightUnit(resultSet[currentIndex]);
}

function prev() {
  if (resultSet.length === 0) return;
  currentIndex = (currentIndex - 1 + resultSet.length) % resultSet.length;
  highlightUnit(resultSet[currentIndex]);
}

function add() {
  if (resultSet.length === 0) return;
  const id = resultSet[currentIndex];
  const img = document.querySelector(`#available-units-container img.unit[data-id="${id}"]`);
  const container = document.querySelector('.canvas.selected .unit-group');
  if (img && container) {
    container.appendChild(img);
    img._tippy.hide();
    updateTabCounts();
    saveState();
  }
}

function query() {
  if (resultSet.length === 0) return;
  const link = `https://battlecatsinfo.github.io/unit.html?id=${resultSet[currentIndex]}`;
  window.open(link, '_blank');
}