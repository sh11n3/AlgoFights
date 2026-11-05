/** Uploads the static build without deleting remote content; index.html is uploaded last. */
import SftpClient from "ssh2-sftp-client";
import { access, readdir, readFile } from "node:fs/promises";
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
const passwordEntry = process.env.SITE_HTPASSWD?.trim();
if (process.env.SITE_ACCESS_REQUIRED === "true" && !passwordEntry)
  throw new Error("Das Secret SITE_HTPASSWD für den Passwortschutz fehlt.");
if (
  passwordEntry &&
  !/^[a-zA-Z0-9_-]+:\$2y\$\d{2}\$[./a-zA-Z0-9]{53}$/.test(passwordEntry)
)
  throw new Error(
    "SITE_HTPASSWD muss einen einzelnen bcrypt-htpasswd-Eintrag enthalten.",
  );
const directory = resolve("dist");
await access(join(directory, "index.html"));
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
  async function replaceFile(target, content, mode = 0o644) {
    const temporary = posix.join(
      posix.dirname(target),
      `.${posix.basename(target)}.next`,
    );
    await sftp.put(content, temporary);
    await sftp.chmod(temporary, mode);
    await sftp.posixRename(temporary, target);
  }

  const accessConfig = posix.join(remote, ".htaccess");
  const previousConfig =
    (await sftp.exists(accessConfig)) === "-"
      ? await sftp.get(accessConfig)
      : null;
  if (passwordEntry) {
    const webroot = await sftp.realPath(remote);
    const home = `/usr/home/${process.env.SFTP_USER}`;
    const serverWebroot = webroot.startsWith("/usr/home/")
      ? webroot
      : `${home}${webroot}`;
    if (
      !/^[\w/.-]+$/.test(serverWebroot) ||
      !serverWebroot.startsWith(`${home}/`)
    )
      throw new Error("Der Apache-Pfad für den Passwortschutz ist ungültig.");
    const passwordFile = ".algofights.htpasswd";
    const sftpPasswordPath = posix.join(posix.dirname(webroot), passwordFile);
    const serverPasswordPath = posix.join(
      posix.dirname(serverWebroot),
      passwordFile,
    );
    const previousPassword =
      (await sftp.exists(sftpPasswordPath)) === "-"
        ? await sftp.get(sftpPasswordPath)
        : null;
    const baseConfig = await readFile(join(directory, ".htaccess"), "utf8");
    const authentication = `
AuthType Basic
AuthName "AlgoFights"
AuthBasicProvider file
AuthUserFile "${serverPasswordPath}"
Require valid-user

<IfModule mod_headers.c>
  Header always set Cache-Control "private, no-store"
</IfModule>
`;
    await replaceFile(sftpPasswordPath, Buffer.from(`${passwordEntry}\n`));
    try {
      await replaceFile(accessConfig, Buffer.from(baseConfig + authentication));
      const response = await fetch("https://algofights.de/", {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (
        response.status !== 401 ||
        !response.headers.get("www-authenticate")?.startsWith("Basic ")
      )
        throw new Error(
          `Passwortschutz antwortet unerwartet mit HTTP ${response.status}.`,
        );
      await response.body?.cancel();
      console.log("Passwortschutz aktiv (HTTP 401 ohne Anmeldung).");
    } catch (error) {
      if (previousConfig) await replaceFile(accessConfig, previousConfig);
      else if (await sftp.exists(accessConfig)) await sftp.delete(accessConfig);
      if (previousPassword)
        await replaceFile(sftpPasswordPath, previousPassword);
      else await sftp.delete(sftpPasswordPath);
      throw error;
    }
  }
  const files = [];
  async function walk(local, relative = "") {
    for (const entry of await readdir(local, { withFileTypes: true })) {
      const subpath = posix.join(relative, entry.name);
      if (entry.isDirectory()) await walk(join(local, entry.name), subpath);
      else if (entry.isFile()) files.push(subpath);
    }
  }
  await walk(directory);
  files.sort((a, b) =>
    a === "index.html" ? 1 : b === "index.html" ? -1 : a.localeCompare(b),
  );
  for (const file of files) {
    if (
      file === ".htaccess" &&
      (passwordEntry ||
        /^\s*AuthType\b/im.test(previousConfig?.toString() ?? ""))
    )
      continue;
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
