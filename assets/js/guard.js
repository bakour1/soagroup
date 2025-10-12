// assets\js\guard.js
(function () {
  const s = window.SOA_AUTH.readSession && window.SOA_AUTH.readSession();
  if (!s) {
    location.replace("login.html");
    return;
  }
  document.documentElement.setAttribute("data-role", s.role || "member");
})();
