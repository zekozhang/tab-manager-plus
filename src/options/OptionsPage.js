import React from "react";
import { injectIntl } from "react-intl";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Tabs,
  Tooltip,
} from "antd";
import {
  AppstoreOutlined,
  CloseOutlined,
  ControlOutlined,
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  FolderOutlined,
  GlobalOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  ImportOutlined,
  LaptopOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { WORKSPACE_STORAGE_KEY, createWorkspaceId } from "../utils/workspace";
import "./OptionsPage.css";

const STORAGE_KEYS = ["configuration", "enableAutoGroup", "groupTabNum", "groupStrategy", "sortGroupsByName", WORKSPACE_STORAGE_KEY];

class OptionsPage extends React.Component {
  static propTypes = {
    intl: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.i18n = (key) => props.intl.formatMessage({ id: key });
    this.form = React.createRef();
    this.importInputRef = React.createRef();
    this.state = {
      isEditting: false,
      isCreateModalOpen: false,
      isModifyModalOpen: false,
      enableAutoGroup: true,
      groupTabNum: 1,
      groupStrategy: 2,
      sortGroupsByName: false,
      fallback: "none",
      addToGroupRuleMode: "url",
      workspaces: [],
      activeTabKey: "general",
      searchGroupingRules: "",
      addPatternInputs: {},
      addWorkspacePatternInputs: {},
      workspaceNameErrors: {},
      workspaceSortOrder: null,
      workspaceDragOverIndex: -1,
    };
  }

  componentDidMount = () => {
    chrome.storage.sync.get(STORAGE_KEYS, (data) => {
      if (data.configuration) {
        const config = data.configuration;
        const formValues = {
          ...config,
          rules: Array.isArray(config.rules) ? config.rules : [],
          addToGroupRuleMode: config.addToGroupRuleMode === "domain" || config.addToGroupRuleMode === "sld" ? config.addToGroupRuleMode : "url",
        };
        this.form.current?.setFieldsValue(formValues);
        if (config.fallback) this.setState({ fallback: config.fallback });
        const arm = config.addToGroupRuleMode;
        if (arm === "domain" || arm === "sld" || arm === "url") this.setState({ addToGroupRuleMode: arm });
      }
      if (data.enableAutoGroup !== undefined) this.setState({ enableAutoGroup: data.enableAutoGroup });
      if (data.groupTabNum !== undefined) this.setState({ groupTabNum: data.groupTabNum });
      if (data.groupStrategy !== undefined) this.setState({ groupStrategy: data.groupStrategy });
      if (data.sortGroupsByName !== undefined) this.setState({ sortGroupsByName: data.sortGroupsByName });
      if (data[WORKSPACE_STORAGE_KEY]) this.setState({ workspaces: data[WORKSPACE_STORAGE_KEY] });
    });
    this.storageListener = (changes, areaName) => {
      if (areaName === "sync" && changes[WORKSPACE_STORAGE_KEY]) {
        const next = changes[WORKSPACE_STORAGE_KEY].newValue;
        if (Array.isArray(next)) this.setState({ workspaces: next });
      }
    };
    chrome.storage.onChanged.addListener(this.storageListener);
  };

  componentWillUnmount = () => {
    if (this.storageListener) chrome.storage.onChanged.removeListener(this.storageListener);
  };

  saveWorkspaces = (nextWorkspaces) => {
    this.setState({ workspaces: nextWorkspaces });
    chrome.storage.sync.set({ [WORKSPACE_STORAGE_KEY]: nextWorkspaces });
  };

  addWorkspace = () => {
    const ws = {
      id: createWorkspaceId(),
      name: "",
      matchMode: "sld",
      rules: [],
      manualUrls: [],
    };
    this.saveWorkspaces([ws, ...this.state.workspaces]);
  };

  updateWorkspace = (id, patch) => {
    const next = this.state.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w));
    this.saveWorkspaces(next);
  };

  deleteWorkspace = (id) => {
    this.saveWorkspaces(this.state.workspaces.filter((w) => w.id !== id));
  };

  getDisplayedWorkspaces = () => {
    const { workspaces, workspaceSortOrder } = this.state;
    if (workspaceSortOrder === "asc") {
      return [...workspaces].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    }
    if (workspaceSortOrder === "desc") {
      return [...workspaces].sort((a, b) => (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" }));
    }
    return workspaces;
  };

  sortWorkspacesByName = (order) => {
    const sorted =
      order === "asc"
        ? [...this.state.workspaces].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
        : [...this.state.workspaces].sort((a, b) => (b.name || "").localeCompare(a.name || "", undefined, { sensitivity: "base" }));
    this.saveWorkspaces(sorted);
    this.setState({ workspaceSortOrder: order });
  };

  moveWorkspace = (dragIndex, dropIndex) => {
    if (dragIndex === dropIndex) return;
    const list = this.getDisplayedWorkspaces();
    const item = list[dragIndex];
    const next = [...list];
    next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, item);
    this.saveWorkspaces(next);
    this.setState({ workspaceSortOrder: null, workspaceDragOverIndex: -1 });
  };

  addWorkspacePattern = (workspaceId, patternValue) => {
    const ws = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;
    const v = (patternValue || "").trim();
    if (!v) return;
    const existing = (ws.rules || []).map((r) => (typeof r === "string" ? r : r?.pattern ?? ""));
    if (existing.includes(v)) return;
    const nextRules = [...(ws.rules || []).map((r) => (typeof r === "object" && r && "pattern" in r ? r : { pattern: r })), { pattern: v }];
    this.updateWorkspace(workspaceId, { rules: nextRules });
    this.setState((s) => ({ addWorkspacePatternInputs: { ...s.addWorkspacePatternInputs, [workspaceId]: "" } }));
  };

  removeWorkspacePattern = (workspaceId, index) => {
    const ws = this.state.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;
    const rules = (ws.rules || []).filter((_, i) => i !== index);
    const nextRules = rules.map((r) => (typeof r === "object" && r && "pattern" in r ? r : { pattern: r }));
    this.updateWorkspace(workspaceId, { rules: nextRules });
  };

  onSortGroupsByNameChange = (checked) => {
    this.setState({ sortGroupsByName: checked });
    chrome.storage.sync.set({ sortGroupsByName: checked });
  };

  onEnableAutoGroupChange = (checked) => {
    this.setState({ enableAutoGroup: checked });
    chrome.storage.sync.set({ enableAutoGroup: checked });
  };

  onGroupTabNumChange = (value) => {
    this.setState({ groupTabNum: value });
    chrome.storage.sync.set({ groupTabNum: value });
  };

  onGroupStrategyChange = (value) => {
    this.setState({ groupStrategy: value });
    chrome.storage.sync.set({ groupStrategy: value });
  };

  editOrSaveButtomOnClick = () => {
    if (!this.state.isEditting) {
      // Switch form to edit mode
      this.setState({ isEditting: true });
      return;
    }

    if (this.state.activeTabKey === "workspaces") {
      const invalid = this.state.workspaces.filter((w) => !(w.name || "").trim());
      if (invalid.length > 0) {
        const workspaceNameErrors = invalid.reduce((acc, w) => ({ ...acc, [w.id]: true }), {});
        this.setState({ workspaceNameErrors });
        return;
      }
      this.setState({ isEditting: false, workspaceNameErrors: {} });
      return;
    }

    const formValues = this.form.current.getFieldsValue();
    const configuration = {
      ...formValues,
      fallback: this.state.fallback,
      addToGroupRuleMode: this.state.addToGroupRuleMode,
    };
    // Validate form, then save configuration and exit edit mode
    this.form.current
      .validateFields({ recursive: true })
      .then(() => {
        chrome.storage.sync.set({ configuration: configuration }, () => {
          this.setState({ isEditting: false });
        });
      })
      .catch(() => {});
  };

  exportRules = () => {
    chrome.storage.sync.get(STORAGE_KEYS, (data) => {
      const exportData = {
        configuration: data.configuration || { fallback: "none", rules: [], addToGroupRuleMode: "url" },
        enableAutoGroup: data.enableAutoGroup ?? true,
        groupTabNum: data.groupTabNum ?? 1,
        groupStrategy: data.groupStrategy ?? 2,
        sortGroupsByName: data.sortGroupsByName ?? false,
        workspaces: data[WORKSPACE_STORAGE_KEY] || [],
      };
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tab-manager-plus-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  importRules = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const raw = JSON.parse(text);

        // Support both old format (configuration-only) and new full config format
        const hasFullConfig = raw.configuration && typeof raw.configuration === "object";
        const configObj = hasFullConfig ? raw.configuration : raw;

        if (typeof configObj.fallback !== "string" || !Array.isArray(configObj.rules)) {
          message.error(this.i18n("import_error_format"));
          return;
        }

        const config = {
          fallback: configObj.fallback,
          addToGroupRuleMode: configObj.addToGroupRuleMode === "domain" || configObj.addToGroupRuleMode === "sld" ? configObj.addToGroupRuleMode : "url",
          rules: configObj.rules.map((r) => ({
            name: r.name ?? "",
            patterns: Array.isArray(r.patterns)
              ? r.patterns.map((p) => ({ pattern: p?.pattern ?? (typeof p === "string" ? p : "") ?? "" }))
              : [{ pattern: "" }],
          })),
        };

        const storageUpdate = { configuration: config };

        // Import general settings if present (full config format)
        if (hasFullConfig) {
          if (typeof raw.enableAutoGroup === "boolean") storageUpdate.enableAutoGroup = raw.enableAutoGroup;
          if (typeof raw.groupTabNum === "number") storageUpdate.groupTabNum = raw.groupTabNum;
          if (typeof raw.groupStrategy === "number") storageUpdate.groupStrategy = raw.groupStrategy;
          if (typeof raw.sortGroupsByName === "boolean") storageUpdate.sortGroupsByName = raw.sortGroupsByName;
          if (Array.isArray(raw.workspaces)) storageUpdate[WORKSPACE_STORAGE_KEY] = raw.workspaces;
        }

        chrome.storage.sync.set(storageUpdate, () => {
          this.form.current?.setFieldsValue(config);
          // Restore general settings state
          if (storageUpdate.enableAutoGroup !== undefined) this.setState({ enableAutoGroup: storageUpdate.enableAutoGroup });
          if (storageUpdate.groupTabNum !== undefined) this.setState({ groupTabNum: storageUpdate.groupTabNum });
          if (storageUpdate.groupStrategy !== undefined) this.setState({ groupStrategy: storageUpdate.groupStrategy });
          if (storageUpdate.sortGroupsByName !== undefined) this.setState({ sortGroupsByName: storageUpdate.sortGroupsByName });
          if (storageUpdate[WORKSPACE_STORAGE_KEY]) this.setState({ workspaces: storageUpdate[WORKSPACE_STORAGE_KEY] });
          this.setState({ fallback: config.fallback, addToGroupRuleMode: config.addToGroupRuleMode });
          message.success(this.i18n("import_success"));
        });
      } catch (_) {
        message.error(this.i18n("import_error_invalid"));
      }
      e.target.value = "";
    };
    reader.readAsText(file, "UTF-8");
  };

  render() {
    const groupStrategyOptions = [
      { label: this.i18n("domain"), value: 1 },
      { label: this.i18n("sld"), value: 2 },
      { label: this.i18n("configuration"), value: 3 },
    ];
    const isCustomStrategy = this.state.groupStrategy === 3;

    return (
      <div className="options-page">
        <header className="options-page__header">
          <div className="options-page__header-inner">
            <div className="options-page__brand">
              <img src="/images/TabManagerPlus.png" alt="Tab Manager Plus" className="options-page__logo-img" />
              <h1 className="options-page__title">Tab Manager Plus</h1>
              <span className="options-page__pill">{this.i18n("settings")}</span>
            </div>
            <div className="options-page__header-actions">
              <input
                type="file"
                ref={this.importInputRef}
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={this.importRules}
              />
              <button type="button" className="options-page__header-btn" onClick={this.exportRules}>
                <ExportOutlined />
                {this.i18n("export_rules")}
              </button>
              <button type="button" className="options-page__header-btn" onClick={() => this.importInputRef.current?.click()}>
                <ImportOutlined />
                {this.i18n("import_rules")}
              </button>
              {((this.state.activeTabKey === "grouping" && isCustomStrategy) || this.state.activeTabKey === "workspaces") && (
                <button
                  type="button"
                  className="options-page__save-btn"
                  onClick={this.editOrSaveButtomOnClick}
                >
                  <SaveOutlined />
                  {this.state.isEditting ? this.i18n("save_changes") : this.i18n("edit")}
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="options-page__body">
          <Tabs
            defaultActiveKey="general"
            activeKey={this.state.activeTabKey}
            onChange={(key) => this.setState({ activeTabKey: key })}
            className="options-tabs"
            items={[
              {
                key: "general",
                label: (
                  <span className="options-tab-label">
                    <ControlOutlined />
                    {this.i18n("tab_configuration")}
                  </span>
                ),
                children: (
                  <div className="options-tab-pane">
                    {/* Basic Settings Section */}
                    <section className="options-section-wrap">
                      <h2 className="options-section-title">
                        <SettingOutlined />
                        {this.i18n("basic_settings")}
                      </h2>
                      <div className="options-general-cards">
                        {/* Card 1: Automation */}
                        <div className="options-behavior-card options-behavior-card--emerald">
                          <div className="options-behavior-card__header">
                            <div className="options-behavior-card__icon options-behavior-card__icon--emerald">
                              <ThunderboltOutlined />
                            </div>
                            <h3 className="options-behavior-card__title">{this.i18n("automation_title")}</h3>
                          </div>
                          <div className="options-config-items">
                            {/* Enable Auto Group */}
                            <div className="options-config-row">
                              <div className="options-config-row__text">
                                <span className="options-config-row__label">{this.i18n("auto_group_tabs")}</span>
                                <span className="options-config-row__desc">{this.i18n("auto_group_tabs_desc")}</span>
                              </div>
                              <Switch
                                checked={this.state.enableAutoGroup}
                                onChange={this.onEnableAutoGroupChange}
                                size="small"
                              />
                            </div>
                            {/* Min Tabs Per Group */}
                            <div className="options-config-field">
                              <span className="options-config-field__label">{this.i18n("min_tabs_per_group")}</span>
                              <div className="options-config-field__input-wrap">
                                <InputNumber
                                  min={1}
                                  value={this.state.groupTabNum}
                                  onChange={this.onGroupTabNumChange}
                                  className="options-config-number-input"
                                />
                                <span className="options-config-field__suffix">tabs</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Organization */}
                        <div className="options-behavior-card options-behavior-card--purple">
                          <div className="options-behavior-card__header">
                            <div className="options-behavior-card__icon options-behavior-card__icon--purple">
                              <AppstoreOutlined />
                            </div>
                            <h3 className="options-behavior-card__title">{this.i18n("organization_title")}</h3>
                          </div>
                          <div className="options-config-items">
                            {/* Group Strategy */}
                            <div className="options-config-field">
                              <span className="options-config-field__label options-config-field__label--with-icon">
                                <FilterOutlined className="options-config-field__icon" />
                                {this.i18n("grouping_strategy")}
                                <Tooltip title={this.i18n("grouping_strategy_tooltip")}>
                                  <InfoCircleOutlined className="options-config-field__tip-icon" />
                                </Tooltip>
                              </span>
                              <Select
                                value={this.state.groupStrategy}
                                onChange={this.onGroupStrategyChange}
                                className="options-config-select"
                                options={groupStrategyOptions}
                              />
                            </div>
                            {/* Sort Groups By Name */}
                            <div className="options-config-row options-config-row--border-top">
                              <div className="options-config-row__left">
                                <SortAscendingOutlined className="options-config-row__icon" />
                                <div className="options-config-row__text">
                                  <span className="options-config-row__label">{this.i18n("sort_groups_by_name")}</span>
                                  <span className="options-config-row__desc">{this.i18n("sort_groups_by_name_desc")}</span>
                                </div>
                              </div>
                              <Switch
                                checked={this.state.sortGroupsByName}
                                onChange={this.onSortGroupsByNameChange}
                                size="small"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Advanced Behavior Section */}
                    <section className={`options-section-wrap${!isCustomStrategy ? " options-section-wrap--disabled" : ""}`}>
                      <h2 className="options-section-title">
                        <StarOutlined />
                        {this.i18n("advanced_behavior")}
                      </h2>
                      <div className="options-general-cards">
                        {/* Fallback Grouping card */}
                        <div className="options-behavior-card options-behavior-card--amber">
                          <div className="options-behavior-card__header">
                            <div className="options-behavior-card__icon options-behavior-card__icon--amber">
                              <AppstoreOutlined />
                            </div>
                            <h3 className="options-behavior-card__title">{this.i18n("config_title_fallback")}</h3>
                          </div>
                          <div className="options-config-items">
                            <div className="options-config-field">
                              <label className="options-behavior-card__label">{this.i18n("fallback_when_no_match")}</label>
                              <Select
                                value={this.state.fallback}
                                disabled={!isCustomStrategy}
                                onChange={(val) => {
                                  this.setState({ fallback: val });
                                  chrome.storage.sync.get("configuration", (data) => {
                                    const config = data.configuration || {};
                                    config.fallback = val;
                                    chrome.storage.sync.set({ configuration: config });
                                  });
                                }}
                                style={{ width: "100%" }}
                                className="options-config-select"
                                options={[
                                  { value: "none", label: this.i18n("option_none") },
                                  { value: "domain", label: this.i18n("option_domain") },
                                  { value: "sld", label: this.i18n("option_sld") },
                                ]}
                              />
                            </div>
                            <p className="options-behavior-card__hint">{this.i18n("fallback_hint")}</p>
                          </div>
                        </div>

                        {/* Quick Rule Creation card */}
                        <div className="options-behavior-card options-behavior-card--blue">
                          <div className="options-behavior-card__header">
                            <div className="options-behavior-card__icon options-behavior-card__icon--blue">
                              <ThunderboltOutlined />
                            </div>
                            <h3 className="options-behavior-card__title">{this.i18n("quick_rule_creation_title")}</h3>
                          </div>
                          <div className="options-config-items">
                            <div className="options-config-field">
                              <label className="options-behavior-card__label">{this.i18n("add_to_group_rule_mode")}</label>
                              <Select
                                value={this.state.addToGroupRuleMode}
                                disabled={!isCustomStrategy}
                                onChange={(val) => {
                                  this.setState({ addToGroupRuleMode: val });
                                  chrome.storage.sync.get("configuration", (data) => {
                                    const config = data.configuration || {};
                                    config.addToGroupRuleMode = val;
                                    chrome.storage.sync.set({ configuration: config });
                                  });
                                }}
                                style={{ width: "100%" }}
                                className="options-config-select"
                                options={[
                                  { value: "url", label: this.i18n("add_to_group_rule_mode_url") },
                                  { value: "domain", label: this.i18n("add_to_group_rule_mode_domain") },
                                  { value: "sld", label: this.i18n("add_to_group_rule_mode_sld") },
                                ]}
                              />
                            </div>
                            <p className="options-behavior-card__hint">{this.i18n("quick_rule_creation_hint")}</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                ),
              },
              {
                key: "grouping",
                forceRender: true,
                label: (
                  <span className="options-tab-label">
                    <FolderOutlined />
                    {this.i18n("tab_rules")}
                  </span>
                ),
                children: (
                  <div className="options-tab-pane">
                    {!isCustomStrategy && (
                      <Alert
                        message={this.i18n("custom_mode_required_hint")}
                        type="warning"
                        showIcon
                        className="options-custom-mode-hint"
                      />
                    )}
                    <Form name="userConfiguration" ref={this.form} disabled={!this.state.isEditting} autoComplete="off" onValuesChange={() => this.forceUpdate()}>
                      {/* Custom Grouping Rules */}
                      <section className="options-section-wrap">
                        <Form.List name="rules">
                          {(rules, { add, remove }) => {
                            const rulesValue = this.form.current?.getFieldValue?.("rules") || [];
                            const searchQ = (this.state.searchGroupingRules || "").trim().toLowerCase();
                            const matchRule = (idx) => {
                              if (!searchQ) return true;
                              const r = rulesValue[idx];
                              if (!r) return true;
                              const name = (r.name || "").toLowerCase();
                              const patterns = (r.patterns || []).map((p) => (typeof p === "string" ? p : p?.pattern || "").toLowerCase());
                              return name.includes(searchQ) || patterns.some((p) => p.includes(searchQ));
                            };
                            return (
                              <>
                                <div className="options-grouping-header">
                                  <div>
                                    <h2 className="options-section-title">
                                      <StarOutlined />
                                      {this.i18n("config_title_custom_rule")}
                                    </h2>
                                    <p className="options-section-desc">{this.i18n("custom_rules_desc")}</p>
                                  </div>
                                  <div className="options-grouping-header__actions">
                                    <Button icon={<PlusOutlined />} onClick={() => add({ name: "", patterns: [] }, 0)} className="options-btn-outline">
                                      {this.i18n("add_rule")}
                                    </Button>
                                  </div>
                                </div>
                                {rules.length > 0 && (
                                  <div className="options-search-wrap">
                                    <Input
                                      placeholder={this.i18n("search_rules_placeholder")}
                                      value={this.state.searchGroupingRules}
                                      onChange={(e) => this.setState({ searchGroupingRules: e.target.value })}
                                      allowClear
                                      prefix={<SearchOutlined className="options-search-icon" />}
                                      disabled={false}
                                    />
                                  </div>
                                )}
                                <div className="options-rule-list-wrap">
                                  {rules.map((rule) => {
                                    const match = matchRule(rule.name);
                                    return (
                                      <Card size="small" key={rule.key} className="options-item-card" hoverable style={{ display: match ? undefined : "none" }}>
                                        <div className="options-item-card-header">
                                          <div className="options-item-card__name-wrap">
                                            <span className="options-item-card__label">{this.i18n("group_name_label")}</span>
                                            <Form.Item
                                              name={[rule.name, "name"]}
                                              rules={[{ required: true, message: this.i18n("group_name_validate_message") }]}
                                              className="options-item-name-form-item"
                                              validateTrigger={["onSubmit", "onChange"]}
                                            >
                                              <Input placeholder={this.i18n("group_name")} className="options-item-name-input" size="small" />
                                            </Form.Item>
                                          </div>
                                          {this.state.isEditting && (
                                            <Button
                                              type="text"
                                              danger
                                              size="small"
                                              icon={<DeleteOutlined />}
                                              className="options-item-delete-btn"
                                              onClick={() => remove(rule.name)}
                                              title={this.i18n("delete_rule")}
                                            />
                                          )}
                                        </div>
                                        <Form.Item
                                          label={this.i18n("patterns_label")}
                                          tooltip={{ title: this.i18n("tooltip_of_pattern") }}
                                          className="options-patterns-label"
                                        >
                                          <Form.List name={[rule.name, "patterns"]} initialValue={[]}>
                                            {(patterns, patternOp) => {
                                              const patternsValue = this.form.current?.getFieldValue?.(["rules", rule.name, "patterns"]) || [];
                                              const addVal = (this.state.addPatternInputs || {})[rule.name] ?? "";
                                              const handleAddPattern = () => {
                                                const v = (addVal || "").trim();
                                                if (!v) return;
                                                const list = this.form.current?.getFieldValue?.(["rules", rule.name, "patterns"]) || [];
                                                if (list.some((p) => (p?.pattern || "") === v)) {
                                                  this.setState((s) => ({ addPatternInputs: { ...s.addPatternInputs, [rule.name]: "" } }));
                                                  return;
                                                }
                                                patternOp.add({ pattern: v });
                                                this.setState((s) => ({ addPatternInputs: { ...s.addPatternInputs, [rule.name]: "" } }));
                                              };
                                              return (
                                                <>
                                                  <div className="options-pattern-chips">
                                                    {patterns.map((pattern) => {
                                                      const pVal = patternsValue[pattern.name]?.pattern ?? patternsValue[pattern.name] ?? "";
                                                      if (!pVal || typeof pVal !== "string") return null;
                                                      return (
                                                        <span key={pattern.key} className="options-pattern-chip">
                                                          <Form.Item noStyle name={[pattern.name, "pattern"]}>
                                                            <input type="hidden" />
                                                          </Form.Item>
                                                          <GlobalOutlined className="options-pattern-chip-globe" />
                                                          <span className="options-pattern-chip-text">{pVal}</span>
                                                          {this.state.isEditting && (
                                                            <button
                                                              type="button"
                                                              className="options-pattern-chip-remove"
                                                              onClick={() => patternOp.remove(pattern.name)}
                                                              aria-label={this.i18n("delete_workspace")}
                                                            >
                                                              <CloseOutlined />
                                                            </button>
                                                          )}
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                  <div className="options-add-pattern-row">
                                                    <div className="options-add-pattern-input-wrap">
                                                      <Input
                                                        placeholder={this.i18n("add_pattern_placeholder")}
                                                        value={addVal}
                                                        onChange={(e) => this.setState((s) => ({ addPatternInputs: { ...s.addPatternInputs, [rule.name]: e.target.value } }))}
                                                        onPressEnter={(e) => { e.preventDefault(); handleAddPattern(); }}
                                                        className="options-add-pattern-input"
                                                        disabled={!this.state.isEditting}
                                                      />
                                                      <button
                                                        type="button"
                                                        className="options-add-pattern-btn"
                                                        onClick={handleAddPattern}
                                                        disabled={!this.state.isEditting || !addVal.trim()}
                                                        aria-label={this.i18n("add_pattern")}
                                                      >
                                                        <PlusOutlined />
                                                      </button>
                                                    </div>
                                                  </div>
                                                  <p className="options-pattern-hint">{this.i18n("tooltip_of_pattern")}</p>
                                                </>
                                              );
                                            }}
                                          </Form.List>
                                        </Form.Item>
                                      </Card>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          }}
                        </Form.List>
                      </section>
                    </Form>
                  </div>
                ),
              },
              {
                key: "workspaces",
                label: (
                  <span className="options-tab-label">
                    <LaptopOutlined />
                    {this.i18n("workspaces")}
                  </span>
                ),
                children: (
                  <div className="options-tab-pane">
                    <section className="options-section-wrap">
                      <div className="options-grouping-header">
                        <div>
                          <h2 className="options-section-title">
                            <LaptopOutlined />
                            {this.i18n("workspaces")}
                          </h2>
                          <p className="options-section-desc">{this.i18n("workspace_rules_hint")}</p>
                        </div>
                        <div className="options-grouping-header__actions">
                          {this.state.isEditting && (
                            <>
                              <Tooltip
                                title={
                                  this.state.workspaceSortOrder === "asc"
                                    ? this.i18n("workspace_sort_desc")
                                    : this.i18n("workspace_sort_asc")
                                }
                              >
                                <Button
                                  icon={
                                    this.state.workspaceSortOrder === "asc" ? (
                                      <SortDescendingOutlined />
                                    ) : (
                                      <SortAscendingOutlined />
                                    )
                                  }
                                  onClick={() =>
                                    this.sortWorkspacesByName(this.state.workspaceSortOrder === "asc" ? "desc" : "asc")
                                  }
                                  className="options-btn-outline options-workspace-sort-btn"
                                />
                              </Tooltip>
                              <Button icon={<PlusOutlined />} onClick={this.addWorkspace} className="options-btn-outline">
                                {this.i18n("add_workspace")}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="options-rule-list-wrap">
                        {this.getDisplayedWorkspaces().map((ws, index) => {
                          const rulesList = (ws.rules || []).map((r) => (typeof r === "string" ? r : r?.pattern ?? ""));
                          const addPatVal = (this.state.addWorkspacePatternInputs || {})[ws.id] ?? "";
                          const isDragOver = this.state.workspaceDragOverIndex === index;
                          return (
                            <div
                              key={ws.id}
                              className={`options-workspace-card-draggable ${isDragOver ? "options-workspace-card-draggable--over" : ""}`}
                              draggable={this.state.isEditting}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", String(index));
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                this.setState({ workspaceDragOverIndex: index });
                              }}
                              onDragLeave={() => this.setState({ workspaceDragOverIndex: -1 })}
                              onDrop={(e) => {
                                e.preventDefault();
                                const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                                if (!Number.isNaN(dragIndex)) this.moveWorkspace(dragIndex, index);
                                this.setState({ workspaceDragOverIndex: -1 });
                              }}
                              onDragEnd={() => this.setState({ workspaceDragOverIndex: -1 })}
                            >
                              <Card size="small" className="options-item-card" hoverable>
                                <div className="options-item-card-header">
                                  {this.state.isEditting && (
                                    <span className="options-workspace-drag-handle" title={this.i18n("workspace_drag_reorder")}>
                                      <HolderOutlined />
                                    </span>
                                  )}
                                <div
                                  className={`options-item-card__name-wrap ${this.state.workspaceNameErrors?.[ws.id] ? "ant-form-item-has-error" : ""}`}
                                >
                                  <span className="options-item-card__label">{this.i18n("workspace_name_label")}</span>
                                  <Input
                                    placeholder={this.i18n("workspace_name_placeholder")}
                                    value={ws.name}
                                    onChange={(e) => {
                                      this.setState((prev) => ({ workspaceNameErrors: { ...prev.workspaceNameErrors, [ws.id]: false } }));
                                      this.updateWorkspace(ws.id, { name: e.target.value });
                                    }}
                                    className="options-item-name-input"
                                    size="small"
                                    disabled={!this.state.isEditting}
                                  />
                                  {this.state.workspaceNameErrors?.[ws.id] && (
                                    <div className="options-item-card__name-wrap-error">
                                      {this.i18n("workspace_name_validate_message")}
                                    </div>
                                  )}
                                </div>
                                <div className="options-workspace-match-wrap">
                                  <Tooltip title={this.i18n("workspace_match_mode_tooltip")}>
                                    <span className="options-workspace-match-label">
                                      <InfoCircleOutlined className="options-workspace-match-tip-icon" />
                                    </span>
                                  </Tooltip>
                                  <Select
                                    value={ws.matchMode || "url"}
                                    onChange={(v) => this.updateWorkspace(ws.id, { matchMode: v })}
                                    className="options-item-mode-select options-workspace-mode-select"
                                    size="small"
                                    disabled={!this.state.isEditting}
                                    options={[
                                      { value: "url", label: this.i18n("workspace_match_url") },
                                      { value: "domain", label: this.i18n("workspace_match_domain") },
                                      { value: "sld", label: this.i18n("workspace_match_sld") },
                                    ]}
                                  />
                                </div>
                                {this.state.isEditting && (
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    className="options-item-delete-btn"
                                    onClick={() => this.deleteWorkspace(ws.id)}
                                    title={this.i18n("delete_workspace")}
                                  />
                                )}
                              </div>
                              <div className="options-workspace-patterns">
                                <div className="options-patterns-label">
                                  <span className="options-patterns-label-text">{this.i18n("patterns_label")}</span>
                                </div>
                                <div className="options-pattern-chips options-pattern-chips--below-label">
                                  {rulesList.map((pVal, idx) => (
                                    <span key={idx} className="options-pattern-chip">
                                      <GlobalOutlined className="options-pattern-chip-globe" />
                                      <span className="options-pattern-chip-text">{pVal}</span>
                                      {this.state.isEditting && (
                                        <button
                                          type="button"
                                          className="options-pattern-chip-remove"
                                          onClick={() => this.removeWorkspacePattern(ws.id, idx)}
                                          aria-label={this.i18n("delete_workspace")}
                                        >
                                          <CloseOutlined />
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                                <div className="options-add-pattern-row">
                                  <div className="options-add-pattern-input-wrap">
                                    <Input
                                      placeholder={this.i18n("add_pattern_placeholder")}
                                      value={addPatVal}
                                      onChange={(e) => this.setState((s) => ({ addWorkspacePatternInputs: { ...s.addWorkspacePatternInputs, [ws.id]: e.target.value } }))}
                                      onPressEnter={(e) => { e.preventDefault(); this.addWorkspacePattern(ws.id, addPatVal); }}
                                      className="options-add-pattern-input"
                                      disabled={!this.state.isEditting}
                                    />
                                    <button
                                      type="button"
                                      className="options-add-pattern-btn"
                                      onClick={() => this.addWorkspacePattern(ws.id, addPatVal)}
                                      disabled={!this.state.isEditting || !addPatVal.trim()}
                                      aria-label={this.i18n("add_pattern")}
                                    >
                                      <PlusOutlined />
                                    </button>
                                  </div>
                                </div>
                                <p className="options-pattern-hint">{this.i18n("tooltip_of_pattern")}</p>
                              </div>
                            </Card>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    );
  }
}

export default injectIntl(OptionsPage);
