
// Mock API simulating server responses and processing
class ServerApi {
  constructor() {
    this.#initMockDb();
  }

  /**
   * 
   * @param {string} userId 
   * @returns {Promise<{status:number, data: UserProfile}>}
   */
  async getUserProfile(userId) {
    await this.#mockDelay();

    const users = JSON.parse(localStorage.getItem('server.users') || "") || {};
    const profile = users[userId];

    if (!profile) {
      throw new Error("User not found");
    }

    return { status: 200, data: profile };
  }

  async getAllUsers() {
    await this.#mockDelay();
    return JSON.parse(localStorage.getItem('server.users') || "") || {};
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
    const users = JSON.parse(localStorage.getItem('server.users') || "") || {};
    if (users[userId]) {
      throw new Error("User ID already exists");
    }
    const newUser = {
      id: userId,
      name: name || userId,
      email: email || `${userId}@example.com`
    };
    users[userId] = newUser;
    localStorage.setItem('server.users', JSON.stringify(users));
    return { status: 201, data: newUser };
  }

  #initMockDb() {
    // Mock Server Database (using localStorage)
    if (!localStorage.getItem('server.users')) {
      const defaultUsers = {
        "user_123": { id: "user_123", name: "Bob Jones", email: "bob@example.com" },
        "user_456": { id: "user_456", name: "Alice Smith", email: "alice@example.com" }
      };
      localStorage.setItem('server.users', JSON.stringify(defaultUsers));
    }
  }

  /**
   * simulate network delay 
   * @param {number} max 
   */
  async #mockDelay(max = 100) {
    return await new Promise(resolve => setTimeout(resolve, Math.random() * max));
  }
}


class SiteApi {
  /**
   * @type {SiteApi}
   */
  static instance;

  /**
   * @type {ServerApi}
   */
  server;

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
    localStorage.setItem('site.session_user_id', userId);
    console.log(`logged in as ${userId}`);
    window.dispatchEvent(new CustomEvent('authChange', { detail: { userId } }));
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
    localStorage.removeItem('site.session_user_id');
    window.dispatchEvent(new CustomEvent('authChange', { detail: { userId: null } }));
  }

  getCurrentUserId() {
    return localStorage.getItem('site.session_user_id');
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
}

// export site api for use
window.siteApi = new SiteApi();
