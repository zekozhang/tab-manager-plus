/**
 * Workspace utils: matchMode 'url' = full URL match (supports *); 'domain' = root domain (e.g. atlassian.net); 'sld' = full hostname.
 */

import { getRootDomain } from "./domain";

export const WORKSPACE_STORAGE_KEY = "workspaces";

export function createWorkspaceId() {
  return "ws_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

export function getDefaultWorkspaces() {
  return [];
}

/** Check if a URL matches a pattern. matchMode: 'url' = full URL (wildcard); 'domain' = root domain (e.g. atlassian.net); 'sld' = full hostname. */
function urlMatchesPattern(url, pattern, matchMode) {
  if (!url || !pattern) return false;
  try {
    const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const re = new RegExp(`^${regexPattern}$`);
    if (matchMode === "domain") {
      const rootDomain = getRootDomain(url);
      return rootDomain ? re.test(rootDomain) : false;
    }
    if (matchMode === "sld") {
      const hostname = new URL(url).hostname;
      return re.test(hostname);
    }
    return re.test(url);
  } catch {
    return false;
  }
}

/** Check if a tab (with .url) belongs to a workspace (rules + manualUrls). */
export function tabBelongsToWorkspace(tab, workspace) {
  if (!tab?.url || !workspace) return false;
  const url = tab.url;
  if (!url.startsWith("http") && !url.startsWith("https")) return false;
  const manualUrls = workspace.manualUrls || [];
  if (manualUrls.includes(url)) return true;
  const rules = workspace.rules || [];
  const matchMode = workspace.matchMode || "url";
  for (const r of rules) {
    const pattern = typeof r === "string" ? r : r.pattern;
    if (pattern && urlMatchesPattern(url, pattern, matchMode)) return true;
  }
  return false;
}

/** Return workspace ids that have at least one open tab in the given tabs array. */
export function getWorkspacesWithOpenTabs(tabs, workspaces) {
  if (!workspaces?.length || !tabs?.length) return [];
  const ids = [];
  for (const ws of workspaces) {
    const hasTab = tabs.some((tab) => tabBelongsToWorkspace(tab, ws));
    if (hasTab) ids.push(ws.id);
  }
  return ids;
}

/** Filter tabs to those belonging to the given workspace. */
export function filterTabsByWorkspace(tabs, workspace) {
  if (!workspace) return tabs;
  return tabs.filter((tab) => tabBelongsToWorkspace(tab, workspace));
}

/** Get the rule pattern when adding a tab to a workspace. matchMode 'url' = full URL; 'domain' = root domain (e.g. atlassian.net); 'sld' = *hostname*. */
export function getPatternForTab(workspace, tab) {
  if (!tab?.url || !workspace) return null;
  try {
    const mode = workspace.matchMode || "url";
    const hostname = new URL(tab.url).hostname;
    if (mode === "sld") return `*${hostname}*`;
    if (mode === "domain") return getRootDomain(tab.url) || hostname;
    return tab.url;
  } catch {
    return null;
  }
}

function getPatternFromRule(r) {
  return typeof r === "string" ? r : r?.pattern;
}

/** Add a tab to workspace as a rule (pattern) according to workspace matchMode. Returns updated workspace. */
export function addTabAsRuleToWorkspace(workspace, tab) {
  const pattern = getPatternForTab(workspace, tab);
  if (!pattern) return workspace;
  const rules = [...(workspace.rules || [])];
  const exists = rules.some((r) => getPatternFromRule(r) === pattern);
  if (exists) return workspace;
  rules.push({ pattern });
  return { ...workspace, rules };
}

/** Remove a tab from workspace by removing the rule that would have been added for it (and from manualUrls for backward compat). */
export function removeTabFromWorkspaceByRule(workspace, tab) {
  const pattern = getPatternForTab(workspace, tab);
  const rules = (workspace.rules || []).filter((r) => getPatternFromRule(r) !== pattern);
  const manualUrls = (workspace.manualUrls || []).filter((u) => u !== tab.url);
  return { ...workspace, rules, manualUrls };
}
