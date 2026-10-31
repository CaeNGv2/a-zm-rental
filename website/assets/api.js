// Mock API simulating server responses and processing
class ServerApi {
  constructor() {
    this.#initMockDb();
  }

  /**
   * Fetch fleet details (models + physical fleet status)
   * @returns {Promise<{status: number, data: {models: Array<any>, fleet: Array<any>}}>}
   */
  async getFleet() {
    console.log("getFleet")
    await this.#mockDelay();
    // let fleetData = JSON.parse(localStorage.getItem("server.fleet") || "null");
    // if (!fleetData) {
    let fleetData;
    try {
      const res = await fetch("assets/fleet.json");
      console.log("fetch fleet.json");
      fleetData = await res.json();
      localStorage.setItem("server.fleet", JSON.stringify(fleetData));
    } catch (err) {
      console.error("Failed to fetch assets/fleet.json:", err);
      fleetData = { models: [], fleet: [] };
    }
    // }

    // Dynamic availability check based on active bookings
    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    const activePlates = new Set(
      bookings
        .filter((b) => b.status === "upcoming" || b.status === "ongoing" || b.status === "pending staff checks" || b.status === "pending payment")
        .map((b) => b.carPlate)
    );

    // Compute availability counts per model
    const modelsWithAvail = fleetData.models.map((model) => {
      const units = fleetData.fleet.filter((car) => car.modelId === model.modelId);
      const availableUnits = units.filter((car) => car.available && !activePlates.has(car.regNum));
      return {
        ...model,
        totalQty: units.length,
        availQty: availableUnits.length,
        isAvail: availableUnits.length > 0,
        availablePlates: availableUnits.map((u) => u.regNum),
      };
    });

    return {
      status: 200,
      data: {
        models: modelsWithAvail,
        fleet: fleetData.fleet,
      },
    };
  }

