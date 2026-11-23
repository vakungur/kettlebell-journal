"use strict";

// Каждая строка содержит название, план и применимый инвентарь.
const program = {
  "День 1": [
    [["Махи гирей", "4×15", "k"], ["Отжимания с жилетом", "4×10–12", "v"]],
    [["Тяга гири в наклоне", "3×10/рука", "k"], ["Гоблет-присед с жилетом", "3×12", "kv"]],
    [["Подъём гири на бицепс", "3×10/рука", "k"], ["Разгибание рук с гирей из-за головы", "3×12", "k"]],
    [["Скручивания с гирей на груди", "3×15", "k"], ["Подъём ног лёжа", "3×15", ""]]
  ],
  "День 2": [
    [["Взятие гири на грудь с жимом", "4×6/рука", "k"], ["Отжимания с жилетом, ноги на возвышении", "4×8–10", "v"]],
    [["Тяга гири в наклоне двумя руками", "3×12", "k"], ["Румынская тяга с гирей и жилетом", "3×12", "kv"]],
    [["Подъём гири на бицепс «молотом»", "3×10/рука", "k"], ["Узкие отжимания с жилетом", "3×10", "v"]],
    [["Ветряная мельница", "3×6/сторону", "k"], ["Русские скручивания с гирей", "3×20", "k"]]
  ],
  "День 3": [
    [["Рывок гири", "4×8/рука", "k"], ["Жим гири лёжа на полу", "4×10/рука", "k"]],
    [["Пуловер с гирей лёжа", "3×12", "k"], ["Выпады назад с гирей и жилетом", "3×10/нога", "kv"]],
    [["Концентрированный подъём гири на бицепс", "3×10/рука", "k"], ["Французский жим гирей лёжа", "3×12", "k"]],
    [["Турецкий подъём", "3×3/сторону", "k"], ["Скручивания с жилетом", "3×15", "v"]]
  ]
};

const $ = id => document.getElementById(id);
const key = "kettlebell-journal:" + new URL(".", location.href).pathname;
const days = Object.keys(program);
const drafts = new Map();
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });
const numericFields = ["kettlebellWeight", "vestWeight", "setsDone", "rpe"];
let view;
let noticeTimer;

function element(tag, text, className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function notice(message, isError = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", isError);
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $("notice").textContent = ""; }, isError ? 9000 : 4500);
}

// Резервные копии и хранилище используют один валидатор.
function decode(raw) {
  const data = JSON.parse(raw);
  const records = Array.isArray(data) ? data : data?.version === 1 ? data.workouts : null;
  if (!Array.isArray(records)) throw Error("Ожидается JSON журнала версии 1 или массив тренировок.");

  const ids = new Set();
  return records.map((record, index) => {
    const invalid = () => { throw Error(`Проверь запись №${index + 1} в JSON.`); };
    const { id, date, day, exercises } = record ?? {};
    if (typeof id !== "string" || !id.trim() || ids.has(id) ||
        typeof date !== "string" || !Number.isFinite(Date.parse(date)) ||
        !days.includes(day) || !Array.isArray(exercises) || !exercises.length) invalid();
    ids.add(id);
    return {
      id, date: new Date(date).toISOString(), day,
      exercises: exercises.map(exercise => {
        const { name, target, completed = false, repsDone = "", comment = "" } = exercise ?? {};
        if (typeof name !== "string" || !name.trim() || typeof target !== "string" ||
            typeof completed !== "boolean" || typeof repsDone !== "string" ||
            typeof comment !== "string") invalid();
        const values = {};
        for (const field of numericFields) {
          const value = exercise[field] ?? null;
          if (value !== null && (!Number.isFinite(value) || value < 0)) invalid();
          values[field] = value;
        }
        const { setsDone, rpe } = values;
        if (setsDone !== null && !Number.isInteger(setsDone)) invalid();
        if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) invalid();
        return { name, target, ...values, repsDone, rpe, completed, comment };
      })
    };
  });
}

function read() {
  return decode(localStorage.getItem(key) ?? "[]");
}

function encode(workouts) {
  return JSON.stringify({ version: 1, workouts }, null, 2);
}

