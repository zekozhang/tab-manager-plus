import { getGroupKeyByConfig, getGroupTitleByConfig } from "./configuration.js";
import { getDomain, getSecDomain } from "./utils.js";

// Strategy: no grouping
export const noGroupStrategy = {
  shloudGroup: () => {
    return false;
  },
  getGroupKey: () => {
    return null;
  },
  getGroupTitle: () => {
    return null;
  },
  querySameTabs: async () => {
    return [];
  },
};

// Strategy: group by domain
export const domainStrategy = {
  shloudGroup: (changeInfo, tab) => {
    return changeInfo.url && tab.url.match(/^https?:\/\/[^/]+\/.*/);
  },
  getGroupKey: (tab) => {
    return getDomain(tab.url);
  },
  getGroupTitle: (tab) => {
    return getDomain(tab.url);
  },
  querySameTabs: async (tab) => {
    const domain = getDomain(tab.url);
    let tabs;
    await chrome.tabs
      .query({
        windowId: tab.windowId,
        pinned: false,
      })
      .then((allTabs) => {
        tabs = allTabs.filter((t) => t.url && domain === getDomain(t.url));
      });
    return tabs;
  },
};

// Strategy: group by second-level domain
export const secDomainStrategy = {
  shloudGroup: (changeInfo, tab) => {
    return changeInfo.url && tab.url.match(/^https?:\/\/[^/]+\/.*/);
  },
  getGroupKey: (tab) => {
    return getSecDomain(tab.url);
  },
  getGroupTitle: (tab) => {
    return getSecDomain(tab.url);
  },
  querySameTabs: async (tab) => {
    const domain = getSecDomain(tab.url);
    let tabs;
    await chrome.tabs
      .query({
        windowId: tab.windowId,
        pinned: false,
      })
      .then((allTabs) => {
        tabs = allTabs.filter((t) => t.url && domain === getSecDomain(t.url));
      });
    return tabs;
  },
};

// Strategy: group by configuration rules
// Only group when status is 'complete' so we use the final URL and avoid grouping
// on intermediate/redirect URLs. Do not require changeInfo.url in the same event:
// Chrome often fires url+loading first, then status=complete without url.
export const configStrategy = {
  shloudGroup: (changeInfo, tab) => {
    if (!tab.url || !tab.url.match(/^https?:\/\/[^/]+/)) return false;
    return changeInfo.status === "complete";
  },
  getGroupKey: (tab, userConfig) => {
    const result = getGroupKeyByConfig(tab.url, userConfig.configuration);
    return result
      ? result
      : getFallbackStattegy(userConfig.configuration.fallback).getGroupKey(tab);
  },
  getGroupTitle: (tab, userConfig) => {
    const result = getGroupTitleByConfig(tab.url, userConfig.configuration);
    return result
      ? result
      : getFallbackStattegy(userConfig.configuration.fallback).getGroupTitle(
          tab
        );
  },
  querySameTabs: async (tab, userConfig) => {
    const domain = configStrategy.getGroupTitle(tab, userConfig);
    let tabs;
    await chrome.tabs
      .query({
        windowId: tab.windowId,
        pinned: false,
      })
      .then((allTabs) => {
        tabs = allTabs.filter(
          (t) =>
            t.url &&
            domain === configStrategy.getGroupTitle(t, userConfig)
        );
      });
    return tabs;
  },
};

function getFallbackStattegy(fallback) {
  switch (fallback) {
    case 'none':
      return noGroupStrategy;
    case 'domain':
      return domainStrategy;
    case 'sld':
      return secDomainStrategy;
    default:
      return noGroupStrategy;
  }
}
