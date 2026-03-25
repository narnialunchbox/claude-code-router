# ACPRMCPP Architecture

**Agent Client Protocol Router Model Content Protocol Plus**

## Overview

ACPRMCPP is a universal routing architecture that enables multi-provider LLM support across different AI CLI tools. Instead of being locked into a single provider for each CLI tool, ACPRMCPP routes requests through a unified protocol layer, giving you the freedom to use any LLM provider with any AI CLI.

## Supported AI CLIs

### ✅ Claude Code
- **CLI Command**: `ccr`
- **Provider**: Anthropic
- **Status**: Fully supported (original implementation)
- **Protocol**: Anthropic Messages API v1

### ✅ Gemini CLI
- **CLI Command**: `gcr` (Gemini CLI Router)
- **Provider**: Google
- **Status**: Supported via wrapper
- **Protocol**: Gemini API + MCP
- **Extensions**: Includes Jules (Google's autonomous coding agent)

### ✅ GitHub Copilot CLI
- **CLI Command**: `ghcr` (GitHub Copilot Router)
- **Provider**: GitHub/OpenAI
- **Status**: Supported via wrapper
- **Protocol**: Copilot API + MCP (Model Context Protocol)

### 🚧 OpenAI Codex
- **Status**: Original Codex deprecated (2023)
- **Alternative**: Use Claude Code or Gemini wrappers with OpenAI models

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     User Input                          │
│  (ccr / gcr / ghcr / jules commands)                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              CLI Wrappers Layer                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│  │   CCR   │  │   GCR   │  │  GHCR   │                │
│  │ Claude  │  │ Gemini  │  │ Copilot │                │
│  └────┬────┘  └────┬────┘  └────┬────┘                │
└───────┼────────────┼─────────────┼─────────────────────┘
        │            │             │
        └────────────┼─────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│           ACPRMCPP Router Core                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Protocol Abstraction Layer                    │    │
│  │  - Anthropic Messages API                      │    │
│  │  - Gemini API                                  │    │
│  │  - OpenAI Chat Completions                     │    │
│  │  - MCP (Model Context Protocol)                │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  Routing Engine                                │    │
│  │  - Default routes                              │    │
│  │  - Background task routing                     │    │
│  │  - Long context routing                        │    │
│  │  - Think mode routing                          │    │
│  │  - Web search routing                          │    │
│  │  - Custom router support                       │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  Transformer Layer                             │    │
│  │  - Request/Response transformation             │    │
│  │  - Provider-specific adaptations               │    │
│  │  - Token counting & optimization               │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Provider Endpoints                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Anthropic │ │  Google  │ │ OpenAI   │ │ DeepSeek │  │
│  │  Claude  │ │  Gemini  │ │  GPT     │ │    R1    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │OpenRouter│ │  Groq    │ │  Ollama  │ │  Custom  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Universal Protocol Abstraction
- Convert between different API formats (Anthropic, OpenAI, Gemini)
- Normalize request/response structures
- Handle streaming and non-streaming modes uniformly

### 2. Model Context Protocol (MCP) Support
- Standard protocol for connecting LLMs to external tools
- Supported by Gemini CLI and GitHub Copilot CLI
- JSON-RPC 2.0 based communication
- Tool discovery and invocation

### 3. Intelligent Routing
- **Default**: Standard requests
- **Background**: Fast, lightweight models for background tasks
- **Think**: Reasoning-focused models for complex problems
- **Long Context**: Models optimized for large context windows
- **Web Search**: Models with grounding capabilities
- **Custom**: User-defined routing logic

### 4. Multi-Provider Support
Supported providers include:
- Anthropic (Claude models)
- Google (Gemini models)
- OpenAI (GPT models)
- DeepSeek (DeepSeek-V3, R1)
- OpenRouter (aggregator)
- Groq (fast inference)
- Ollama (local models)
- Azure OpenAI
- Custom providers

### 5. Request Transformation
- Automatic format conversion between providers
- Token counting and optimization
- Max tokens adjustment per provider
- Tool use adaptation (function calling)
- Thinking mode support

## CLI Wrappers

### GCR (Gemini CLI Router)

Routes Gemini CLI requests through ACPRMCPP:

```bash
# Basic usage
gcr "Explain quantum computing"

# Specify model
gcr -m gemini-2.5-flash "Write a hello world"

# Adjust temperature
gcr --temperature 0.9 "Be creative: write a poem"

# Jules integration (via Gemini extension)
gcr "/jules fix the authentication bug"
```

### GHCR (GitHub Copilot Router)

Routes GitHub Copilot CLI requests through ACPRMCPP:

```bash
# Basic usage
ghcr "How do I reverse a string in Python?"

# Explain mode
ghcr --mode explain "What does this regex do: ^[a-z]+$"

# Fix mode
ghcr --mode fix "Fix this SQL injection vulnerability"

# Suggest mode (default)
ghcr "Optimize this database query"
```

### CCR (Claude Code Router)

Original implementation for Claude Code:

```bash
# Start the router service
ccr start

# Execute Claude Code through router
ccr code "Refactor this function"

# Open web UI
ccr ui

# Check status
ccr status
```

## Configuration

Configure providers and routing rules in `~/.claude-code-router/config.json`:

```json
{
  "PORT": 3456,
  "HOST": "127.0.0.1",
  "APIKEY": "your-secret-key",
  "LOG": true,
  "LOG_LEVEL": "debug",
  "API_TIMEOUT_MS": 600000,
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "$OPENROUTER_API_KEY",
      "models": [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "deepseek/deepseek-chat-v3-0324"
      ],
      "transformer": {
        "use": ["openrouter"]
      }
    },
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "$GEMINI_API_KEY",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "transformer": {
        "use": ["gemini"]
      }
    }
  ],
  "Router": {
    "default": "openrouter,anthropic/claude-sonnet-4",
    "background": "gemini,gemini-2.5-flash",
    "think": "openrouter,deepseek/deepseek-chat-v3-0324",
    "longContext": "gemini,gemini-2.5-pro",
    "webSearch": "gemini,gemini-2.5-pro"
  }
}
```

## MCP Endpoints

The router exposes MCP-compatible endpoints:

- `POST /mcp` - Handle MCP JSON-RPC requests
- `GET /mcp/tools` - List available tools
- `GET /mcp/servers` - List connected MCP servers

## Benefits

1. **Cost Optimization**: Route to cheaper models for simple tasks
2. **Performance**: Use faster models for background operations
3. **Flexibility**: Switch providers without changing your workflow
4. **Privacy**: Route sensitive requests to local models (Ollama)
5. **Experimentation**: Test new models without CLI changes
6. **Unified Interface**: One configuration for all AI CLIs

## Technical Details

### Protocol Support
- **Anthropic Messages API**: v1 (2023-06-01)
- **OpenAI Chat Completions**: v1
- **Gemini API**: v1beta
- **MCP**: 2024-11-05

### Authentication
- API key authentication
- Bearer token support
- Environment variable interpolation
- OAuth support (via MCP)

### Streaming
- Server-Sent Events (SSE)
- WebSocket support
- Chunked transfer encoding
- Real-time token streaming

## Future Enhancements

- [ ] Aider CLI support
- [ ] Cursor CLI integration
- [ ] Continue.dev CLI wrapper
- [ ] Claude Sonnet Shell integration
- [ ] Cost tracking per CLI/provider
- [ ] Rate limiting per provider
- [ ] Fallback routing on errors
- [ ] A/B testing different models
- [ ] Analytics dashboard

## Sources

- [Gemini CLI Documentation](https://github.com/google-gemini/gemini-cli)
- [GitHub Copilot CLI](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/)
- [Jules Tools CLI](https://developers.googleblog.com/en/meet-jules-tools-a-command-line-companion-for-googles-async-coding-agent/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenAI Deprecations](https://developers.openai.com/api/docs/deprecations)

## Contributing

ACPRMCPP is open for contributions. To add support for a new CLI:

1. Create a wrapper in `src/cli-wrappers/[cli-name].ts`
2. Implement request transformation to Claude format
3. Add CLI binary to `package.json`
4. Update build script to bundle the wrapper
5. Submit a PR with documentation

## License

MIT License - Same as Claude Code Router
