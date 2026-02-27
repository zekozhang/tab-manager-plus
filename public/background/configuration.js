// getDomain is no longer used after switching to full URL matching

export const defaultConfiguration = {
  fallback: "none",
  rules: [],
  addToGroupRuleMode: "url", // "url" | "domain" | "sld" when adding a page to a group rule
};

export function getGroupKeyByConfig(url, configuration) {
  for (let rule of configuration.rules || []) {
    for (let obj of rule.patterns || []) {
      const pattern = typeof obj === "string" ? obj : obj?.pattern;
      if (pattern && isExpressionMatched(url, pattern)) {
        return rule.name;
      }
    }
  }
  return null;
}

export function getGroupTitleByConfig(url, configuration) {
  return getGroupKeyByConfig(url, configuration);
}

function isExpressionMatched(url, expression) {
  // Convert * in expression to .* for regex, and escape other regex metacharacters
  const regexPattern = expression.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  // Build regex
  const regex = new RegExp(`^${regexPattern}$`);
  // Check if URL matches the expression
  return regex.test(url);
}
