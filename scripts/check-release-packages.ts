import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type PackManifest = {
  files: Array<{ path: string }>;
};

type PackageCheck = {
  dir: string;
  requiredFiles: string[];
};

const packageChecks: PackageCheck[] = [
  {
    dir: "packages/debian-bullseye-busybox-image-recipe",
    requiredFiles: ["CHANGELOG.md", "dist/recipe.js", "dist/recipe.d.ts"],
  },
  {
    dir: "packages/debian-bullseye-busybox-recipe",
    requiredFiles: ["CHANGELOG.md", "Dockerfile", "dist/recipe.js", "dist/recipe.d.ts"],
  },
  {
    dir: "packages/debian-bullseye-busybox-runtime",
    requiredFiles: [
      "CHANGELOG.md",
      "dist/index.d.ts",
      "dist/index.js",
      "rootfs/embedos-rootfs.ext2",
    ],
  },
  {
    dir: "packages/vite",
    requiredFiles: ["CHANGELOG.md", "dist/index.d.ts", "dist/index.js"],
  },
  {
    dir: "packages/vue",
    requiredFiles: ["CHANGELOG.md", "dist/embedos-vue.js", "dist/lib.css"],
  },
];

const packageListFile = process.env.PACKAGES_FILE;
const selectedPackages = packageListFile
  ? (JSON.parse(fs.readFileSync(packageListFile, "utf8")) as Array<{ file: string }>)
      .map((pkg) => path.dirname(pkg.file))
      .filter((dir): dir is string => Boolean(dir))
  : packageChecks.map((check) => check.dir);

for (const check of packageChecks.filter((pkg) => selectedPackages.includes(pkg.dir))) {
  const output = execFileSync("npm", ["pack", "--json", "--dry-run", "--ignore-scripts"], {
    cwd: path.join(process.cwd(), check.dir),
    encoding: "utf8",
  });

  const [manifest] = JSON.parse(output) as [PackManifest];
  const paths = new Set(manifest.files.map((file) => file.path));
  const missing = check.requiredFiles.filter((file) => !paths.has(file));

  if (missing.length > 0) {
    throw new Error(`${check.dir} is missing packed files: ${missing.join(", ")}`);
  }

  for (const filePath of paths) {
    if (filePath.includes("playground")) {
      throw new Error(`${check.dir} pack unexpectedly includes playground content: ${filePath}`);
    }
  }

  console.log(`${check.dir}: ${manifest.files.length} packed files`);
}
