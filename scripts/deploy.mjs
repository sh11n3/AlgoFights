/** Uploads the static build without deleting remote content; index.html is uploaded last. */
import SftpClient from "ssh2-sftp-client";
import { readdir, readFile } from "node:fs/promises";
import { resolve, join, posix } from "node:path";
import { createHash } from "node:crypto";

const required = [
  "SFTP_HOST",
  "SFTP_USER",
  "SFTP_PASSWORD",
  "SFTP_PATH",
  "SFTP_FINGERPRINT",
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Fehlendes Deployment-Secret: ${key}`);
const remote = posix.normalize(process.env.SFTP_PATH);
if (!remote.startsWith("/") || remote === "/" || remote.includes(".."))
  throw new Error(
    "SFTP_PATH muss ein expliziter absoluter Webroot sein, nicht /.",
  );
const sftp = new SftpClient();
try {
  await sftp.connect({
    host: process.env.SFTP_HOST,
    port: Number(process.env.SFTP_PORT || 22),
    username: process.env.SFTP_USER,
    password: process.env.SFTP_PASSWORD,
    readyTimeout: 20000,
    hostVerifier: (key) =>
      "SHA256:" +
        createHash("sha256").update(key).digest("base64").replace(/=+$/, "") ===
      process.env.SFTP_FINGERPRINT,
  });
  const directory = resolve("dist");
  const files = [];
  async function walk(local, relative = "") {
    for (const entry of await readdir(local, { withFileTypes: true })) {
      const subpath = posix.join(relative, entry.name);
      if (entry.isDirectory()) await walk(join(local, entry.name), subpath);
      else if (entry.isFile()) files.push(subpath);
    }
  }
  await walk(directory);
  if (!files.includes("index.html"))
    throw new Error("dist/index.html fehlt. Bitte zuerst bauen.");
  files.sort((a, b) =>
    a === "index.html" ? 1 : b === "index.html" ? -1 : a.localeCompare(b),
  );
  for (const file of files) {
    const target = posix.join(remote, file);
    await sftp.mkdir(posix.dirname(target), true);
    const content = await readFile(join(directory, file));
    if (file === "index.html") {
      const temporary = posix.join(remote, ".algofights-index.next");
      await sftp.put(content, temporary);
      await sftp.posixRename(temporary, target);
    } else await sftp.put(content, target);
    console.log(`Hochgeladen: ${file}`);
  }
  console.log(`Deployment erfolgreich: ${files.length} Dateien.`);
} finally {
  await sftp.end();
}