// Web Locks защищает цикл чтения и записи при открытии журнала в нескольких вкладках.
function write(task) {
  return navigator.locks ? navigator.locks.request(key, task) : task();
}

function store(workouts) {
  localStorage.setItem(key, encode(workouts));
}

function buildWorkout(day) {
  const container = document.createElement("div");
  program[day].forEach((pair, index) => {
    const group = element("div", "", "group");
    group.append(element("h3", `Суперсет ${index + 1}`));
    for (const [name, target, gear] of pair) {
      const card = $("exercise").content.firstElementChild.cloneNode(true);
      card.querySelector(".exercise-name").textContent = name;
      card.querySelector(".target").textContent = target;
      if (!gear.includes("k")) card.querySelector('[data-gear="kettlebell"]').remove();
      if (!gear.includes("v")) card.querySelector('[data-gear="vest"]').remove();
      group.append(card);
    }
    container.append(group);
  });
  drafts.set(day, container);
  return container;
}

function updateCompletion() {
  const cards = $("groups").querySelectorAll(".exercise");
  let done = 0;
  for (const card of cards) {
    const checked = card.querySelector("[name=completed]").checked;
    card.dataset.done = checked;
    done += Number(checked);
  }
  $("completion").textContent = `${done} из ${cards.length} выполнено`;
}

function show(next) {
  view = next;
  const isDay = days.includes(next);
  $("workout").hidden = !isDay;
  $("stats").hidden = next !== "stats";
  $("backup").hidden = next !== "backup";
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", button.dataset.view === next);
  }
  if (isDay) {
    $("day-title").textContent = next;
    $("groups").replaceChildren(drafts.get(next) ?? buildWorkout(next));
    updateCompletion();
  }
  if (next === "stats") renderStats();
}

function collect() {
  return [...$("groups").querySelectorAll(".exercise")].map(card => {
    const field = name => card.querySelector(`[name="${name}"]`);
    const values = Object.fromEntries(numericFields.map(name => {
      const input = field(name);
      return [name, input?.value ? input.valueAsNumber : null];
    }));
    return {
      name: card.querySelector(".exercise-name").textContent,
      target: card.querySelector(".target").textContent,
      ...values,
      repsDone: field("repsDone").value.trim(),
      completed: field("completed").checked,
      comment: field("comment").value.trim()
    };
  });
}

function renderStats() {
  $("summary").replaceChildren();
  $("history").replaceChildren();
  let all;
  try {
    all = read().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  } catch {
    $("history").textContent = "История недоступна. Проверь настройки браузера или восстанови копию через импорт.";
    return;
  }
  const scores = all.flatMap(record => record.exercises)
    .map(exercise => exercise.rpe).filter(rpe => rpe !== null);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const metrics = [
    ["Всего тренировок", all.length],
    ["Последняя тренировка", all.length ? dateFormat.format(new Date(all[0].date)) : "—"],
    ["Средняя сложность", average === null ? "—" : average.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " / 10"],
    ...days.map(day => [day, all.filter(record => record.day === day).length])
  ];
  for (const [label, value] of metrics) {
    const metric = element("div", "", "metric");
    metric.append(element("span", label, "muted"), element("strong", value));
    $("summary").append(metric);
  }
  const selected = $("filter").value;
  const filtered = all.filter(record => !selected || record.day === selected);
  $("history").append(...filtered.map(renderRecord));
  if (!filtered.length) $("history").textContent = selected ? "За этот день записей пока нет." : "Пока нет сохранённых тренировок.";
}

