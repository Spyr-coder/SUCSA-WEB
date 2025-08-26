// ===============================
// Events Data
// ===============================
const events = [
  
  {
    name: "Health Camp",
    date: "2025-11-15T09:00:00",
    description: "A health outreach program with Red Cross, Aga Khan, and other partners."
  },
  {
    name: "Agricultural Expo",
    date: "2025-12-02T10:00:00",
    description: "An expo showcasing modern agricultural practices and innovations."
  }
];

// ===============================
// Helper Function - Format Time
// ===============================
function formatTime(ms) {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// ===============================
// Render Events
// ===============================
function renderEvents() {
  const upcomingContainer = document.getElementById("upcoming-events");
  const pastContainer = document.getElementById("past-events");

  // Clear containers before re-rendering
  upcomingContainer.innerHTML = "";
  pastContainer.innerHTML = "";

  const now = new Date();

  events.forEach(event => {
    const eventDate = new Date(event.date);
    const eventDiv = document.createElement("div");
    eventDiv.classList.add("event");

    // Event Title & Description
    const title = document.createElement("h3");
    title.textContent = event.name;

    const desc = document.createElement("p");
    desc.textContent = event.description;

    const timer = document.createElement("p");
    timer.classList.add("timer");

    // Decide where to place event
    if (eventDate > now) {
      // Still upcoming
      timer.textContent = "Loading countdown...";

      eventDiv.appendChild(title);
      eventDiv.appendChild(desc);
      eventDiv.appendChild(timer);

      upcomingContainer.appendChild(eventDiv);

      // Update countdown every second
      const interval = setInterval(() => {
        const nowTime = new Date().getTime();
        const distance = eventDate.getTime() - nowTime;

        if (distance <= 0) {
          clearInterval(interval);
          timer.textContent = "Event has started!";
        } else {
          timer.textContent = "Starts in: " + formatTime(distance);
        }
      }, 1000);

    } else {
      // Event already passed
      timer.textContent = "This event has passed.";

      eventDiv.appendChild(title);
      eventDiv.appendChild(desc);
      eventDiv.appendChild(timer);

      pastContainer.appendChild(eventDiv);
    }
  });
}

// ===============================
// Run when page loads
// ===============================
document.addEventListener("DOMContentLoaded", renderEvents);