  /**
   * @param {string} startDateStr
   * @param {string} endDateStr 
   * @returns "upcoming" | "ongoing"
   */
  statusFromDateRange(startDateStr, endDateStr) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    let status = "upcoming";
    if (startDateStr <= todayStr && endDateStr >= todayStr) {
      status = "ongoing";
    }
    return status;
  }

  /**
   * Create a new booking
   * @param {Object} bookingData
   */
  async createBooking(bookingData) {
    await this.#mockDelay();
    const { userId, modelId, startDate, endDate, cardLast4 } = bookingData;

    if (!userId) {
      throw new Error("authentication needed to use endpoint");
    }

    const fleetRes = await this.getFleet();
    const model = fleetRes.data.models.find((m) => m.modelId === modelId);
    if (!model) {
      throw new Error("Car model not found");
    }

    if (!model.availablePlates || model.availablePlates.length === 0) {
      throw new Error("No vehicles currently available for this model");
    }

    // Randomly assign one of the available car plates of this model
    const randomIndex = Math.floor(Math.random() * model.availablePlates.length);
    const assignedPlate = model.availablePlates[randomIndex];

    // Calculate rental days and total
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.max(1, end.getTime() - start.getTime());
    const rentalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalAmount = rentalDays * model.dailyRateSGD;

    // Determine initial status based on dates
    const initialStatus = this.statusFromDateRange(startDate, endDate);

    const newBooking = {
      bookingId: "BK-" + Date.now().toString(36).toUpperCase(),
      userId: userId,
      modelId: model.modelId,
      modelName: model.name,
      modelType: model.type,
      gearTypeDesc: model.gearTypeDesc,
      dailyRateSGD: model.dailyRateSGD,
      imgPath: model.imgPath,
      carPlate: assignedPlate,
      startDate,
      endDate,
      rentalDays,
      totalAmount,
      cardLast4: cardLast4 || "4242",
      status: initialStatus, // upcoming, ongoing, pending staff checks, pending payment, completed
      createdAt: new Date().toISOString(),
      confirmReturnAt: null,
      excessDamageAmount: 0,
    };

    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    bookings.unshift(newBooking);
    localStorage.setItem("server.bookings", JSON.stringify(bookings));

    return { status: 201, data: newBooking };
  }

  /**
   * Get all bookings (with status auto-progression simulation)
   * @param {string|undefined} userId
   */
  async getBookings(userId) {
    await this.#mockDelay();
    if (!userId) {
      //return { status: 403 };
      throw new Error("authentication needed to use endpoint");
    }

    let bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");

    const now = Date.now();
    let updated = false;
    
    bookings = bookings.map((b) => {
      // Server simulation:
      // If status is 'pending staff checks' and >= 7 seconds elapsed since confirmReturnAt,
      // update status to 'pending payment'
      if (b.status === "pending staff checks" && b.confirmReturnAt) {
        const elapsedSeconds = (now - new Date(b.confirmReturnAt).getTime()) / 1000;
        if (elapsedSeconds >= 7) {
          b.status = "pending payment";
          updated = true;
        }
      }
      // update upcoming to ongoing if the date is here
      if (b.status === "upcoming") {
        b.status = this.statusFromDateRange(b.startDate, b.endDate);
        updated = true;
      }
      return b;
    });

    if (updated) {
      localStorage.setItem("server.bookings", JSON.stringify(bookings));
    }

      console.log("berr",userId)
    bookings = bookings.filter((b) => b.userId === userId);


    return { status: 200, data: bookings };
  }

  /**
   * Confirm return of vehicle (transitions from ongoing -> pending staff checks)
   * @param {string} bookingId
   */
  async confirmReturn(bookingId) {
    await this.#mockDelay();
    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    const booking = bookings.find((b) => b.bookingId === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    booking.status = "pending staff checks";
    booking.confirmReturnAt = new Date().toISOString();
    localStorage.setItem("server.bookings", JSON.stringify(bookings));

    return { status: 200, data: booking };
  }

  /**
   * Pay pending payment bill line items (transitions pending payment -> completed)
   * @param {string} bookingId
   */
  async payBooking(bookingId) {
    await this.#mockDelay();
    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    const booking = bookings.find((b) => b.bookingId === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    booking.status = "completed";
    booking.paidAt = new Date().toISOString();
    localStorage.setItem("server.bookings", JSON.stringify(bookings));

    return { status: 200, data: booking };
  }

  /**
   * Update an existing booking (dates, payment card)
   * @param {string} bookingId
   * @param {Object} updates
   */
  async updateBooking(bookingId, updates) {
    await this.#mockDelay();
    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    const booking = bookings.find((b) => b.bookingId === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      throw new Error(`Cannot modify booking in ${booking.status} status`);
    }

    if (updates.startDate && updates.endDate) {
      booking.startDate = updates.startDate;
      booking.endDate = updates.endDate;
      const start = new Date(updates.startDate);
      const end = new Date(updates.endDate);
      const diffTime = Math.max(1, end.getTime() - start.getTime());
      const rentalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      booking.rentalDays = rentalDays;
      booking.totalAmount = rentalDays * booking.dailyRateSGD;

      const now = new Date();
      // if (booking.status === "upcoming") {
      booking.status = this.statusFromDateRange(booking.startDate, booking.endDate);
      //}
    }

    if (updates.cardLast4) {
      booking.cardLast4 = updates.cardLast4;
    }

    booking.updatedAt = new Date().toISOString();
    localStorage.setItem("server.bookings", JSON.stringify(bookings));

    return { status: 200, data: booking };
  }

  /**
   * Cancel an existing booking
   * @param {string} bookingId
   */
  async cancelBooking(bookingId) {
    await this.#mockDelay();
    const bookings = JSON.parse(localStorage.getItem("server.bookings") || "[]");
    const booking = bookings.find((b) => b.bookingId === bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "completed") {
      throw new Error("Cannot cancel a completed booking");
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    localStorage.setItem("server.bookings", JSON.stringify(bookings));

    return { status: 200, data: booking };
  }

  /**
   *
   * @param {string} userId
   * @returns {Promise<{status:number, data: UserProfile}>}
   */
  async getUserProfile(userId) {
    await this.#mockDelay();

    const users = JSON.parse(localStorage.getItem("server.users") || "") || {};
    const profile = users[userId];

    if (!profile) {
      throw new Error("User not found");
    }

    return { status: 200, data: profile };
  }

  async getAllUsers() {
    await this.#mockDelay();
    return JSON.parse(localStorage.getItem("server.users") || "") || {};
  }

  /**
   *
   * @param {string} userId
   * @param {string} name
   * @param {string} email
   * @returns
   */
  async registerUser(userId, name, email) {
    await this.#mockDelay();
    const users = JSON.parse(localStorage.getItem("server.users") || "") || {};
    if (users[userId]) {
      throw new Error("User ID already exists");
    }
    const newUser = {
      id: userId,
      name: name || userId,
      email: email || `${userId}@example.com`,
    };
    users[userId] = newUser;
    localStorage.setItem("server.users", JSON.stringify(users));
    return { status: 201, data: newUser };
  }

  #initMockDb() {
    // Mock Server Database (using localStorage)
    if (!localStorage.getItem("server.users")) {
      const defaultUsers = {
        user_123: { id: "user_123", name: "Bob Jones", email: "bob@example.com" },
        user_456: { id: "user_456", name: "Alice Smith", email: "alice@example.com" },
      };
      localStorage.setItem("server.users", JSON.stringify(defaultUsers));
    }
  }

  /**
   * simulate network delay
   * @param {number} max
   */
  async #mockDelay(max = 100) {
    return await new Promise((resolve) => setTimeout(resolve, Math.random() * max));
  }
}

