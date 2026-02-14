/**
 * Domain helpers for grouping (mirrors background/utils.js).
 */

export function getDomain(url) {
  if (!url || !url.startsWith("http")) return null;
  const re = /^(?:[a-zA-Z-]+):\/\/([^/:]+)(:\d+)?(\/|$)/;
  const match = url.match(re);
  return match ? match[1] : null;
}

/** Returns the second-level label (e.g. "google" from "mail.google.com") for grouping. */
export function getSecDomain(url) {
  const domain = getDomain(url);
  if (!domain) return null;
  if (domain === "localhost" || domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return domain;
  }
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  const tld = parts[parts.length - 1];
  const commonTlds = ["com", "net", "org", "edu", "gov", "io", "co", "uk", "de", "fr", "cn", "jp", "au", "me", "app"];
  if (commonTlds.includes(tld.toLowerCase()) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[parts.length - 2] || domain;
}

/** Returns the root/registrable domain (e.g. "atlassian.net" from "zoomvideo.atlassian.net", "google.com" from "mail.google.com"). */
export function getRootDomain(url) {
  const hostname = getDomain(url);
  if (!hostname) return null;
  if (hostname === "localhost" || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return hostname;
  }
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const multiPartTlds = ["co.uk", "com.au", "co.jp", "com.cn", "co.nz", "co.za", "com.br", "co.in"];
  const twoPartTld = parts.length >= 3 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}`.toLowerCase() : "";
  if (multiPartTlds.includes(twoPartTld)) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}
