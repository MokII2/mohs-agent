# Mohs-agent

AI Agent Framework — Multi-agent orchestrator with self-evolution and five-layer memory architecture.

## Overview

Mohs-agent is a comprehensive AI agent framework that integrates core capabilities from multiple open-source projects:

- **Central Orchestrator** — Multi-agent coordination hub for task routing and execution
- **Subagent Router** — Intelligent routing with context isolation (from Superpowers)
- **Self-Evolution Engine** — Continuous improvement through reflection and learning (from Hermes)
- **Five-Layer Memory** — Hierarchical memory system with ChromaDB persistence (from memory-context)
- **DreamProcessor** — Night-time synthesis and skill generation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Central Orchestrator                          │
│              (Multi-Agent Coordination Hub)                     │
└───────────────────────┬─────────────────────┬───────────────────┘
                        │                     │
        ┌───────────────┴───────┐    ┌───────┴────────┐
        │    Subagent Router    │    │   Evolution    │
        │  (Context Isolation)  │    │    Engine      │
        └──────────────────────┘    └───────┬────────┘
                                            │
┌───────────────────────────────────────────┴─────────────────────────┐
│                        Five-Layer Memory                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐  │
│  │Sensory  │ │ Working │ │Semantic │ │ Episodic │ │ Experience │  │
│  │(183 days)│ │(20 msgs)│ │(ChromaDB)│ │(12 months)│ │(500 entries)│  │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Core Agent System
- **Central Orchestrator** — Task scheduling, agent coordination, message routing
- **Base Agent** — Extensible agent implementation with capability management
- **Execution Context** — Session-aware execution with memory integration

### Self-Evolution
- **Evolution Engine** — Continuous skill improvement through reflection
- **DreamProcessor** — Periodic synthesis of experiences into new capabilities
- **Experience Tracking** — Success/failure recording with lesson extraction

### Five-Layer Memory Architecture
| Layer | Purpose | Retention | Storage |
|-------|---------|-----------|---------|
| Sensory | Raw conversation input | 183 days | Memory |
| Working | Current task context | 20 messages / 7 days | Memory |
| Semantic | Compressed knowledge | Persistent | ChromaDB |
| Episodic | Monthly conversation archives | 12 months | Memory |
| Experience | Trial/error outcomes | 500 entries / 90 days | Memory |

### Multi-Provider LLM Support
Integrated providers for flexible model selection:

- **MiniMax** — MiniMax Chat API
- **Qwen** — Alibaba Qwen API
- **Kimi** — Moonshot AI
- **GLM** — Zhipu AI
- **Claude** — Anthropic API
- **GPT** — OpenAI API
- **Gemini** — Google AI API
- **Ollama** — Local LLM support
- **DeepSeek** — DeepSeek API

### Multi-Channel Messaging
Connect to multiple communication platforms simultaneously:

- Telegram, Discord, WhatsApp, Slack
- WeChat, WebChat, Feishu, MS Teams
- iMessage (BlueBubbles)

### Plugin System
Extensible plugin architecture with:
- Plugin manifest validation
- Hook registration (`beforeAgentStart`, `afterAgentEnd`, `beforeToolCall`, etc.)
- Channel and tool integration points

### Skill System
Markdown-based skill definitions with:
- Frontmatter metadata (name, description, prerequisites)
- Structured content sections
- Semantic search and matching
- Dynamic skill generation from experiences

### Session Management
- Session lifecycle (created, updated, deleted, activated, idle, completed)
- Transcript recording and replay
- Session key resolution (simple, composite, workspace-aware)
- Metadata and context preservation

### Security
- **Security Audit** — Action logging and reporting
- **Filesystem Permissions** — Path-based access control
- **DM Policy Resolution** — Direct message handling policies
- **Secrets Management** — env/file/exec secret sources with audit trail

### Gateway Protocol
WebSocket-based control plane for remote agent management:
- Frame-based messaging (Request/Response/Event)
- JSON encoding with NDJSON streaming
- Protocol version negotiation
- Authentication support

### ACP (Agent Communication Protocol)
Inter-agent communication with:
- Session management
- Event mapping between protocols
- Client/Server architecture

### CLI System
Full-featured command-line interface:

```bash
# Initial setup
mohs-agent setup

# Status and health
mohs-agent status
mohs-agent health

# Session management
mohs-agent sessions --list
mohs-agent sessions --id <session-id>
mohs-agent sessions --delete <session-id>

# Configuration
mohs-agent config --list
mohs-agent config --get agent.name
mohs-agent config --set agent.name="My Agent"

# Daemon management
mohs-agent daemon --action status|start|stop|restart|install|uninstall
```

### Daemon Mode
Background service with platform-specific implementations:
- **macOS** — LaunchAgent
- **Linux** — systemd
- **Windows** — schtasks

## Installation

```bash
npm install
npm run build
```

## Quick Start

```typescript
import { createOrchestrator, createAgent } from 'mohs-agent';

const orchestrator = createOrchestrator();
await orchestrator.start();

const agent = createAgent({ name: 'my-agent' });
orchestrator.registerAgent(agent);

const result = await orchestrator.submitTask({
  id: 'task-1',
  type: 'chat',
  description: 'Process user request',
  input: { query: 'Hello, agent!' }
}, { sessionId: 'session-1' });
```

## Configuration

Configuration is loaded from `config.json` or `~/.mohs-agent/config.json`:

```json
{
  "version": "1.0.0",
  "agent": {
    "id": "mohs-agent",
    "name": "Mohs Agent",
    "model": "gpt-4"
  },
  "providers": {},
  "channels": {},
  "memory": {
    "enabledLayers": ["semantic"],
    "chromaPath": "./chroma-db"
  }
}
```

## Environment Variables

Use `${VAR}` syntax in config for environment variable substitution:

```json
{
  "providers": {
    "openai": {
      "apiKey": "${OPENAI_API_KEY}"
    }
  }
}
```

## Dependencies

- **chromadb** — Vector database for semantic memory
- **ws** — WebSocket server for Gateway protocol
- **zod** — Schema validation
- **yaml** — YAML config parsing
- **commander** — CLI framework
- **uuid** — Unique ID generation

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## License

MIT
