# Genkit Shell

**AI-powered terminal interface using Genkit + Gemini + node-pty**

A CLI tool that brings AI assistance directly into your terminal.
Built with Genkit, Google Gemini, and a real bash session using `node-pty`.

![log](https://github.com/user-attachments/assets/e4cf6af1-f554-4be3-bddc-44a55b667c5a)

---

## 🚀 Features

- `!<your command>` → Converts natural language into real shell commands via AI.
- `?` → Starts an interactive AI chat session.
- `model?` → Switch between different Gemini AI models.
- `lang?` → Choose AI communication language (EN, RU, DE, FR, ES, UA, ZH, JA).
- `autostart-remove` → Removes Genkit Shell from auto-start in `.bashrc`.
- Full bash environment using `node-pty`, not emulated.

---

## 🛠 Installation

```bash
npm install -g genkit-shell
```

Or run via `npx` (without installing globally):

```bash
npx genkit-shell
```

---

## 🧪 Usage

Start the shell:
```bash
genkit-shell
```

Then you can use:

### AI Commands
```bash
!create a folder called logs and move all .txt files into it
```

### Ask about commands
```bash
ping?
```

### Switch AI Model
```bash
model?
```

### Change Language
```bash
lang?
```

### Start Chat Mode
```bash
?
```
Exit with `exit`.

---

## 🔐 Environment Variables

Create a `.env` file in your project root:

```
GOOGLE_API_KEY=your_google_genai_api_key_here
```

You can get your key from [Google AI Studio](https://makersuite.google.com/).

---

## 💬 Author
Made by [CyberScoper](https://github.com/CyberScoper)

---

