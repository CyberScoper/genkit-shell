#!/usr/bin/env node

///////////////////////////////////////////
// GENKIT-SHELL NODE-PTY VERSION
// with AI flows for !, ? commands, etc.
// Real Bash session + no double input
///////////////////////////////////////////

import { gemini15Flash, gemini15Pro, googleAI, gemini20Flash } from '@genkit-ai/googleai';
import { genkit } from 'genkit';
import dotenv from 'dotenv';
import readline from 'readline';
import os from 'os';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import pty from 'node-pty';

//////////////////////
// BASIC SETUP
//////////////////////

// ПЕРВАЯ СТРОКА: ШЕБАНГ (см. выше)

// Настройка .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Автозапуск в .bashrc
const bashrcPath = path.join(os.homedir(), '.bashrc');
const marker = '# >>> genkit-shell-autoload >>>';
if (existsSync(bashrcPath)) {
  const bashrcContent = readFileSync(bashrcPath, 'utf-8');
  if (!bashrcContent.includes(marker)) {
    console.log(chalk.cyan('\n🛠 It is detected that the autostart is not configured.'));
    const rlAuto = readline.createInterface({ input: process.stdin, output: process.stdout });
    rlAuto.question('Add genkit-shell to autorun on terminal login? (Y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        const block = `\n${marker}\nif [ -z \"$GENKIT_STARTED\" ]; then\n  export GENKIT_STARTED=1\n  genkit-shell\nfi\n# <<< genkit-shell-autoload <<<\n`;
        writeFileSync(bashrcPath, bashrcContent + block);
        console.log(chalk.green('✅ Autorun added to ~/.bashrc'));
      } else {
        console.log(chalk.yellow('⚠️ Autorun has not been added.'));
      }
      rlAuto.close();
    });
  }
}

//////////////////////
// AI CONFIG
//////////////////////

let LANGUAGE = 'EN';
const modelMap = {
  '1': gemini15Flash,
  '2': gemini15Pro,
  '3': gemini20Flash,
};

let selectedModel = gemini15Flash;
let ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
  model: selectedModel,
});

function setModel(model) {
  selectedModel = model;
  ai = genkit({
    plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
    model: selectedModel,
  });
}

function getLanguagePrefix() {
  switch (LANGUAGE) {
    case 'RU': return 'Отвечай на русском. ';
    case 'DE': return 'Antworte auf Deutsch. ';
    case 'FR': return 'Réponds en français. ';
    case 'ES': return 'Responde en español. ';
    case 'UA': return 'Відповідай українською. ';
    case 'ZH': return '请用中文回答。';
    case 'JA': return '日本語で答えてください。';
    default: return 'Respond in English. ';
  }
}

// AI Flows
let chatHistory = [];

const commandFlow = ai.defineFlow('commandFlow', async (instruction) => {
  const prompt = `${getLanguagePrefix()}Convert a user instruction into a CLI command. No explanations.\nInstruction: "${instruction}"`;
  const start = Date.now();
  const { text } = await ai.generate(prompt);
  return { command: text.trim(), duration: ((Date.now() - start) / 1000).toFixed(2) };
});

const suggestionFlow = ai.defineFlow('suggestionFlow', async (partial) => {
  const prompt = `${getLanguagePrefix()}Explain briefly what the command \"${partial}\" does, then suggest 3 typical ways to use it.`;
  const { text } = await ai.generate(prompt);
  return text;
});

const chatFlow = ai.defineFlow('chatFlow', async (input) => {
  chatHistory.push(`${LANGUAGE === 'RU' ? 'Пользователь' : 'User'}: ${input}`);
  const prompt = getLanguagePrefix() + chatHistory.join('\n') + `\n${LANGUAGE === 'RU' ? 'ИИ' : 'AI'}:`;
  const { text } = await ai.generate(prompt);
  chatHistory.push(`${LANGUAGE === 'RU' ? 'ИИ' : 'AI'}: ${text}`);
  if (chatHistory.length > 20) chatHistory.shift();
  return text;
});

/////////////////////////
// START node-pty (bash)
/////////////////////////

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
const ptyProcess = pty.spawn(shell, ['-i'], {
  name: 'xterm-color',
  cwd: process.cwd(),
  env: process.env,
  cols: 80,
  rows: 24,
});
ptyProcess.write('stty -echo\n');


// отключаем local echo, полагаемся на bash
process.stdin.setRawMode(true);
process.stdin.resume();
readline.emitKeypressEvents(process.stdin);

// Флаг для чата, чтобы команды не уходили в bash
let chatMode = false;

let inputBuffer = '';

/////////////////////////////////////////////////////
// Главная логика: перехватываем Enter, проверяем !,?
/////////////////////////////////////////////////////

