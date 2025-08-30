/* =========================================================
   SUCSA – Smart Events Renderer
   - Loads /data/events.json
   - Renders Upcoming (with countdown), Live, and Past
   - Auto-updates every second; moves items at the right time
   - Safe to include on multiple pages (works if sections exist)
   ========================================================= */

/* ---------- Config ---------- */
const EVENTS_JSON_URL = "data/events.json";
const DEFAULT_DURATION_HOURS = 8; // used if "end" is missing

/* ---------- Utils ---------- */
function $(sel) {
  return document.querySelector(sel);
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function parseDateSafe(dt) {
  // Treats ISO without Z as local time (good for EAT)
  const d = new Date(dt);
  return isNaN(d) ? null : d;
}

function formatDateTime(dt) {
  // e.g., Sat, Nov 15, 2025 • 9:00 AM
  return dt.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatCountdown(ms) {
  if (ms <= 0) return "0d 0h 0m 0s";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/* Determine status: UPCOMING, LIVE, PAST */
function getStatus(now, start, end) {
  if (now < start) return "UPCOMING";
  if (now >= start && now < end) return "LIVE";
  return "PAST";
}

/* Build a single event card */
function buildEventCard(evt, now) {
  const start = parseDateSafe(evt.start);
  const end = evt.end ? parseDateSafe(evt.end) :
    new Date(parseDateSafe(evt.start).getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);

  if (!start) return null;

  const status = getStatus(now, start, end);

  const card = createEl("article", `event-card status-${status.toLowerCase()}`);
  const titleRow = createEl("div", "event-title-row");
  const title = createEl("h3", "event-title", evt.name);
  const badge = createEl("span", "event-badge", status === "UPCOMING" ? "Upcoming" : status === "LIVE" ? "Live Now" : "Past");
  titleRow.appendChild(title);
  titleRow.appendChild(badge);

  const when = createEl("p", "event-when", `${formatDateTime(start)} – ${formatDateTime(end)}`);
  const where = evt.location ? createEl("p", "event-where", evt.location) : null;
  const desc = createEl("p", "event-desc", evt.description || "");

  const statusLine = createEl("p", "event-status");
  if (status === "UPCOMING") {
    const ms = start.getTime() - now.getTime();
    statusLine.textContent = `Starts in: ${formatCountdown(ms)}`;
  } else if (status === "LIVE") {
    statusLine.textContent = "Event is live!";
  } else {
    statusLine.textContent = "This event has passed.";
  }

  card.appendChild(titleRow);
  card.appendChild(when);
  if (where) card.appendChild(where);
  card.appendChild(desc);
  card.appendChild(statusLine);

  return { card, status, start, end };
}

/* Render function (idempotent) */
function renderAll(data) {
  const upWrap = $("#upcoming-events");
  const pastWrap = $("#past-events");

  // If this page doesn't have these containers, do nothing safely.
  if (!upWrap && !pastWrap) return;

  const now = new Date();

  // Reset
  if (upWrap) upWrap.innerHTML = "";
  if (pastWrap) pastWrap.innerHTML = "";

  const upcoming = [];
  const live = [];
  const past = [];

  data.events.forEach(evt => {
    const start = parseDateSafe(evt.start);
    if (!start) return;
    const end = evt.end ? parseDateSafe(evt.end) :
      new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    const status = getStatus(now, start, end);
    if (status === "UPCOMING") upcoming.push(evt);
    else if (status === "LIVE") live.push(evt);
    else past.push(evt);
  });

  // Sort: upcoming asc by start; live asc by start; past desc by end
  const byStartAsc = (a, b) => new Date(a.start) - new Date(b.start);
  const byEndDesc = (a, b) => {
    const ae = a.end ? new Date(a.end) : new Date(new Date(a.start).getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    const be = b.end ? new Date(b.end) : new Date(new Date(b.start).getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
    return be - ae;
  };

  upcoming.sort(byStartAsc);
  live.sort(byStartAsc);
  past.sort(byEndDesc);

  // Render Upcoming (Live first, then upcoming)
  if (upWrap) {
    const wrapper = createEl("div", "events-grid");

    const renderList = (list) => {
      list.forEach(evt => {
        const built = buildEventCard(evt, new Date());
        if (built && built.card) wrapper.appendChild(built.card);
      });
    };

    // If any live, show them at the top
    if (live.length) renderList(live);
    if (upcoming.length) renderList(upcoming);

    if (!live.length && !upcoming.length) {
      upWrap.appendChild(createEl("p", "empty-msg", "No upcoming events at the moment."));
    } else {
      upWrap.appendChild(wrapper);
    }
  }

  // Render Past
  if (pastWrap) {
    const wrapper = createEl("div", "events-grid");
    past.forEach(evt => {
      const built = buildEventCard(evt, new Date());
      if (built && built.card) wrapper.appendChild(built.card);
    });
    if (!past.length) {
      pastWrap.appendChild(createEl("p", "empty-msg", "No past events yet."));
    } else {
      pastWrap.appendChild(wrapper);
    }
  }
}

/* Auto-refresh every second to update countdowns & status */
let EVENTS_CACHE = null;
let RENDER_TIMER = null;

async function loadEvents() {
  try {
    const res = await fetch(EVENTS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events.json");
    const json = await res.json();
    if (!json || !Array.isArray(json.events)) throw new Error("Invalid events.json format");
    EVENTS_CACHE = json;
    renderAll(EVENTS_CACHE);

    // Start/Restart the interval
    if (RENDER_TIMER) clearInterval(RENDER_TIMER);
    RENDER_TIMER = setInterval(() => {
      renderAll(EVENTS_CACHE);
    }, 1000);
  } catch (err) {
    console.error(err);
    // Fallback to the two provided events if fetch fails (e.g., local file://)
    EVENTS_CACHE = {
      events: [
        {
          name: "Health Camp",
          start: "2025-11-15T09:00:00",
          end: "2025-11-15T17:00:00",
          location: "Seme Sub-County Hospital",
          description: "A health outreach program with Red Cross, Aga Khan, and other partners."
        },
        {
          name: "Agricultural Expo",
          start: "2025-12-02T10:00:00",
          end: "2025-12-02T16:00:00",
          location: "Seme Resource Centre Grounds",
          description: "An expo showcasing modern agricultural practices and innovations."
        }
      ]
    };
    renderAll(EVENTS_CACHE);
    if (RENDER_TIMER) clearInterval(RENDER_TIMER);
    RENDER_TIMER = setInterval(() => renderAll(EVENTS_CACHE), 1000);
  }
}

/* Kick off when DOM is ready */
document.addEventListener("DOMContentLoaded", loadEvents);
