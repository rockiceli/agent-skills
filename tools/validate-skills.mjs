#!/usr/bin/env node
/**
 * validate-skills.mjs — 仓库自检 + CI 闸门。
 *
 * 检查项：
 *  1. skills/ 下每个目录都有 SKILL.md
 *  2. SKILL.md 有 frontmatter，且 name / description 非空
 *  3. name 是 kebab-case、与目录名一致
 *  4. name 全库唯一
 *  5. description 长度在 10..512 之间（Agent 路由靠它）
 *  6. 无密钥/邮箱/本机绝对路径泄漏
 *  7. README.md 的技能表条数 == skills 目录数
 *
 * 退出码：0 = 全通过；1 = 有问题。逐行打印 PASS/FAIL。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(REPO, 'skills');

const LEAK_PATTERNS = [
  [/\d{6,}@qq\.com/g, 'QQ 邮箱'],
  // 只抓"看起来是真值"的写法：一串字母数字且不含 xxxxxx 这种占位串。示例占位（ma_live_xxxx…）不算泄漏。
  [/MEOWART_API_KEY\s*=\s*["']?(?![A-Za-z0-9_-]*x{6})[A-Za-z0-9_-]{12,}/g, 'Meowa API key'],
  [/\bsk-[A-Za-z0-9]{16,}/g, 'sk- 密钥'],
  [/\bghp_[A-Za-z0-9]{20,}/g, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, '私钥'],
  [/[A-Za-z]:\\\\?Users\\\\?Administrator/g, '本机用户路径'],
  [/[A-Za-z]:[\\/]Tools[\\/]skills/g, '本机技能库路径'],
];

const rows = [];
const fail = (msg) => rows.push(['FAIL', msg]);
const pass = (msg) => rows.push(['PASS', msg]);

function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    fm[kv[1]] = v;
  }
  return fm;
}

function walkFiles(dir, base = dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(abs, base, out);
    else if (ent.isFile()) out.push(abs);
  }
  return out;
}

// ---- 1..5 逐个技能
if (!fs.existsSync(SKILLS)) {
  fail('skills/ 目录不存在');
} else {
  const dirs = fs.readdirSync(SKILLS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (dirs.length === 0) fail('skills/ 为空');

  const seen = new Map();
  for (const dirName of dirs.sort()) {
    const skillMd = path.join(SKILLS, dirName, 'SKILL.md');
    if (!fs.existsSync(skillMd)) { fail(`${dirName}: 缺 SKILL.md`); continue; }

    const fm = readFrontmatter(skillMd);
    if (!fm) { fail(`${dirName}: SKILL.md 无 frontmatter`); continue; }

    const name = fm.name || '';
    const desc = fm.description || '';

    if (!name) fail(`${dirName}: frontmatter 缺 name`);
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(`${dirName}: name 不是 kebab-case → ${name}`);
    else if (name !== dirName) fail(`${dirName}: name(${name}) 与目录名不一致`);
    else pass(`${name}: name ok`);

    if (seen.has(name)) fail(`${name}: name 重复（${seen.get(name)} / ${dirName}）`);
    seen.set(name, dirName);

    if (!desc) fail(`${dirName}: 缺 description`);
    else if (desc.length < 10) fail(`${dirName}: description 太短（${desc.length}）`);
    else if (desc.length > 512) fail(`${dirName}: description 太长（${desc.length} > 512，吃上下文）`);
    else pass(`${name}: description ${desc.length} 字符`);
  }

  // ---- 6 泄漏扫描
  let leaks = 0;
  for (const f of walkFiles(SKILLS)) {
    if (!/\.(md|txt|json|ya?ml|mjs|js|py|ps1|sh|ts|css|html|toml|ini|csv)$/i.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const [re, label] of LEAK_PATTERNS) {
      const hits = text.match(re);
      if (hits) {
        leaks += hits.length;
        fail(`泄漏 ${label} × ${hits.length} → ${path.relative(REPO, f)}`);
      }
    }
  }
  if (leaks === 0) pass('无密钥/邮箱/本机路径泄漏');

  // ---- 7 README 表格条数
  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  const linked = [...readme.matchAll(/\]\(skills\/([a-z0-9-]+)\)/g)].map((m) => m[1]);
  if (linked.length !== dirs.length) fail(`README 技能表 ${linked.length} 条 ≠ skills 目录 ${dirs.length} 个`);
  else pass(`README 技能表 ${linked.length} 条，与目录一致`);
  for (const name of linked) if (!dirs.includes(name)) fail(`README 指向不存在的技能: ${name}`);
}

// ---- 输出
const width = rows.reduce((a, [s]) => Math.max(a, s.length), 4);
for (const [status, msg] of rows) console.log(`${status.padEnd(width)}  ${msg}`);
const failures = rows.filter(([s]) => s === 'FAIL').length;
console.log(`\n${rows.length - failures} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);