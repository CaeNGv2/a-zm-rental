

// Programmatic navigation items list (synced across desktop & mobile)
const NAV_ITEMS = [
  { name: "Fleet", href: "book.html" },
  { name: "My Bookings", href: "bookings.html" },
  { name: "How It Works", href: "index.html#why-azoom" },
  { name: "FAQ", href: "#" },
  // { name: "Contact Us", href: "#" },
];

function renderNavItems() {
  const containers = document.querySelectorAll(".header-js-nav-container");
  containers.forEach((container) => {
    container.innerHTML = "";
    NAV_ITEMS.forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.name;
      if (item.class) {
        a.classList.add(item.class);
      }
      container.appendChild(a);
    });
  });
}



async function updateHeaderUser() {
  console.log("updateHeaderUser"); // dbg

  
  //const userId = window.siteApi.getCurrentUserId();
  const user = await window.siteApi.getCurrentUserProfile();
  const userEl = document.getElementById("header-user-id");
  const userNameEl = document.getElementById("header-user-name");
  const userStatusText = document.getElementById("header-user-status-text");
  const logoutBtn = document.getElementById("header-logout-btn");
  const loginLink = document.getElementById("header-login-btn");

  if (userStatusText) {
    if (user) {
      userStatusText.textContent = `Hello, ${user.name || user.id}!`;
    } else {
      userStatusText.textContent = "Please log in.";
    }
  }

  if (logoutBtn) {
    logoutBtn.style.display = user ? "inline-block" : "none";
    logoutBtn.onclick = () => {
      window.siteApi.logout();
    };
  }

  if (loginLink) {
    loginLink.style.display = user ? "none" : "inline-block";
  }

  if (userEl) {
    if (user) {
      userEl.textContent = user.id;
      if (userNameEl) userNameEl.textContent = user.name;
    } else {
      userEl.textContent = "Guest";
      if (userNameEl) userNameEl.textContent = "Guest";
    }
  }

  // Also sync any optional page-level user-id displays
  document.querySelectorAll(".display-user-id").forEach((el) => {
    el.textContent = user?.id ?? "Guest (Not logged in)";
  });
  document.querySelectorAll(".action-logout").forEach((el) => {
    const btn = /** @type {HTMLButtonElement} */ (el);
    btn.style.display = user ? "inline" : "none";
    btn.onclick = () => {
      window.siteApi.logout();
      //window.location.reload();
    };
  });
}

// Listen when this component loaded
export function onMounted() {
  renderNavItems();
  updateHeaderUser();
};

// when auth change
window.addEventListener("authChange", updateHeaderUser);
