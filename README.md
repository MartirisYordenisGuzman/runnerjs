# RunnerJS Clone 🚀

A premium, interactive scratchpad for JavaScript and TypeScript, designed for speed, beauty, and intelligent coding assistance.

![RunnerJS Interface](public/logo.png)

## ✨ Features

- **Real-time Execution**: Instant feedback as you type, with a secure sandboxed environment.
- **AI-Powered Assistance**: Integrated AI Chat (OpenAI & Gemini) to explain code, debug errors, and generate suggestions.
- **Match Lines**: Visual alignment between console logs and the corresponding source code lines.
- **Expression Results**: Automatically capture and display the results of every expression in your code.
- **Premium Themes**: Support for dozens of VSCode-compatible themes, including professional dark and light modes.
- **Vim Mode**: Full Vim keybindings support for power users.
- **NPM Integration**: Install and use any NPM package directly in your scratchpad.
- **Snippet Management**: Organize and reuse your favorite code blocks with a dedicated library.

## 🛠️ Technology Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) (The engine behind VSCode)
- **Runtime**: [Electron 41](https://www.electronjs.org/)
- **Transformation**: [Babel](https://babeljs.io/) & [Sucrase](https://sucrase.io/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Development

To start the development environment:

```bash
npm run dev
```

### Distribution

To generate a portable Windows executable (.exe):

```bash
npm.cmd run dist
```

The executable will be generated in the `release/` folder.

## ⌨️ Keyboard Shortcuts

- **Ctrl + R**: Run code
- **Ctrl + Shift + R**: Stop execution
- **Ctrl + ,**: Open Settings
- **Ctrl + \**: Toggle Sidebar
- **Ctrl + J**: Toggle Output Panel
- **Ctrl + B**: Open Snippets
- **Ctrl + I**: Open NPM Packages
- **Alt + Shift + F**: Format Code

## 📄 License

This project is specialized for private use and experimentation.

---
Built with ❤️ for the JavaScript community.