/**
 * @typedef {"light"|"dark"} ThemeTypes
 * @typedef {ThemeTypes|"auto"} ThemeModes
 */

class SiteApi {
  /**
   * @type {SiteApi}
   */
  static instance;

  /**
   * @type {ServerApi}
   */
  server;

  /**
   * @type {ThemeModes}
   */
  themeMode = "auto";

  constructor() {
    if (SiteApi.instance) {
      throw new Error("siteapi is singleton");
    }

    this.server = new ServerApi();

    SiteApi.instance = this;
  }

  // Global entry point to get the instance
  static getInstance() {
    if (!SiteApi.instance) {
      SiteApi.instance = new SiteApi();
    }
    return SiteApi.instance;
  }

  /**
   * @param {string} userId
   */
  #login(userId) {
    localStorage.setItem("site.session_user_id", userId);
    console.log(`logged in as ${userId}`);
    window.dispatchEvent(new CustomEvent("authChange", { detail: { userId } }));
  }

  /**
   * @param {string} userId
   */
  async authenticate(userId) {
    const response = await this.server.getUserProfile(userId);
    if (response && response.status === 200) {
      this.#login(userId);
      return response.data;
    }
    throw new Error("User not found");
  }

  logout() {
    console.log(`logout ${this.getCurrentUserId()}`);
    localStorage.removeItem("site.session_user_id");
    window.dispatchEvent(new CustomEvent("authChange", { detail: { userId: null } }));
  }

  getCurrentUserId() {
    return localStorage.getItem("site.session_user_id");
  }

  async getCurrentUserProfile() {
    const userId = this.getCurrentUserId();
    if (!userId) return null;

    try {
      const response = await this.server.getUserProfile(userId);
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get fleet details from server
   */
  async getFleet() {
    const res = await this.server.getFleet();
    return res.data;
  }

  /**
   * Get single model detail
   * @param {string} modelId
   */
  async getModelDetail(modelId) {
    const fleet = await this.getFleet();
    return fleet.models.find((m) => m.modelId === modelId) || null;
  }

  /**
   * Create a booking
   * @param {Object} bookingData
   */
  async createBooking(bookingData) {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.error("neeed login to use createbooking");
      return;
    }
    const res = await this.server.createBooking({ ...bookingData, userId });
    return res.data;
  }

  /**
   * Get all bookings (for current usert)
   */
  async getBookings() {
    const userId = this.getCurrentUserId();
    const res = await this.server.getBookings(userId);
    return res.data;
  }

  /**
   * Confirm return for an ongoing booking
   * @param {string} bookingId
   */
  async confirmReturn(bookingId) {
    const res = await this.server.confirmReturn(bookingId);
    return res.data;
  }

  /**
   * Pay pending payment for a booking
   * @param {string} bookingId
   */
  async payBooking(bookingId) {
    const res = await this.server.payBooking(bookingId);
    return res.data;
  }

  /**
   * Update booking details (dates, etc)
   * @param {string} bookingId
   * @param {Object} updates
   */
  async updateBooking(bookingId, updates) {
    const res = await this.server.updateBooking(bookingId, updates);
    return res.data;
  }

  /**
   * Cancel booking
   * @param {string} bookingId
   */
  async cancelBooking(bookingId) {
    const res = await this.server.cancelBooking(bookingId);
    return res.data;
  }

  /**
   * @param {ThemeModes} theme
   */
  setTheme(theme) {
    if (!theme) {
      localStorage.removeItem("site.theme");
    } else {
      localStorage.setItem("site.theme", theme);
    }
    this.restoreTheme();
  }

  get workingTheme() {
    /**
     * @type {ThemeTypes}
     */
    let theme = this.themeMode;

    if (!this.themeMode || this.themeMode === "auto")
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : this.themeMode;

    return theme;
  }

  /** toggle supported theme modes */
  toggleTheme() {
    // maps to next theme
    /**
     * @type {Record<ThemeModes, ThemeModes>}
     */
    const THEME_CYCLE = {
      light: "dark",
      dark: "auto",
      auto: "light",
    };

    const nextTheme = THEME_CYCLE[this.themeMode] ?? "auto";
    this.setTheme(nextTheme);
  }

  restoreTheme() {
    /**
     * @type {ThemeModes|null}
     */
    const themeMode = localStorage.getItem("site.theme");

    // first set js theme var
    this.themeMode = themeMode ?? "auto";

    // sync css theme var
    document.documentElement.setAttribute("data-theme", this.workingTheme);
    document.documentElement.setAttribute("data-theme-mode", this.themeMode);

    // set browser controls theme
    document.documentElement.style.colorScheme = this.workingTheme;

    console.log(`theme set : ${this.themeMode}`);
  }

  /**
   * Reusable toggle handler for dropdowns and overlays.
   * Binds to any element with clsas .js-toggle and target selector inside data-toggle="#targetSelector".
   * Binded elements are given is-binded and will
   */
  bindAllToggles() {
    document.querySelectorAll(".js-toggle").forEach((btn) => {
      if (btn.dataset.isBinded) return;
      btn.dataset.isBinded = "true";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const targetSelector = btn.getAttribute("data-toggle");
        if (!targetSelector) return;
        const target = document.querySelector(targetSelector);
        if (!target) return;

        const isOpen = target.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(isOpen));

        // Close other open menus/dropdowns
        if (isOpen) {
          document.querySelectorAll(".is-open").forEach((el) => {
            if (el !== target) {
              el.classList.remove("is-open");
              const otherBtn = document.querySelector(`[data-toggle="#${el.id}"]`);
              if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
            }
          });
        }
      });
    });
    // listen all document click to close open dropdowns/overlays when clicking outside
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".is-open").forEach((el) => {
        if (!el.contains(/** @type {Node} */ (e.target))) {
          el.classList.remove("is-open");
          const btn = document.querySelector(`[data-toggle="#${el.id}"]`);
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  domLoadedBinds() {
    // listen all document click to close open dropdowns/overlays when clicking outside
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".is-open").forEach((el) => {
        if (!el.contains(/** @type {Node} */ (e.target))) {
          el.classList.remove("is-open");
          const btn = document.querySelector(`[data-toggle="#${el.id}"]`);
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });
  }
}

// export site api for use
window.siteApi = new SiteApi();
