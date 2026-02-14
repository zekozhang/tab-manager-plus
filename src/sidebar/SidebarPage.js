import React from "react";
import { Button, Empty, Spin, Tooltip, Dropdown, Modal, Input, message } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  DragOutlined,
  FolderOutlined,
  FolderAddOutlined,
  GlobalOutlined,
  DownOutlined,
  RightOutlined,
  SettingOutlined,
  SyncOutlined,
  HomeOutlined,
  LaptopOutlined,
  PlusCircleOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import {
  WORKSPACE_STORAGE_KEY,
  createWorkspaceId,
  getWorkspacesWithOpenTabs,
  filterTabsByWorkspace,
  addTabAsRuleToWorkspace,
  removeTabFromWorkspaceByRule,
} from "../utils/workspace";
import {
  getPatternForTabByAddMode,
  getMatchingRuleAndPatternIndex,
  groupTabsForDisplay,
} from "../utils/groupingRules";
import "./SidebarPage.css";
import { injectIntl } from "react-intl";
import PropTypes from "prop-types";

class SidebarPage extends React.Component {
  static propTypes = {
    intl: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.i18n = (key) => props.intl.formatMessage({ id: key });
    this.state = {
      groups: [],
      ungroupedTabs: [],
      allTabs: [],
      workspaces: [],
      configuration: { fallback: "none", rules: [], addToGroupRuleMode: "url" },
      groupStrategy: 2,
      viewMode: "groups",
      activeWorkspaceId: null,
      loading: true,
      isPinned: false,
      sidebarWidth: 350,
      isResizing: false,
      collapsedGroups: new Set(),
      ungroupedCollapsed: false,
      openWorkspaceDropdownTabId: null,
      openGroupDropdownTabId: null,
      createWorkspaceModalTab: null,
      createWorkspaceName: "",
      createGroupModalTab: null,
      createGroupName: "",
      hasWorkspaceOverflow: false,
      workspaceMoreOpen: false,
      sortGroupsByName: false,
    };
    this.sidebarRef = React.createRef();
    this.workspacesScrollRef = React.createRef();
    this.resizeHandleRef = React.createRef();
    this.createWorkspaceInputRef = React.createRef();
    this.createGroupInputRef = React.createRef();
  }

  checkWorkspaceOverflow = () => {
    const el = this.workspacesScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    if (hasOverflow !== this.state.hasWorkspaceOverflow) {
      this.setState({ hasWorkspaceOverflow: hasOverflow });
    }
  };

  attachWorkspacesResizeObserver = () => {
    const scrollEl = this.workspacesScrollRef.current;
    if (!scrollEl || this.workspacesResizeObserver) return;
    this.workspacesResizeObserver = new ResizeObserver(() => {
      this.checkWorkspaceOverflow();
    });
    this.workspacesResizeObserver.observe(scrollEl);
    setTimeout(this.checkWorkspaceOverflow, 0);
  };

  componentDidMount() {
    document.body.classList.add("sidebar-view");
    this.loadGroupsAndTabs();
    this.setupResizeHandler();
    this.setupStorageListener();
    this.attachWorkspacesResizeObserver();
    chrome.storage.sync.get(["configuration", "groupStrategy"], (data) => {
      if (data.configuration) this.setState({ configuration: data.configuration });
      if (data.groupStrategy !== undefined) this.setState({ groupStrategy: data.groupStrategy });
    });
    // Restore sidebar width and pinned state from storage
    chrome.storage.local.get(['sidebarWidth', 'sidebarPinned'], (result) => {
      if (result.sidebarWidth) {
        this.setState({ sidebarWidth: result.sidebarWidth });
      }
      if (result.sidebarPinned !== undefined) {
        this.setState({ isPinned: result.sidebarPinned });
      }
    });

    // Refresh data periodically
    this.refreshInterval = setInterval(() => {
      this.loadGroupsAndTabs();
    }, 2000);
  }

