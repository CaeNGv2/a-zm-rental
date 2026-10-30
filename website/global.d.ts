
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

declare interface Window {
  siteApi: SiteApi;
  State: typeof State;
  /**
   * Vue style component loaded hook
   * @param {Function} fn called after component is loaded
   */
  onMounted: (fn: Function) => void;
}
