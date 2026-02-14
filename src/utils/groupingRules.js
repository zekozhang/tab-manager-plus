/**
 * Helpers for grouping rules: pattern generation when adding a tab to a group,
 * and finding which custom rule/pattern matched a URL (so we can remove it when moving).
 * Also used to compute group title for a URL (for workspace/display grouping).
 */

import { getDomain, getSecDomain } from "./domain";

function isExpressionMatched(url, expression) {
  if (!url || !expression) return false;
  try {
    const regexPattern = expression.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  } catch {
    return false;
  }
}

/** Get the rule pattern when adding a tab to a group. addToGroupRuleMode: "url" | "domain" | "sld".
 *  "domain" and "sld" both use full hostname (e.g. *zcp-eng.corp.zoom.us*) so the rule matches that domain. */
export function getPatternForTabByAddMode(tab, addToGroupRuleMode) {
  if (!tab?.url) return null;
  try {
    const url = tab.url;
    const mode = addToGroupRuleMode || "url";
    if (mode === "url") return url;
    const hostname = new URL(url).hostname;
    if (mode === "domain" || mode === "sld") return `*${hostname}*`;
    return url;
  } catch {
    return null;
  }
}

/** Return { ruleIndex, patternIndex } for the first rule whose pattern matches url, or null. */
export function getMatchingRuleAndPatternIndex(url, configuration) {
  const rules = configuration?.rules || [];
  for (let ri = 0; ri < rules.length; ri++) {
    const rule = rules[ri];
    const patterns = rule.patterns || [];
    for (let pi = 0; pi < patterns.length; pi++) {
      const p = patterns[pi];
      const pattern = typeof p === "string" ? p : p?.pattern;
      if (pattern && isExpressionMatched(url, pattern)) return { ruleIndex: ri, patternIndex: pi };
    }
  }
  return null;
}

/** Get group key (rule name) for URL from custom rules, or null if no match. */
export function getGroupKeyByConfig(url, configuration) {
  const rules = configuration?.rules || [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    for (const obj of rule.patterns || []) {
      const pattern = typeof obj === "string" ? obj : obj?.pattern;
      if (pattern && isExpressionMatched(url, pattern)) return rule.name;
    }
  }
  return null;
}

/** Get group title for a URL given strategy and config (for display grouping). */
export function getGroupTitleForUrl(url, groupStrategy, configuration) {
  if (!url || !url.startsWith("http")) return null;
  if (groupStrategy === 1) return getDomain(url);
  if (groupStrategy === 2) return getSecDomain(url);
  if (groupStrategy === 3) {
    const custom = getGroupKeyByConfig(url, configuration);
    if (custom) return custom;
    const fallback = configuration?.fallback || "none";
    if (fallback === "domain") return getDomain(url);
    if (fallback === "sld") return getSecDomain(url);
    return null;
  }
  return null;
}

/** Group tabs into [{ id, title, tabs }] by current strategy and config. */
export function groupTabsForDisplay(tabs, groupStrategy, configuration, sortByName = false) {
  const map = new Map();
  const ungroupedKey = "\0ungrouped";
  for (const tab of tabs || []) {
    const title = getGroupTitleForUrl(tab.url, groupStrategy, configuration);
    const key = title == null || title === "" ? ungroupedKey : title;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  }
  const groups = [];
  map.forEach((tabsInGroup, key) => {
    groups.push({
      id: key,
      title: key === ungroupedKey ? null : key,
      tabs: tabsInGroup,
    });
  });
  const ungrouped = groups.find((g) => g.id === ungroupedKey);
  const rest = groups.filter((g) => g.id !== ungroupedKey);
  if (sortByName) {
    rest.sort((a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }));
  }
  const result = [...rest];
  if (ungrouped) result.push(ungrouped);
  return result;
}