function renderRecord(record) {
  const item = element("details", "", "record");
  const date = dateFormat.format(new Date(record.date));
  const list = document.createElement("ul");
  for (const e of record.exercises) {
    const row = element("li", "");
    row.append(element("strong", `${e.name} · ${e.target}`));
    const details = [
      e.completed ? "Выполнено" : "Без отметки",
      e.kettlebellWeight === null ? "" : `гиря ${e.kettlebellWeight} кг`,
      e.vestWeight === null ? "" : `жилет ${e.vestWeight} кг`,
      e.setsDone === null ? "" : `подходы ${e.setsDone}`,
      e.repsDone ? `повторы ${e.repsDone}` : "",
      e.rpe === null ? "" : `RPE ${e.rpe}/10`
    ];
    row.append(element("small", details.filter(Boolean).join(" · ")));
    if (e.comment) row.append(element("small", e.comment));
    list.append(row);
  }
  const remove = element("button", "Удалить запись", "danger");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (!confirm(`Удалить тренировку «${record.day}» за ${date}?`)) return;
    try {
      await write(() => store(read().filter(entry => entry.id !== record.id)));
      renderStats();
      notice("Запись удалена.");
    } catch {
      notice("Не удалось удалить запись.", true);
    }
  });
  item.append(element("summary", `${record.day} · ${date}`), list, remove);
  return item;
}

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => show(button.dataset.view));
}
$("training").addEventListener("change", updateCompletion);
$("training").addEventListener("invalid", event => { event.target.closest("details").open = true; }, true);
$("training").addEventListener("submit", async event => {
  event.preventDefault();
  const exercises = collect();
  if (!exercises.some(e => e.completed || e.repsDone || e.comment || numericFields.some(key => e[key] !== null))) {
    notice("Введи результат или отметь хотя бы одно упражнение.", true);
    return;
  }
  const day = view;
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, "0")).join("");
  const record = { id, date: new Date().toISOString(), day, exercises };
  const submit = $("training").querySelector("button[type=submit]");
  // Блокируем редактирование этого черновика до завершения записи.
  const fields = drafts.get(day).querySelectorAll("input, textarea");
  submit.disabled = true;
  fields.forEach(field => { field.disabled = true; });
  try {
    await write(() => store([...read(), record]));
    drafts.delete(day);
    if (view === day) show(day);
    if (view === "stats") renderStats();
    notice("Тренировка сохранена.");
  } catch {
    notice("Не удалось сохранить тренировку. Проверь доступ и свободное место в браузере.", true);
  } finally {
    fields.forEach(field => { field.disabled = false; });
    submit.disabled = false;
  }
});

$("filter").addEventListener("change", renderStats);
window.addEventListener("storage", event => {
  if (view === "stats" && (event.key === key || event.key === null)) renderStats();
});

$("export").addEventListener("click", () => {
  try {
    const blob = new Blob([encode(read())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = element("a", "");
    link.href = url;
    link.download = `kettlebell-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    notice("Не удалось экспортировать историю.", true);
  }
});

function updateModeHint() {
  $("import-hint").textContent = $("mode").value === "replace"
    ? "Файл заменит всю текущую историю."
    : "Будут добавлены новые записи. При совпадении ID останется текущая запись.";
}
$("mode").addEventListener("change", updateModeHint);
$("import").addEventListener("submit", async event => {
  event.preventDefault();
  const file = $("file").files[0];
  const replace = $("mode").value === "replace";
  const submit = $("import").querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const incoming = decode(await file.text());
    await write(() => {
      const current = replace ? [] : read();
      const ids = new Set(current.map(record => record.id));
      const added = incoming.filter(record => !ids.has(record.id));
      const message = replace
        ? `Заменить всю историю данными из файла? Записей в файле: ${incoming.length}.`
        : `Объединить историю? Новых записей: ${added.length}. Совпадений: ${incoming.length - added.length}.`;
      if (!confirm(message)) return;
      store([...current, ...added]);
      $("file").value = "";
      if (view === "stats") renderStats();
      notice(replace ? `История заменена. Записей: ${incoming.length}.` : `Добавлено записей: ${added.length}.`);
    });
  } catch (error) {
    const message = error instanceof SyntaxError ? "Выбранный файл содержит некорректный JSON." : error.message;
    notice(`Импорт не выполнен. ${message}`, true);
  } finally {
    submit.disabled = false;
  }
});

$("reset").addEventListener("click", async () => {
  if (!confirm("Удалить все тренировки из этого браузера? Для восстановления понадобится JSON-копия.")) return;
  try {
    await write(() => store([]));
    if (view === "stats") renderStats();
    notice("История очищена.");
  } catch {
    notice("Не удалось очистить историю.", true);
  }
});

show(days[0]);
updateModeHint();

// Установка и автономный запуск доступны на HTTPS и localhost.
if (window.isSecureContext && location.protocol !== "file:" && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.warn("Автономный режим недоступен:", error);
  });
}
