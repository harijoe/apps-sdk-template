# Piano Widget - Skybridge Demo

This project demonstrates an interactive piano widget built with Skybridge, allowing users to play, record, and save musical compositions directly within ChatGPT conversations.

![Demo](docs/demo.gif)

## What This Project Provides

### Interactive Piano Widget

The piano widget is a fully functional musical instrument that runs inside ChatGPT. Users can:

- **Play Notes**: Use the on-screen keyboard or computer keyboard to play piano notes (A3 to D5 range)
- **Record Performances**: Start recording to capture a sequence of notes with precise timing
- **Save Songs**: Give recorded performances a name and save them for later playback
- **Playback Saved Songs**: Replay previously recorded songs with accurate timing
- **Manage Library**: View all saved songs with their duration and creation date, and delete songs you no longer need

The piano widget features:

- Real-time audio playback using Soundfont instruments
- Precise timing capture for accurate song replay
- Persistent storage of saved songs across sessions
- Bilingual support (English/French) with automatic locale detection
- Responsive design that adapts to different screen sizes

## Skybridge Features Showcased

This project demonstrates several key features of the Skybridge framework:

### 1. **Widget Registration** (`server.widget()`)

The piano widget is registered as an MCP tool using `server.widget()`, making it available to ChatGPT as an interactive tool that can be invoked during conversations.

### 2. **Widget Mounting** (`mountWidget`)

The React component is mounted using `mountWidget()` from `skybridge/web`, which handles the integration between the React application and ChatGPT's iframe environment.

### 3. **Internationalization** (`useLocale`)

The widget uses `useLocale()` hook to automatically detect and adapt to the user's language preference, displaying UI text in English or French based on ChatGPT's locale settings.

### 4. **Persistent State Management** (`createStore`)

The widget uses `createStore()` to implement persistent storage for saved songs. This demonstrates how to maintain state across widget instances and conversations, allowing users to build up a library of recorded songs that persists over time.

### 5. **Development Experience**

- **Vite Integration**: Uses Skybridge's Vite plugin for hot module replacement during development
- **TypeScript Support**: Full type safety throughout the application
- **HMR**: Changes to React components are reflected instantly in ChatGPT without reconnecting

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc` for exact version)
- pnpm (install with `npm install -g pnpm`)
- Ngrok

### Local Development with Hot Module Replacement (HMR)

#### 1. Clone and Install

```bash
git clone <repository-url>
cd apps-sdk-template
pnpm install
```

#### 2. Start the Development Server

Run the development server from the root directory:

```bash
pnpm dev
```

This command starts an express server on port 3000. This server packages:

- an MCP endpoint on `/mcp` - aka as the ChatGPT App Backend
- a React application on Vite HMR dev server - aka as the ChatGPT App Frontend

#### 3. Expose Your Local Server

In a separate terminal, expose your local server using ngrok:

```bash
ngrok http 3000
```

Copy the forwarding URL from ngrok output:

```bash
Forwarding     https://3785c5ddc4b6.ngrok-free.app -> http://localhost:3000
```

#### 4. Connect to ChatGPT

- Toggle **Settings → Connectors → Advanced → Developer mode** in the ChatGPT client
- Navigate to **Settings → Connectors → Create**
- Enter your ngrok URL with the `/mcp` path (e.g., `https://3785c5ddc4b6.ngrok-free.app/mcp`)
- Click **Create**

#### 5. Test Your Integration

- Start a new conversation in ChatGPT
- Select your newly created connector using **+ → Plus → Your connector**
- Try prompting the model (e.g., "Show me the piano widget")

#### 6. Develop with HMR

Now you can edit React components in `web` and see changes instantly:

- Make changes to any component
- Save the file
- The widget will automatically update in ChatGPT without refreshing or reconnecting
- The Express server and MCP server continue running without interruption

**Note:** When you modify widget components, changes will reflect immediately. If you modify MCP server code (in `src/`), you may need to reload your connector in **Settings → Connectors → [Your connector] → Reload**.

## Widget Naming Convention

**Important:** For a widget to work properly, the name of the endpoint in your MCP server must match the file name of the corresponding React component in `web/src/widgets/`.

For example:

- If you create a widget endpoint named `piano`, you must create a corresponding React component file at `web/src/widgets/piano.tsx`
- The endpoint name and the widget file name (without the `.tsx` extension) must be identical

This naming convention allows the system to automatically map widget requests to their corresponding React components.

## Deploy to Production

Use Alpic to deploy your OpenAI App to production.

[![Deploy on Alpic](https://assets.alpic.ai/button.svg)](https://app.alpic.ai/new/clone?repositoryUrl=https%3A%2F%2Fgithub.com%2Falpic-ai%2Fapps-sdk-template)

- In ChatGPT, navigate to **Settings → Connectors → Create** and add your MCP server URL (e.g., `https://your-app-name.alpic.live`)

## Project Structure

```
.
├── server/
│   ├── src/
│   │   ├── server.ts       # MCP server with widget registration
│   │   └── index.ts        # Express server definition
└── web/
    └── src/
        └── widgets/
            └── piano.tsx   # Piano widget React component
```

## Resources

- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Alpic Documentation](https://docs.alpic.ai/)
