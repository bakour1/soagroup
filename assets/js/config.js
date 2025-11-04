// assets/js/config.js
(function () {
  const isLocalHost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === ""; /* file:// */

  window.SOA_CONFIG = {
    SHARED_PASSWORD: "soaaa2025",
    MEMBER_USERNAME: "soagroup",
    ADMIN_USERNAME: "bakour512",
    BRAND_AR: "مجموعة سوا — SOA Group",
    BRAND_EN: "SOA Group",
    LOGO_URL: "imgs/logo-4.png",

    // GitHub Pages تحت /soagroup/ — محليًا خليه للجذر /
    // BASE_PATH: isLocalHost ? "/" : "/",
    BASE_PATH: isLocalHost ? "/" : "/soagroup/",

    PAGES: {
      home: "data/home.json",
      goals: "data/goals.json",
      strategy: "data/strategy.json",
      constitution: "data/constitution.json",

      // الافتراضي (إنشاء مشروع جديد)
      new_model: "data/projects/new/model.json",
      new_feasibility: "data/projects/new/feasibility.json",

      // SOA Phone
      soa_phone_model: "data/projects/soa_phone/model.json",
      soa_phone_feasibility: "data/projects/soa_phone/feasibility.json",

      // projects gallery
      gallery: "/data/projects/gallery/projects.json",
    },

    // توحيد بناء الرابط من أي عمق + إزالة التكرارات //
    resolve(key) {
      return (this.BASE_PATH + this.PAGES[key]).replace(/\/+/g, "/");
    },
  };
})();
