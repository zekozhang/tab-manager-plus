(function () {
  var url = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL("index.html#/sidebar")
    : "index.html#/sidebar";
  window.location.replace(url);
})();