process.stdin.on('keypress', async (str, key) => {
  // Ctrl+C
  if (key.sequence === '\u0003') {
    process.exit();
  }

  // ENTER
  if (key.name === 'return') {
    const line = inputBuffer.trim();
    inputBuffer = '';

    if (!chatMode) {
      // не в режиме чата, обрабатываем спецкоманды
      if (line === 'lang?') {
        ptyProcess.write('\n'); // чтобы показать новую строку
        process.stdout.write(chalk.magentaBright('\n🌐 Languages: RU, EN, DE, FR, ES, UA, ZH, JA\n'));
        const rlLang = readline.createInterface({ input: process.stdin, output: process.stdout });
        rlLang.question('Select a language: ', (lang) => {
          rlLang.close();
          const allowed = ['RU', 'EN', 'DE', 'FR', 'ES', 'UA', 'ZH', 'JA'];
          if (allowed.includes(lang.toUpperCase())) {
            LANGUAGE = lang.toUpperCase();
            process.stdout.write(chalk.green(`\n✅ Language switched to: ${LANGUAGE}\n`));
          } else {
            process.stdout.write(chalk.red('\n❌ Invalid language code.\n'));
          }
        });
      }
      else if (line === 'autostart-remove') {
        ptyProcess.write('\n');
        if (existsSync(bashrcPath)) {
          let content = readFileSync(bashrcPath, 'utf-8');
          if (content.includes(marker)) {
            const cleaned = content.replace(/\n?# >>> genkit-shell-autoload >>>[\s\S]*?# <<< genkit-shell-autoload <<</, '');
            writeFileSync(bashrcPath, cleaned);
            process.stdout.write(chalk.green('🧹 Autostart removed.\n'));
          } else {
            process.stdout.write(chalk.yellow('ℹ️ Autostart was not found.\n'));
          }
        }
      }
      else if (line === '?') {
        // Включаем чат-режим, чтобы пользовательские сообщения не летели в bash
        chatMode = true;
        ptyProcess.write('\n');
        process.stdout.write(chalk.cyan('\n🤖 Chat mode: type "exit" to exit.\n\n'));
      }
      else if (line === 'model?') {
        ptyProcess.write('\n');
        process.stdout.write(chalk.magentaBright('\n🔍 Available models:\n'));
        process.stdout.write('[1] gemini-1.5-flash\n');
        process.stdout.write('[2] gemini-1.5-pro\n');
        process.stdout.write('[3] gemini-2.0-flash\n');
        const rlModel = readline.createInterface({ input: process.stdin, output: process.stdout });
        rlModel.question('Select model [1-3]: ', (num) => {
          rlModel.close();
          if (modelMap[num]) {
            setModel(modelMap[num]);
            process.stdout.write(chalk.green('✅ Model switched to: ') + modelMap[num].name + '\n');
          } else {
            process.stdout.write(chalk.red('❌ Invalid selection.\n'));
          }
        });
      }
      else if (line.endsWith('?') && line.length > 1) {
        const cmd = line.slice(0, -1);
        ptyProcess.write('\n');
        try {
          const response = await suggestionFlow(cmd);
          process.stdout.write(chalk.yellow(`\n🤖 Info: `) + cmd + '\n');
          process.stdout.write(response + '\n');
        } catch (err) {
          process.stdout.write(chalk.red('⚠️ Could not get info: ') + err.message + '\n');
        }
      }
      else if (line.startsWith('!')) {
        // AI -> command
        ptyProcess.write('\n');
        process.stdout.write(chalk.yellow('🧠 Thinking...\r'));
        try {
          const userRequest = line.slice(1);
          const { command, duration } = await commandFlow(userRequest);
          process.stdout.write('\x1b[2J\x1b[0f'); // clear screen
          process.stdout.write(chalk.magenta('📎 Command: ') + chalk.white.bold(command) + '\n');
          process.stdout.write(chalk.blueBright('⚡ Response time: ') + chalk.yellow(`${duration} sec\n\n`));
          // ask to execute
          const rlExec = readline.createInterface({ input: process.stdin, output: process.stdout });
          rlExec.question(chalk.cyan.bold('Execute? (Y/N): '), (answer) => {
            rlExec.close();
            if (answer.toLowerCase() === 'y') {
              ptyProcess.write(command + '\n');
            } else {
              process.stdout.write(chalk.red.bold('❌ Cancelled.\n'));
            }
          });
        } catch (err) {
          process.stdout.write(chalk.red.bold('❌ AI Error: ') + err.message + '\n');
        }
      }
      else {
        // Обычная команда -> bash
        ptyProcess.write(line + '\n');
      }
    }
    else {
      // chatMode = true
      if (line.toLowerCase() === 'exit') {
        chatMode = false;
        process.stdout.write(chalk.green('🤖 Chat ended.\n'));
      } else if (line) {
        // отправляем вопрос в AI
        const response = await chatFlow(line);
        process.stdout.write(chalk.blueBright('🤖 AI: ') + response + '\n');
      }
    }

  }
  else if (key.name === 'backspace') {
    if (inputBuffer.length > 0) {
      inputBuffer = inputBuffer.slice(0, -1);
      process.stdout.write('\b \b');
    }
  }
  else {
    // не выводим вручную - let Bash echo
    // но pty сейчас настроен на echo? => Надо raw mode
    // однако, если pty echo, то дважды выйдет
    // проще: отключим echo в ptyProcess? node-pty не имеет direct
    // Для простоты, оставим: user wants single echo
    if (!chatMode) {
      // Печатаем локально, чтоб пользователь видел
      if (str) {
        inputBuffer += str;
        process.stdout.write(str);
      }
    } else {
      // В режиме чата - тоже печатаем
      if (str) {
        inputBuffer += str;
        process.stdout.write(str);
      }
    }
  }
});

// Любой вывод bash -> stdout
ptyProcess.onData((data) => {
  process.stdout.write(data);
});

process.stdout.write(chalk.yellow.bold('\n🤖 Genkit Shell + node-pty started!\n'));
process.stdout.write(chalk.gray('Use !<cmd>, ?, model?, lang?, autostart-remove, etc.\n'));
