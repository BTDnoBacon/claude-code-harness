import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Message,
} from "discord.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const HARNESS_DIR = __dirname;
const ALLOWED_CHANNEL = process.env.DISCORD_CHANNEL_ID ?? "";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ── helpers ───────────────────────────────────────────────────────────────────

function stateDir(project: string) {
  return path.join(HARNESS_DIR, "projects", project, ".state");
}

function projectExists(project: string): boolean {
  return fs.existsSync(path.join(HARNESS_DIR, "projects", project));
}

function readTasksFile(project: string): string | null {
  const p = path.join(stateDir(project), "tasks.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function truncate(text: string, limit = 1800): string {
  return text.length > limit ? text.slice(0, limit) + "\n…(truncated)" : text;
}

// Runs `claude --print <prompt>` in HARNESS_DIR and returns when the process exits.
function runClaude(prompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["--print", prompt], {
      cwd: HARNESS_DIR,
      env: process.env,
    });

    proc.stdout.on("data", (chunk: Buffer) =>
      process.stdout.write(`[claude] ${chunk}`)
    );
    proc.stderr.on("data", (chunk: Buffer) =>
      process.stderr.write(`[claude:err] ${chunk}`)
    );
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`claude exited ${code}`))
    );
  });
}

// ── command handlers ──────────────────────────────────────────────────────────

const HELP = `
**Claude Harness Bot — 명령어**

\`!status <project>\`  — tasks.md 현재 상태 조회
\`!run <project> <TASK-XXX>\`  — 태스크 개발+리뷰 사이클 실행
\`!plan <project> <requirement>\`  — Planner 실행, tasks.md 생성
\`!help\`  — 이 메시지
`.trim();

async function handleStatus(msg: Message, args: string[]): Promise<void> {
  const [project] = args;
  if (!project) { await msg.reply("사용법: `!status <project>`"); return; }
  if (!projectExists(project)) { await msg.reply(`❌ 프로젝트 \`${project}\` 없음`); return; }

  const tasks = readTasksFile(project);
  if (!tasks) { await msg.reply(`❌ \`${project}/.state/tasks.md\` 없음`); return; }

  await msg.reply(
    `**${project} — tasks.md**\n\`\`\`markdown\n${truncate(tasks)}\n\`\`\``
  );
}

async function handleRun(msg: Message, args: string[]): Promise<void> {
  const [project, taskId] = args;
  if (!project || !taskId) { await msg.reply("사용법: `!run <project> <TASK-XXX>`"); return; }
  if (!projectExists(project)) { await msg.reply(`❌ 프로젝트 \`${project}\` 없음`); return; }

  const prompt =
    `Project: ${project}. ` +
    `Implement ${taskId} following CLAUDE.md orchestration: ` +
    `run Developer agent then Reviewer agent, update task status to [done] if approved, commit, call notify.sh.`;

  const status = await msg.reply(`🔄 **${taskId}** 시작 중... (완료되면 알림 옵니다)`);

  try {
    await runClaude(prompt);
    await status.edit(`✅ **${taskId}** 세션 종료 — Discord 알림 확인하세요`);
  } catch (err) {
    await status.edit(`❌ **${taskId}** 실패: ${(err as Error).message}`);
  }
}

async function handlePlan(msg: Message, args: string[]): Promise<void> {
  const [project, ...reqParts] = args;
  if (!project || reqParts.length === 0) {
    await msg.reply("사용법: `!plan <project> <requirement>`");
    return;
  }

  const requirement = reqParts.join(" ");
  fs.mkdirSync(stateDir(project), { recursive: true });

  const prompt =
    `Project: ${project}. ` +
    `Run the Planner agent with this requirement: "${requirement}". ` +
    `Write tasks.md to projects/${project}/.state/tasks.md.`;

  const status = await msg.reply(`📋 **${project}** Planner 실행 중...`);

  try {
    await runClaude(prompt);
    const tasks = readTasksFile(project) ?? "(tasks.md 읽기 실패)";
    await status.edit(
      `✅ **${project}** tasks.md 생성\n\`\`\`markdown\n${truncate(tasks, 1200)}\n\`\`\``
    );
  } catch (err) {
    await status.edit(`❌ Planner 실패: ${(err as Error).message}`);
  }
}

// ── event handlers ────────────────────────────────────────────────────────────

client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user?.tag}`);
  console.log(`   Channel filter: ${ALLOWED_CHANNEL || "none (all channels)"}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (ALLOWED_CHANNEL && msg.channelId !== ALLOWED_CHANNEL) return;
  if (!msg.content.startsWith("!")) return;

  const [rawCmd, ...args] = msg.content.slice(1).trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();

  try {
    if (cmd === "status") return void (await handleStatus(msg, args));
    if (cmd === "run")    return void (await handleRun(msg, args));
    if (cmd === "plan")   return void (await handlePlan(msg, args));
    if (cmd === "help")   return void (await msg.reply(HELP));
    await msg.reply(`모르는 명령어: \`!${cmd}\` — \`!help\` 참고`);
  } catch (err) {
    console.error(err);
    await msg.reply(`⚠️ 오류: ${(err as Error).message}`);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
