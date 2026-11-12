/** Replaces each file after upload; index.html switches to the new build last. */
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
    try {
      await sftp.put(content, temporary);
      await sftp.chmod(temporary, mode);
      await sftp.posixRename(temporary, target);
    } catch (error) {
      await sftp.delete(temporary, true).catch(() => {});
      throw error;
    }
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
    const guardedFile = ".htpasswd-algofights";
    const guardedPath = posix.join(webroot, guardedFile);
    const guardedConfig = (path) => Buffer.from(`${baseConfig}
AuthType Basic
AuthName "AlgoFights"
AuthBasicProvider file
AuthUserFile "${path}"
Require valid-user

<FilesMatch "^\\.+htpasswd-algofights(?:\\.next)?$">
  AuthType None
  Require all denied
</FilesMatch>

<IfModule mod_headers.c>
  Header always set Cache-Control "private, no-store"
</IfModule>
`);
    const passwordContent = Buffer.from(`${passwordEntry}\n`);
    const probe = async (path = "/", credentials = false) => {
      const headers = credentials
        ? { Authorization: `Basic ${Buffer.from(`${passwordEntry.split(":")[0]}:invalid-access-probe`).toString("base64")}` }
        : undefined;
      const response = await fetch(new URL(path, "https://algofights.de/"), {
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      await response.body?.cancel();
      return response;
    };
    const install = async (passwordPath) => {
      await replaceFile(accessConfig, guardedConfig(passwordPath));
      const response = await probe("/", true);
      return response.status === 401 && /^Basic\b/i.test(response.headers.get("www-authenticate") ?? "");
    };
    const previousGuarded = (await sftp.exists(guardedPath)) === "-"
      ? await sftp.get(guardedPath) : null;
    let wroteGuarded = false;
    try {
      await replaceFile(sftpPasswordPath, passwordContent);
      let active = await install(serverPasswordPath);
      if (!active) {
        for (const path of [guardedFile, `.${guardedFile}.next`]) {
          if ((await probe(`/${path}`)).status !== 403)
            throw new Error("Der Webserver blockiert die Passwortdatei nicht zuverlässig.");
        }
        wroteGuarded = true;
        await replaceFile(guardedPath, passwordContent);
        // Hetzner exposes the web files to Apache under its separate web directory.
        const webDirectory = `/usr/www/users/${process.env.SFTP_USER}`;
        for (const candidate of [webDirectory, `${webDirectory}${webroot}`, serverWebroot]) {
          active = await install(posix.join(candidate, guardedFile));
          if (active) break;
        }
      }
      if (!active || (await probe()).status !== 401)
        throw new Error("Der Passwortschutz konnte auf algofights.de nicht verifiziert werden.");
      console.log("Passwortschutz aktiv (HTTP 401 ohne gültige Anmeldung).");
    } catch (error) {
      if (wroteGuarded) {
        if (previousGuarded) await replaceFile(guardedPath, previousGuarded);
        else if (await sftp.exists(guardedPath)) await sftp.delete(guardedPath);
      }
      if (previousPassword)
        await replaceFile(sftpPasswordPath, previousPassword);
      else if (await sftp.exists(sftpPasswordPath)) await sftp.delete(sftpPasswordPath);
      if (previousConfig) await replaceFile(accessConfig, previousConfig);
      else if (await sftp.exists(accessConfig)) await sftp.delete(accessConfig);
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
    // A previous build may still reference the same asset while this one uploads.
    await replaceFile(target, content);
    console.log(`Hochgeladen: ${file}`);
  }
  console.log(`Deployment erfolgreich: ${files.length} Dateien.`);
} finally {
  await sftp.end();
}
