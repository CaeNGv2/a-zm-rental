

async function updateHeaderUser() {
  console.log("updateHeaderUser"); // dbg

  
  //const userId = window.siteApi.getCurrentUserId();
  const user = await window.siteApi.getCurrentUserProfile();
  const userEl = document.getElementById("header-user-id");
  const userNameEl = document.getElementById("header-user-name");
  const logoutBtn = document.getElementById("header-logout-btn");
  const loginLink = document.getElementById("header-login-btn");

  if (userEl) {
    if (user) {
      userEl.textContent = user.id;
      userNameEl.textContent = user.name;
      
      if (logoutBtn) {
        logoutBtn.style.display = "inline";
        logoutBtn.onclick = () => {
          window.siteApi.logout();
          //window.location.reload();
        };
      }
      if (loginLink) {
        loginLink.style.display = "none";
      }
    } else {
      userEl.textContent = "Guest";
      userNameEl.textContent = "Guest";
      if (logoutBtn) {
        logoutBtn.style.display = "none";
      }
      if (loginLink) {
        loginLink.style.display = "inline";
      }
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
window.onMounted(updateHeaderUser);
// when auth change
window.addEventListener("authChange", updateHeaderUser)
