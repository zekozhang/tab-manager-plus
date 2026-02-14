/**
 * Create a zip of the build/ directory for Chrome Web Store upload.
 * The zip root must contain manifest.json (i.e. contents of build/, not build/ itself).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const buildDir = path.join(__dirname, "..", "build");
const outZip = path.join(__dirname, "..", "tab-manager-plus.zip");

if (!fs.existsSync(buildDir)) {
  console.error("Error: build/ directory not found. Run npm run build first.");
  process.exit(1);
}

const isWindows = process.platform === "win32";

try {
  if (isWindows) {
    // PowerShell: zip contents of build/ so manifest.json is at root
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${outZip}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    // macOS/Linux: zip contents of build/
    execSync(`cd "${buildDir}" && zip -r "${outZip}" .`, {
      stdio: "inherit",
    });
  }
  console.log("\nCreated: tab-manager-plus.zip (ready for Chrome Web Store upload)");
} catch (e) {
  console.error("Failed to create zip:", e.message);
  process.exit(1);
}
