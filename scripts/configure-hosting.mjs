/** Administrative helper. Credentials arrive only on hidden stdin, never in source or argv. */
import SftpClient from "ssh2-sftp-client";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sodium from "libsodium-wrappers";

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write(
  "Bereit für Hosting-Konfiguration auf verborgenem stdin.\n",
);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  input += chunk;
  if (!/[\r\n]/.test(input)) return;
  process.stdin.pause();
  let sftp;
  try {
    const config = JSON.parse(input.trim());
    input = "";
    if (config.action === "github-status") {
      const token = githubToken();
      const runs = await github(token, "/actions/runs?per_page=3");
      console.log(
        JSON.stringify(
          runs.workflow_runs.map((r) => ({
            id: r.id,
            status: r.status,
            conclusion: r.conclusion,
            url: r.html_url,
            sha: r.head_sha,
          })),
        ),
      );
      if (config.runId) {
        const jobs = await github(
          token,
          `/actions/runs/${Number(config.runId)}/jobs`,
        );
        console.log(
          JSON.stringify(
            jobs.jobs.map((j) => ({
              name: j.name,
              status: j.status,
              conclusion: j.conclusion,
              steps: j.steps,
            })),
          ),
        );
      }
      process.exit(0);
    }
    let fingerprint;
    sftp = new SftpClient();
    await sftp.connect({
      host: config.host,
      username: config.user,
      password: config.password,
      port: config.port || 22,
      readyTimeout: 15000,
      hostVerifier: (key) => {
        fingerprint =
          "SHA256:" +
          createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
        return !config.fingerprint || fingerprint === config.fingerprint;
      },
    });
    const cwd = await sftp.cwd();
    console.log(JSON.stringify({ cwd, fingerprint }));
    if (config.action === "inspect") {
      for (const path of config.paths || ["."]) {
        try {
          console.log(
            JSON.stringify({
              path,
              files: (await sftp.list(path)).map((f) => ({
                name: f.name,
                type: f.type,
                size: f.size,
              })),
            }),
          );
        } catch (e) {
          console.log(
            JSON.stringify({ path, error: e.code || "Nicht zugänglich" }),
          );
        }
      }
    } else if (config.action === "configure") {
      if (!config.path || config.path === "/")
        throw new Error("Expliziter Webroot benötigt.");
      const target = config.path.startsWith("/")
        ? config.path
        : `${cwd}/${config.path}`;
      const existing = await sftp.exists(target);
      if (!existing) await sftp.mkdir(target, true);
      else if (existing !== "d") throw new Error("Ziel ist kein Verzeichnis.");
      const token = githubToken();
      const me = await github(token, "", { user: true });
      if (me.login !== "sh11n3")
        throw new Error(
          "Authentifizierter GitHub-Account stimmt nicht überein.",
        );
      const key = await github(token, "/actions/secrets/public-key");
      await sodium.ready;
      for (const [name, value] of Object.entries({
        SFTP_HOST: config.host,
        SFTP_PORT: String(config.port || 22),
        SFTP_USER: config.user,
        SFTP_PASSWORD: config.password,
        SFTP_PATH: target,
        SFTP_FINGERPRINT: fingerprint,
      })) {
        const encrypted_value = sodium.to_base64(
          sodium.crypto_box_seal(
            sodium.from_string(value),
            sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL),
          ),
          sodium.base64_variants.ORIGINAL,
        );
        await github(token, `/actions/secrets/${name}`, {
          method: "PUT",
          body: { encrypted_value, key_id: key.key_id },
        });
        console.log(`GitHub-Secret eingerichtet: ${name}`);
      }
      console.log(
        "Deployment-Secrets im Account sh11n3 erfolgreich eingerichtet.",
      );
    } else if (config.action === "deploy") {
      await sftp.end();
      sftp = null;
      Object.assign(process.env, {
        SFTP_HOST: config.host,
        SFTP_PORT: String(config.port || 22),
        SFTP_USER: config.user,
        SFTP_PASSWORD: config.password,
        SFTP_PATH: config.path,
        SFTP_FINGERPRINT: config.fingerprint || fingerprint,
      });
      await import("./deploy.mjs");
    }
    process.exitCode = 0;
  } catch (e) {
    console.error("Konfiguration fehlgeschlagen:", e.message);
    process.exitCode = 1;
  } finally {
    if (sftp) await sftp.end();
    process.exit(process.exitCode || 0);
  }
});
function githubToken() {
  const credential = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const token = credential
    .split("\n")
    .find((line) => line.startsWith("password="))
    ?.slice(9);
  if (!token)
    throw new Error(
      "Keine lokale GitHub-Anmeldung für die Secrets-Konfiguration vorhanden.",
    );
  return token;
}
async function github(token, path, options = {}) {
  const response = await fetch(
    options.user
      ? "https://api.github.com/user"
      : `https://api.github.com/repos/sh11n3/AlgoFights${path}`,
    {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  );
  if (!response.ok)
    throw new Error(`GitHub ${response.status} bei ${path || "/user"}`);
  return response.status === 204 ? null : response.json();
}
