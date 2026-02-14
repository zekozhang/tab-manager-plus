import { defaultConfiguration } from "./configuration.js";
import { configStrategy, domainStrategy, secDomainStrategy } from "./strategy.js";

// Default config
const DEFAULT_CONFIG = {
  enableAutoGroup: true, // Whether to enable auto grouping
  groupTabNum: 1, // Min number of tabs to form a group
  groupStrategy: 2, // Grouping strategy
  configuration: defaultConfiguration // Configuration content
};
// Global user config
let userConfig = DEFAULT_CONFIG;

// Grouping strategy map
const GROUP_STRATEGY_MAP = new Map();
GROUP_STRATEGY_MAP.set(1, domainStrategy);
GROUP_STRATEGY_MAP.set(2, secDomainStrategy);
GROUP_STRATEGY_MAP.set(3, configStrategy);

// Check if window supports grouping (only normal type does)
async function isWindowGroupable(windowId) {
  try {
    const window = await chrome.windows.get(windowId);
    return window && window.type === 'normal';
  } catch (e) {
    return false;
  }
}

// Listen to tab update events
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if window supports grouping
  const isGroupable = await isWindowGroupable(tab.windowId);
  if (!isGroupable) {
    return; // Skip non-groupable windows (e.g. popup)
  }

  chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG), (config) => {
    userConfig = { ...DEFAULT_CONFIG, ...config };
    // Check if auto grouping is enabled
    if (!userConfig.enableAutoGroup) {
      return;
    }

    // Ungroup if not http(s)
    if (!(tab.url.startsWith("http") || tab.url.startsWith("https"))) {
      // ungroup may throw if user manually moved tab into a group
      try {
        chrome.tabs.ungroup([tabId]);
      } catch (e) {
        console.error(e);
      }
    }

    const strategy = GROUP_STRATEGY_MAP.get(userConfig.groupStrategy);
    // If grouping conditions are met, group
    if (strategy.shloudGroup(changeInfo, tab)) {
      groupTabs(tab, strategy);
    }

    // If a tab was removed from a group, check if group still meets min size; ungroup if not
    if (changeInfo.groupId && changeInfo.groupId === -1) {
      strategy.querySameTabs(tab, userConfig).then((tabs) => {
        const tabIds = tabs.map((t) => t.id);
        // Ungroup if tab count is below min
        if (tabs.length > 0 && tabs.length < userConfig.groupTabNum) {
          try {
            chrome.tabs.ungroup(tabIds);
          } catch (e) {
            console.error('Error ungrouping tabs:', e);
          }
        }
      });
    }
  });
});

async function groupTabs(tab, strategy) {
  // Check again that window supports grouping
  const isGroupable = await isWindowGroupable(tab.windowId);
  if (!isGroupable) {
    return;
  }

  strategy.querySameTabs(tab, userConfig).then(async (tabs) => {
    if (tabs.length === 0) {
      console.log("no same tab for:" + tab);
      return;
    }

    const tabIds = tabs.map((t) => t.id);
    // Ungroup if tab count is below min
    if (tabIds.length < userConfig.groupTabNum) {
      try {
        chrome.tabs.ungroup(tabIds);
      } catch (e) {
        console.error('Error ungrouping tabs:', e);
      }
      return;
    }
    // Query existing group; join if found, otherwise create new group
    const groupTitle = strategy.getGroupTitle(tab, userConfig);
    if (groupTitle) {
      try {
        const tabGroups = await chrome.tabGroups.query({
          title: groupTitle,
          windowId: tab.windowId,
        });
        
        if (tabGroups && tabGroups.length > 0) {
          chrome.tabs.group({ tabIds, groupId: tabGroups[0].id }).catch((e) => {
            console.error('Error grouping tabs:', e);
          });
        } else {
          chrome.tabs.group({ tabIds }).then((groupId) => {
            chrome.tabGroups.update(groupId, { title: groupTitle });
          }).catch((e) => {
            console.error('Error creating tab group:', e);
          });
        }
      } catch (e) {
        console.error('Error querying tab groups:', e);
      }
    }
  });
}

// Chrome opens Side Panel on extension icon click (no need to call open in code, avoids user gesture limit)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => {
  console.error("Error setting side panel behavior:", e);
});

// Listen for group-all and sidebar messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.groupRightNow) {
    groupAllTabs();
  } else if (request.openSidebar) {
    openSidebar(request.windowId);
  } else if (request.closeSidebar) {
    // Side Panel is closed by user; no need to close in code
  } else if (request.toggleSidebarPin) {
    toggleSidebarPin(request.pinned);
  }
  return true;
});

// Listen for group-all shortcut
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "group_right_now": {
      groupAllTabs();
    }
  }
});

async function groupAllTabs() {
  chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG), async (config) => {
    userConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Get last focused window (target when triggered from icon or sidebar)
    try {
      const currentWindow = await chrome.windows.getLastFocused();
      if (!currentWindow || currentWindow.type !== 'normal') {
        return; // Only group in normal windows
      }

      chrome.tabs
        .query({ windowId: currentWindow.id, pinned: false })
        .then((tabs) => {
          const strategy = GROUP_STRATEGY_MAP.get(userConfig.groupStrategy);
          // Group by groupTitle: key = groupTitle, value = tabs
          let tabGroups = {};
          tabs.forEach((tab) => {
            const groupTitle = strategy.getGroupTitle(tab, userConfig);
            if (groupTitle) {
              if (!tabGroups[groupTitle]) {
                tabGroups[groupTitle] = [];
              }
              tabGroups[groupTitle].push(tab);
            }
          });
          // Call Chrome API to group tabs
          for (const groupTitle in tabGroups) {
            const tabIds = tabGroups[groupTitle].map((tab) => tab.id);
            if (tabGroups[groupTitle].length >= userConfig.groupTabNum) {
              chrome.tabs.group({ tabIds }).then((groupId) => {
                chrome.tabGroups.update(groupId, { title: groupTitle });
              }).catch((e) => {
                console.error('Error grouping tabs:', e);
              });
            } else {
              try {
                chrome.tabs.ungroup(tabIds);
              } catch (e) {
                console.error('Error ungrouping tabs:', e);
              }
            }
          }
        });
    } catch (e) {
      console.error('Error getting current window:', e);
    }
  });
}

// Open sidebar (uses built-in Side Panel; switching tab does not affect it)
async function openSidebar(windowId) {
  try {
    const targetWindowId = windowId != null
      ? windowId
      : (await chrome.windows.getLastFocused()).id;
    await chrome.sidePanel.open({ windowId: targetWindowId });
  } catch (e) {
    console.error('Error opening side panel:', e);
  }
}

// Toggle sidebar pin state (managed by SidebarPage)
async function toggleSidebarPin(pinned) {
  // Pin state is stored locally by the sidebar page
}

// function mergeSameTabs() {
//   chrome.tabs
//     .query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
//     .then((tabs) => {
//       let tabGroups = {};
//       tabs.forEach((tab) => {
//         let key = tab.url;
//         if (key) {
//           key = key.split("#")[0];
//           if (!tabGroups[key]) {
//             tabGroups[key] = [tab];
//           } else {
//             chrome.tabs.remove(tab.id);
//           }
//         }
//       });
//     });
// }
