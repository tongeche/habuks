import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const TEMPLATE_BUCKET = "organization-templates";
const DEFAULT_TEMPLATE_DIR = path.join(repoRoot, "template-uploads", "organization-templates");

const CONTENT_TYPE_BY_EXTENSION = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

const FORMAT_BY_EXTENSION = {
  docx: "DOCX",
  pdf: "PDF",
  xlsx: "XLSX",
  xls: "XLSX",
  pptx: "PPTX",
  ppt: "PPTX",
  csv: "CSV",
  txt: "TXT",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPG",
  webp: "WEBP",
  gif: "GIF",
  svg: "SVG",
};

function loadEnvFromFile(envPath) {
  return fs
    .readFile(envPath, "utf8")
    .then((raw) => {
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) return;
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
        if (key && !(key in process.env)) {
          process.env[key] = value;
        }
      });
    })
    .catch(() => {});
}

function parseArgs(argv) {
  const options = {
    dir: DEFAULT_TEMPLATE_DIR,
    tenantId: "",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--dir") {
      options.dir = argv[index + 1] ? path.resolve(argv[index + 1]) : options.dir;
      index += 1;
      continue;
    }
    if (arg === "--tenant") {
      options.tenantId = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
  }

  return options;
}

function sanitizeSegment(value, fallback = "template") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

function toDisplayNameFromKey(key) {
  return String(key || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getExtension(fileName) {
  return String(fileName || "")
    .split(".")
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getMimeType(extension) {
  return CONTENT_TYPE_BY_EXTENSION[extension] || "application/octet-stream";
}

function getFormat(extension) {
  return FORMAT_BY_EXTENSION[extension] || extension.toUpperCase() || "FILE";
}

async function listTemplateFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name.toLowerCase() === "readme.md") continue;
    const absolutePath = path.join(directoryPath, entry.name);
    const extension = getExtension(entry.name);
    if (!extension) continue;
    if (!CONTENT_TYPE_BY_EXTENSION[extension]) continue;
    const stats = await fs.stat(absolutePath);
    if (!stats.size) continue;
    files.push({
      absolutePath,
      fileName: entry.name,
      sizeBytes: stats.size,
    });
  }

  return files;
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function main() {
  await loadEnvFromFile(path.join(repoRoot, ".env"));
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(
      [
        "Upload organization template files to Supabase storage and sync DB metadata.",
        "",
        "Usage:",
        "  node scripts/upload-organization-templates.mjs [--dir <path>] [--tenant <tenant_uuid>] [--dry-run]",
        "",
        "Defaults:",
        `  --dir ${DEFAULT_TEMPLATE_DIR}`,
        "  --tenant (not set => global template paths)",
      ].join("\n")
    );
    process.exit(0);
  }

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
  }

  await ensureDirectory(options.dir);
  const files = await listTemplateFiles(options.dir);
  if (!files.length) {
    console.log(`No files found in ${options.dir}`);
    process.exit(0);
  }

  const tenantSegment = sanitizeSegment(options.tenantId, "");
  const basePath = tenantSegment
    ? `tenants/${tenantSegment}/organization/templates`
    : "global/organization/templates";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let uploadedCount = 0;
  let syncedCount = 0;

  for (const file of files) {
    const extension = getExtension(file.fileName);
    const templateKey = sanitizeSegment(file.fileName.replace(/\.[^.]+$/, ""), "template");
    const storageFileName = `${templateKey}.${extension || "bin"}`;
    const storagePath = `${basePath}/${storageFileName}`;
    const mimeType = getMimeType(extension);
    const format = getFormat(extension);

    if (options.dryRun) {
      console.log(`[dry-run] ${file.fileName} -> ${storagePath} (${format})`);
      continue;
    }

    const fileContent = await fs.readFile(file.absolutePath);
    const { error: uploadError } = await supabase.storage.from(TEMPLATE_BUCKET).upload(storagePath, fileContent, {
      upsert: true,
      contentType: mimeType,
      cacheControl: "3600",
    });
    if (uploadError) {
      throw new Error(`Failed to upload ${file.fileName}: ${uploadError.message || uploadError}`);
    }
    uploadedCount += 1;

    const templatePayload = {
      file_path: storagePath,
      mime_type: mimeType,
      file_ext: extension || null,
      file_size_bytes: file.sizeBytes,
      format,
      is_active: true,
      tenant_id: tenantSegment || null,
      updated_at: new Date().toISOString(),
    };

    let updateQuery = supabase
      .from("organization_templates")
      .update(templatePayload)
      .eq("template_key", templateKey);
    if (tenantSegment) {
      updateQuery = updateQuery.eq("tenant_id", tenantSegment);
    } else {
      updateQuery = updateQuery.is("tenant_id", null);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select("id").limit(1);
    if (updateError) {
      throw new Error(`Failed to sync DB metadata for ${file.fileName}: ${updateError.message || updateError}`);
    }

    if (!Array.isArray(updatedRows) || !updatedRows.length) {
      const insertPayload = {
        template_key: templateKey,
        tenant_id: tenantSegment || null,
        name: toDisplayNameFromKey(templateKey),
        category: "General Templates",
        description: "",
        sections: [],
        sort_order: 100,
        ...templatePayload,
      };
      const { error: insertError } = await supabase.from("organization_templates").insert(insertPayload);
      if (insertError) {
        throw new Error(`Failed to insert DB metadata for ${file.fileName}: ${insertError.message || insertError}`);
      }
    }

    syncedCount += 1;
    console.log(`Uploaded ${file.fileName} -> ${storagePath}`);
  }

  if (options.dryRun) {
    console.log(`Dry run completed. ${files.length} file(s) detected.`);
    return;
  }

  console.log(`Done. Uploaded ${uploadedCount} file(s), synced ${syncedCount} template record(s).`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