  componentDidUpdate(prevState) {
    this.attachWorkspacesResizeObserver();
    if (
      this.workspacesScrollRef.current &&
      (prevState.workspaces !== this.state.workspaces ||
        prevState.allTabs !== this.state.allTabs ||
        prevState.loading !== this.state.loading)
    ) {
      setTimeout(this.checkWorkspaceOverflow, 0);
    }
  }

  componentWillUnmount() {
    document.body.classList.remove("sidebar-view");
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.removeResizeHandler();
    if (this.workspacesResizeObserver && this.workspacesScrollRef.current) {
      this.workspacesResizeObserver.disconnect();
    }
  }

  setupStorageListener = () => {
    chrome.tabs.onUpdated.addListener(() => this.loadGroupsAndTabs());
    chrome.tabs.onRemoved.addListener(() => this.loadGroupsAndTabs());
    chrome.tabs.onCreated.addListener(() => this.loadGroupsAndTabs());
    chrome.tabGroups.onUpdated.addListener(() => this.loadGroupsAndTabs());
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes[WORKSPACE_STORAGE_KEY]) {
        this.setState({ workspaces: changes[WORKSPACE_STORAGE_KEY].newValue || [] });
      }
      if (changes.configuration) {
        const c = changes.configuration.newValue;
        this.setState({ configuration: c || { fallback: "none", rules: [], addToGroupRuleMode: "url" } });
      }
      if (changes.groupStrategy) {
        this.setState({ groupStrategy: changes.groupStrategy.newValue });
      }
      if (changes.sortGroupsByName !== undefined) {
        this.setState({ sortGroupsByName: !!changes.sortGroupsByName.newValue });
      }
    });
  };

  loadGroupsAndTabs = async () => {
    try {
      // Get all windows and find the main browser window (not popup type)
      const windows = await chrome.windows.getAll();
      const mainWindow = windows.find(w => w.type === 'normal') || windows[0];
      const windowId = mainWindow?.id || chrome.windows.WINDOW_ID_CURRENT;
      
      const [tabs, groups] = await Promise.all([
        chrome.tabs.query({ windowId }),
        chrome.tabGroups.query({ windowId }),
      ]);

      // Get tab details for each group
      // Note: use tabs.query({ groupId }) to get tabs in a group
      const groupsWithTabs = await Promise.all(
        groups.map(async (group) => {
          const groupTabs = await chrome.tabs.query({ groupId: group.id });
          return {
            ...group,
            tabs: groupTabs || [],
          };
        })
      );

      // Collect all grouped tab IDs
      const groupedTabIds = new Set();
      groupsWithTabs.forEach((group) => {
        group.tabs?.forEach((tab) => {
          groupedTabIds.add(tab.id);
        });
      });

      // Filter to ungrouped tabs
      const ungroupedTabs = tabs.filter(
        (tab) => 
          !groupedTabIds.has(tab.id) && 
          tab.url?.startsWith("http") &&
          tab.groupId === -1 // Ensure tab is actually ungrouped
      );

      const httpTabs = tabs.filter((t) => t.url?.startsWith("http"));
        chrome.storage.sync.get(["sortGroupsByName", WORKSPACE_STORAGE_KEY], (data) => {
          const sortByName = !!data.sortGroupsByName;
          const ordered = sortByName
            ? [...groupsWithTabs].sort((a, b) =>
                (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
              )
            : groupsWithTabs;
          const workspaces = data[WORKSPACE_STORAGE_KEY] || [];
          this.setState({
            groups: ordered,
            ungroupedTabs,
            allTabs: httpTabs,
            workspaces,
            loading: false,
            sortGroupsByName: !!data.sortGroupsByName,
          });
        });
    } catch (error) {
      console.error("Error loading groups and tabs:", error);
      this.setState({ loading: false });
    }
  };

  setupResizeHandler = () => {
    this.handleMouseDown = async (e) => {
      e.preventDefault();
      this.setState({ isResizing: true });
      
      const startX = e.clientX;
      const startWidth = this.state.sidebarWidth;
      
      this.handleMouseMove = async (e) => {
        const deltaX = startX - e.clientX; // Positive when dragging right
        const newWidth = startWidth + deltaX;
        const minWidth = 180;  // Smaller may make content hard to use; Side Panel min width is enforced by Chrome
        const maxWidth = 800;
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        this.setState({ sidebarWidth: clampedWidth });
        chrome.storage.local.set({ sidebarWidth: clampedWidth });
        
        // Resize the panel
        try {
          const currentWindow = await chrome.windows.getCurrent();
          if (currentWindow && currentWindow.type === 'popup') {
            await chrome.windows.update(currentWindow.id, {
              width: clampedWidth,
              left: currentWindow.left + (currentWindow.width - clampedWidth)
            });
          }
        } catch (error) {
          console.error('Error resizing window:', error);
        }
      };

      this.handleMouseUp = () => {
        this.setState({ isResizing: false });
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
      };

      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("mouseup", this.handleMouseUp);
    };

    if (this.resizeHandleRef.current) {
      this.resizeHandleRef.current.addEventListener(
        "mousedown",
        this.handleMouseDown
      );
    }
  };

  removeResizeHandler = () => {
    if (this.resizeHandleRef.current) {
      this.resizeHandleRef.current.removeEventListener(
        "mousedown",
        this.handleMouseDown
      );
    }
    if (this.handleMouseMove) {
      document.removeEventListener("mousemove", this.handleMouseMove);
    }
    if (this.handleMouseUp) {
      document.removeEventListener("mouseup", this.handleMouseUp);
    }
  };

  handleTabClick = (tabId) => {
    chrome.tabs.update(tabId, { active: true });
    chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { focused: true });
  };

  handleCloseTab = async (e, tabId) => {
    e.stopPropagation();
    await chrome.tabs.remove(tabId);
    this.loadGroupsAndTabs();
  };

  handleCloseGroup = async (e, group) => {
    e.stopPropagation();
    const tabIds = (group.tabs || []).map((t) => t.id).filter(Boolean);
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds);
      this.loadGroupsAndTabs();
    }
  };

  handleGroupAllTabs = () => {
    chrome.runtime.sendMessage({ groupRightNow: true });
  };

  handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  switchToGroupsView = () => {
    this.setState({ viewMode: "groups", activeWorkspaceId: null });
  };

  switchToWorkspaceView = (workspaceId) => {
    this.setState({ viewMode: "workspace", activeWorkspaceId: workspaceId });
  };

  addTabToWorkspace = (tab, workspaceId) => {
    const workspace = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace || !tab?.url) return;
    const updated = addTabAsRuleToWorkspace(workspace, tab);
    const next = this.state.workspaces.map((w) => (w.id === workspaceId ? updated : w));
    this.setState({ workspaces: next });
    chrome.storage.sync.set({ [WORKSPACE_STORAGE_KEY]: next });
  };

  removeTabFromWorkspace = (tab, workspaceId) => {
    const workspace = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace || !tab?.url) return;
    const updated = removeTabFromWorkspaceByRule(workspace, tab);
    const next = this.state.workspaces.map((w) => (w.id === workspaceId ? updated : w));
    this.setState({ workspaces: next });
    chrome.storage.sync.set({ [WORKSPACE_STORAGE_KEY]: next });
  };

  openCreateWorkspaceModal = (tab) => {
    this.setState({ createWorkspaceModalTab: tab, createWorkspaceName: "", openWorkspaceDropdownTabId: null });
  };

  confirmCreateWorkspace = () => {
    const { createWorkspaceModalTab, createWorkspaceName, workspaces } = this.state;
    const name = (createWorkspaceName || "").trim();
    if (!name || !createWorkspaceModalTab?.url) {
      return;
    }
    const ws = {
      id: createWorkspaceId(),
      name,
      matchMode: "sld",
      rules: [],
      manualUrls: [],
    };
    const updated = addTabAsRuleToWorkspace(ws, createWorkspaceModalTab);
    const next = [...workspaces, updated];
    this.setState({ workspaces: next, createWorkspaceModalTab: null, createWorkspaceName: "" });
    chrome.storage.sync.set({ [WORKSPACE_STORAGE_KEY]: next });
    message.success(this.i18n("created_and_added"));
  };

  openCreateGroupModal = (tab) => {
    this.setState({ createGroupModalTab: tab, createGroupName: "", openGroupDropdownTabId: null });
  };

  confirmCreateGroup = () => {
    const { createGroupModalTab, createGroupName, configuration } = this.state;
    const name = (createGroupName || "").trim();
    if (!name || !createGroupModalTab?.url) {
      return;
    }
    const pattern = getPatternForTabByAddMode(createGroupModalTab, configuration.addToGroupRuleMode);
    if (!pattern) return;
    const matching = getMatchingRuleAndPatternIndex(createGroupModalTab.url, configuration);
    const rules = (configuration.rules || []).map((r) => ({ ...r, patterns: [...(r.patterns || [])] }));
    if (matching != null) {
      const r = rules[matching.ruleIndex];
      r.patterns = r.patterns.filter((_, i) => i !== matching.patternIndex);
    }
    rules.push({ name, patterns: [{ pattern }] });
    const nextConfig = { ...configuration, rules };
    this.setState({ configuration: nextConfig, createGroupModalTab: null, createGroupName: "" });
    chrome.storage.sync.set({ configuration: nextConfig }, () => {
      chrome.runtime.sendMessage({ groupRightNow: true });
      setTimeout(() => this.loadGroupsAndTabs(), 400);
    });
    message.success(this.i18n("created_and_added"));
  };

  moveTabToGroup = (tab, groupName) => {
    const configuration = this.state.configuration || { fallback: "none", rules: [], addToGroupRuleMode: "url" };
    const pattern = getPatternForTabByAddMode(tab, configuration.addToGroupRuleMode);
    if (!pattern) return;
    const matching = getMatchingRuleAndPatternIndex(tab.url, configuration);
    const rules = (configuration.rules || []).map((r) => ({ ...r, patterns: [...(r.patterns || [])] }));
    if (matching != null) {
      const r = rules[matching.ruleIndex];
      r.patterns = r.patterns.filter((_, i) => i !== matching.patternIndex);
    }
    const targetRule = rules.find((r) => (r.name || "").trim() === (groupName || "").trim());
    if (!targetRule) return;
    if (!targetRule.patterns.some((p) => (p.pattern || p) === pattern)) {
      targetRule.patterns.push({ pattern });
    }
    const nextConfig = { ...configuration, rules };
    this.setState({ configuration: nextConfig });
    chrome.storage.sync.set({ configuration: nextConfig }, () => {
      chrome.runtime.sendMessage({ groupRightNow: true });
      setTimeout(() => this.loadGroupsAndTabs(), 400);
    });
  };

  handleTogglePin = () => {
    const newPinnedState = !this.state.isPinned;
    this.setState({ isPinned: newPinnedState });
    chrome.storage.local.set({ sidebarPinned: newPinnedState });
    chrome.runtime.sendMessage({
      toggleSidebarPin: true,
      pinned: newPinnedState,
    });
  };

  handleToggleGroup = (groupId) => {
    const { collapsedGroups } = this.state;
    const newCollapsedGroups = new Set(collapsedGroups);
    if (newCollapsedGroups.has(groupId)) {
      newCollapsedGroups.delete(groupId);
    } else {
      newCollapsedGroups.add(groupId);
    }
    this.setState({ collapsedGroups: newCollapsedGroups });
  };

  handleToggleUngrouped = () => {
    this.setState({ ungroupedCollapsed: !this.state.ungroupedCollapsed });
  };

  getFaviconUrl = (tab) => {
    // Prefer favicon from Chrome API (most reliable)
    if (tab.favIconUrl) {
      return tab.favIconUrl;
    }
    
    // If Chrome API does not provide one, use Google favicon service as fallback
    if (tab.url) {
      try {
        const urlObj = new URL(tab.url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=16`;
      } catch {
        // URL parse failed, return empty string
      }
    }
    
    return "";
  };

  renderTabItem = (tab, isNested = false, showAddToWorkspace = false, showDeleteFromWorkspace = false, activeWorkspaceIdForDelete = null, showMoveToGroup = false) => {
    const favicon = this.getFaviconUrl(tab);
    const title = tab.title || tab.url || "Untitled";
    const workspaces = this.state.workspaces || [];
    const groupRules = this.state.configuration?.rules || [];
    const openWorkspace = this.state.openWorkspaceDropdownTabId === tab.id;
    const openGroup = this.state.openGroupDropdownTabId === tab.id;
    const hasExtraActions = showMoveToGroup || showAddToWorkspace || showDeleteFromWorkspace;
    const isDropdownOpen = openWorkspace || openGroup;

    return (
      <div
        key={tab.id}
        className={`sidebar-tab-item ${tab.active ? "active" : ""} ${isNested ? "nested" : ""} ${isDropdownOpen ? "dropdown-open" : ""}`}
        onClick={() => this.handleTabClick(tab.id)}
      >
        <div className="sidebar-tab-content">
          <div className="sidebar-tab-icon-container">
            {favicon ? (
              <img
                src={favicon}
                alt=""
                className="sidebar-tab-favicon"
                onError={(e) => {
                  e.target.style.display = "none";
                  const container = e.target.parentElement;
                  if (container) {
                    const placeholder = container.querySelector(".sidebar-tab-favicon-placeholder");
                    if (placeholder) placeholder.style.display = "flex";
                  }
                }}
              />
            ) : null}
            <div
              className="sidebar-tab-favicon-placeholder"
              style={{ display: favicon ? "none" : "flex" }}
            >
              <GlobalOutlined style={{ fontSize: "12px", color: "#999" }} />
            </div>
          </div>
          <span className="sidebar-tab-title" title={title}>
            {title}
          </span>
        </div>
        <div className="sidebar-tab-actions">
          {showMoveToGroup && (
            <Dropdown
              open={openGroup}
              onOpenChange={(open) => this.setState({ openGroupDropdownTabId: open ? tab.id : null })}
              dropdownRender={() => (
                <div className="sidebar-dropdown-panel">
                  <div className="sidebar-dropdown-list">
                    {groupRules.map((r) => (
                      <div
                        key={r.name || ""}
                        className="sidebar-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          this.moveTabToGroup(tab, r.name);
                          this.setState({ openGroupDropdownTabId: null });
                        }}
                      >
                        <FolderOutlined className="sidebar-dropdown-item-icon" />
                        <span className="sidebar-dropdown-item-label">{r.name || ""}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sidebar-dropdown-divider" />
                  <div
                    className="sidebar-dropdown-item sidebar-dropdown-item-new"
                    onClick={(e) => {
                      e.stopPropagation();
                      this.openCreateGroupModal(tab);
                    }}
                  >
                    <PlusCircleOutlined className="sidebar-dropdown-item-icon" />
                    <span className="sidebar-dropdown-item-label">{this.i18n("new_group")}</span>
                  </div>
                </div>
              )}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                icon={<FolderAddOutlined />}
                className="sidebar-tab-move-to-group"
                onClick={(e) => e.stopPropagation()}
                title={this.i18n("move_to_group")}
              />
            </Dropdown>
          )}
          {showDeleteFromWorkspace && activeWorkspaceIdForDelete && (
            <Tooltip title={this.i18n("delete_from_workspace")} placement="top">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                className="sidebar-tab-remove-workspace"
                onClick={(e) => {
                  e.stopPropagation();
                  this.removeTabFromWorkspace(tab, activeWorkspaceIdForDelete);
                }}
              />
            </Tooltip>
          )}
          {showAddToWorkspace && !showDeleteFromWorkspace && (
            <Dropdown
              open={openWorkspace}
              onOpenChange={(open) => this.setState({ openWorkspaceDropdownTabId: open ? tab.id : null })}
              dropdownRender={() => (
                <div className="sidebar-dropdown-panel">
                  <div className="sidebar-dropdown-list">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className="sidebar-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          this.addTabToWorkspace(tab, ws.id);
                          this.setState({ openWorkspaceDropdownTabId: null });
                        }}
                      >
                        <LaptopOutlined className="sidebar-dropdown-item-icon" />
                        <span className="sidebar-dropdown-item-label">{ws.name || ws.id}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sidebar-dropdown-divider" />
                  <div
                    className="sidebar-dropdown-item sidebar-dropdown-item-new"
                    onClick={(e) => {
                      e.stopPropagation();
                      this.openCreateWorkspaceModal(tab);
                    }}
                  >
                    <LaptopOutlined className="sidebar-dropdown-item-icon" />
                    <span className="sidebar-dropdown-item-label">{this.i18n("new_workspace")}</span>
                  </div>
                </div>
              )}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                icon={<LaptopOutlined />}
                className="sidebar-tab-add-workspace"
                onClick={(e) => e.stopPropagation()}
                title={this.i18n("add_to_workspace")}
              />
            </Dropdown>
          )}
          {hasExtraActions && <div className="sidebar-tab-actions-divider" />}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            className="sidebar-tab-close"
            onClick={(e) => this.handleCloseTab(e, tab.id)}
          />
        </div>
      </div>
    );
  };

  render() {
    const {
      groups,
      ungroupedTabs,
      allTabs,
      workspaces,
      viewMode,
      activeWorkspaceId,
      loading,
      isPinned,
      isResizing,
      collapsedGroups,
      ungroupedCollapsed,
      groupStrategy,
      configuration,
      sortGroupsByName,
    } = this.state;

    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
    const workspaceIdsWithTabs = getWorkspacesWithOpenTabs(allTabs, workspaces);
    const workspaceTabs = viewMode === "workspace" && activeWorkspace ? filterTabsByWorkspace(allTabs, activeWorkspace) : [];
    const workspaceGroups = viewMode === "workspace" && workspaceTabs.length > 0
      ? groupTabsForDisplay(workspaceTabs, groupStrategy, configuration, sortGroupsByName)
      : [];

    return (
      <div
        className={`sidebar-container ${isPinned ? "pinned" : ""} ${isResizing ? "resizing" : ""}`}
        ref={this.sidebarRef}
      >
        <div className="sidebar-toolbar">
          <Tooltip
            title={this.i18n("sidebar_groups")}
            placement="bottom"
            getPopupContainer={() => this.sidebarRef.current || document.body}
          >
            <Button
              type="text"
              size="small"
              icon={<HomeOutlined />}
              className="sidebar-toolbar-btn"
              onClick={(e) => {
                this.switchToGroupsView();
                e.currentTarget.blur();
              }}
            />
          </Tooltip>
          {workspaceIdsWithTabs.length > 0 && (
            <>
              <div className="sidebar-toolbar-divider" />
              <div className="sidebar-toolbar-workspaces">
                <div
                  className="sidebar-toolbar-workspaces-scroll"
                  ref={this.workspacesScrollRef}
                >
                  {workspaceIdsWithTabs.map((wid) => {
                    const ws = workspaces.find((w) => w.id === wid);
                    if (!ws) return null;
                    return (
                      <Button
                        key={wid}
                        type="text"
                        size="small"
                        className={`sidebar-toolbar-chip ${activeWorkspaceId === wid ? "active" : ""}`}
                        onClick={() => this.switchToWorkspaceView(wid)}
                        title={ws.name || wid}
                      >
                        {ws.name || wid}
                      </Button>
                    );
                  })}
                </div>
                {this.state.hasWorkspaceOverflow && (
                  <Dropdown
                    trigger={["hover"]}
                    open={this.state.workspaceMoreOpen}
                    onOpenChange={(open) => this.setState({ workspaceMoreOpen: open })}
                    placement="bottomRight"
                    getPopupContainer={() => this.sidebarRef.current || document.body}
                    dropdownRender={() => (
                      <div className="sidebar-toolbar-workspaces-dropdown">
                        {workspaceIdsWithTabs.map((wid) => {
                          const ws = workspaces.find((w) => w.id === wid);
                          if (!ws) return null;
                          return (
                            <div
                              key={wid}
                              className={`sidebar-toolbar-workspaces-dropdown-item ${activeWorkspaceId === wid ? "active" : ""}`}
                              onClick={() => {
                                this.switchToWorkspaceView(wid);
                                this.setState({ workspaceMoreOpen: false });
                              }}
                              title={ws.name || wid}
                            >
                              {ws.name || wid}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="sidebar-toolbar-more"
                      icon={<EllipsisOutlined />}
                      title={this.i18n("more_workspaces")}
                    />
                  </Dropdown>
                )}
              </div>
            </>
          )}
          <div className="sidebar-toolbar-divider" />
          <div className="sidebar-toolbar-actions">
            <Tooltip
              title={this.i18n("group_all_tabs")}
              placement="bottom"
              getPopupContainer={() => this.sidebarRef.current || document.body}
            >
              <Button
                type="text"
                size="small"
                icon={<SyncOutlined />}
                className="sidebar-toolbar-btn"
                onClick={(e) => {
                  this.handleGroupAllTabs();
                  e.currentTarget.blur();
                }}
              />
            </Tooltip>
            <Tooltip
              title={this.i18n("settings")}
              placement="bottom"
              getPopupContainer={() => this.sidebarRef.current || document.body}
            >
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                className="sidebar-toolbar-btn"
                onClick={this.handleOpenSettings}
              />
            </Tooltip>
          </div>
        </div>

        <div className="sidebar-content">
          {loading ? (
            <div className="sidebar-loading">
              <Spin size="large" />
            </div>
          ) : viewMode === "workspace" ? (
            <>
              {workspaceTabs.length === 0 ? (
                <Empty
                  description={this.i18n("no_groups")}
                  className="sidebar-empty"
                />
              ) : (
                <>
                  {workspaceGroups.map((group) => {
                    const wsGroupId = `ws-${group.id}`;
                    const isCollapsed = collapsedGroups.has(wsGroupId);
                    const displayTitle = group.title != null ? group.title : this.i18n("ungrouped_tabs");
                    return (
                      <div key={wsGroupId} className="sidebar-group-tree">
                        <div
                          className="sidebar-group-header-compact"
                          onClick={() => this.handleToggleGroup(wsGroupId)}
                        >
                          <div className="sidebar-group-header-left">
                            {isCollapsed ? (
                              <RightOutlined className="sidebar-group-arrow" />
                            ) : (
                              <DownOutlined className="sidebar-group-arrow" />
                            )}
                            <span className="sidebar-group-title-with-count">
                              <span className="sidebar-group-title-compact">
                                {displayTitle}
                              </span>
                              <span className="sidebar-group-count-compact">
                                {group.tabs.length}
                              </span>
                            </span>
                          </div>
                        </div>
                        {!isCollapsed && (
                          <div className="sidebar-group-tabs-compact">
                            {group.tabs.map((tab) =>
                              this.renderTabItem(tab, true, false, true, activeWorkspaceId)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <>
              {groups.length === 0 && ungroupedTabs.length === 0 ? (
                <Empty
                  description={this.i18n("no_groups")}
                  className="sidebar-empty"
                />
              ) : (
                <>
                  {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.id);
                    return (
                      <div key={group.id} className="sidebar-group-tree">
                        <div
                          className="sidebar-group-header-compact"
                          onClick={() => this.handleToggleGroup(group.id)}
                        >
                          <div className="sidebar-group-header-left">
                            {isCollapsed ? (
                              <RightOutlined className="sidebar-group-arrow" />
                            ) : (
                              <DownOutlined className="sidebar-group-arrow" />
                            )}
                            <span className="sidebar-group-title-with-count">
                              <span className="sidebar-group-title-compact">
                                {group.title || "Untitled Group"}
                              </span>
                              <span className="sidebar-group-count-compact">
                                {group.tabs?.length || 0}
                              </span>
                            </span>
                          </div>
                          <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            className="sidebar-group-close"
                            onClick={(e) => this.handleCloseGroup(e, group)}
                            title={this.i18n("close_group")}
                          />
                        </div>
                        {!isCollapsed && (
                          <div className="sidebar-group-tabs-compact">
                            {group.tabs?.map((tab) => this.renderTabItem(tab, true, true, false, null, this.state.groupStrategy === 3))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {ungroupedTabs.length > 0 && (
                    <div className="sidebar-group-tree">
                      <div
                        className="sidebar-group-header-compact"
                        onClick={this.handleToggleUngrouped}
                      >
                        <div className="sidebar-group-header-left">
                          {ungroupedCollapsed ? (
                            <RightOutlined className="sidebar-group-arrow" />
                          ) : (
                            <DownOutlined className="sidebar-group-arrow" />
                          )}
                          <span className="sidebar-group-title-with-count">
                            <span className="sidebar-group-title-compact">
                              {this.i18n("ungrouped_tabs")}
                            </span>
                            <span className="sidebar-group-count-compact">
                              {ungroupedTabs.length}
                            </span>
                          </span>
                        </div>
                      </div>
                      {!ungroupedCollapsed && (
                        <div className="sidebar-group-tabs-compact">
                          {ungroupedTabs.map((tab) => this.renderTabItem(tab, true, true, false, null, this.state.groupStrategy === 3))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {(this.state.openWorkspaceDropdownTabId || this.state.openGroupDropdownTabId) && (
          <div
            className="sidebar-dropdown-backdrop"
            onClick={() => this.setState({ openWorkspaceDropdownTabId: null, openGroupDropdownTabId: null })}
          />
        )}

        <div
          className="sidebar-resize-handle"
          ref={this.resizeHandleRef}
        >
          <DragOutlined className="resize-handle-icon" />
        </div>

        <Modal
          title={this.i18n("create_workspace_modal_title")}
          open={!!this.state.createWorkspaceModalTab}
          onOk={this.confirmCreateWorkspace}
          onCancel={() => this.setState({ createWorkspaceModalTab: null, createWorkspaceName: "" })}
          okText={this.i18n("save")}
          okButtonProps={{ disabled: !(this.state.createWorkspaceName || "").trim() }}
          destroyOnClose
          afterOpenChange={(open) => {
            if (open) setTimeout(() => this.createWorkspaceInputRef.current?.focus(), 100);
          }}
        >
          <Input
            ref={this.createWorkspaceInputRef}
            placeholder={this.i18n("create_workspace_modal_placeholder")}
            value={this.state.createWorkspaceName}
            onChange={(e) => this.setState({ createWorkspaceName: e.target.value })}
            onPressEnter={this.confirmCreateWorkspace}
          />
        </Modal>
        <Modal
          title={this.i18n("create_group_modal_title")}
          open={!!this.state.createGroupModalTab}
          onOk={this.confirmCreateGroup}
          onCancel={() => this.setState({ createGroupModalTab: null, createGroupName: "" })}
          okText={this.i18n("save")}
          okButtonProps={{ disabled: !(this.state.createGroupName || "").trim() }}
          destroyOnClose
          afterOpenChange={(open) => {
            if (open) setTimeout(() => this.createGroupInputRef.current?.focus(), 100);
          }}
        >
          <Input
            ref={this.createGroupInputRef}
            placeholder={this.i18n("create_group_modal_placeholder")}
            value={this.state.createGroupName}
            onChange={(e) => this.setState({ createGroupName: e.target.value })}
            onPressEnter={this.confirmCreateGroup}
          />
        </Modal>
      </div>
    );
  }
}

export default injectIntl(SidebarPage);

