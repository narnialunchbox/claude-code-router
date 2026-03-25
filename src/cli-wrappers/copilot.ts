#!/usr/bin/env node

/**
 * GitHub Copilot CLI Router Wrapper (GHCR)
 *
 * This wrapper intercepts GitHub Copilot CLI requests and routes them through
 * the ACPRMCPP router, enabling multi-provider support for Copilot.
 *
 * Usage: ghcr "your command or question"
 */

import { spawn } from "child_process";
import { getServiceInfo, isServiceRunning } from "../utils/processCheck";
import { mcpHandler } from "../protocols/mcp";

interface CopilotRequest {
  prompt: string;
  model?: string;
  mode?: "explain" | "suggest" | "fix";
  stream?: boolean;
}

/**
 * Convert Copilot request to Claude-compatible format
 */
function copilotToClaudeFormat(request: CopilotRequest): any {
  let systemPrompt = "You are GitHub Copilot, an AI assistant for developers.";

  switch (request.mode) {
    case "explain":
      systemPrompt += " Explain the following code or concept clearly and concisely.";
      break;
    case "suggest":
      systemPrompt += " Suggest code or solutions for the following request.";
      break;
    case "fix":
      systemPrompt += " Analyze and fix the following code issue.";
      break;
  }

  return {
    model: request.model || "gpt-4",
    messages: [
      {
        role: "user",
        content: request.prompt,
      },
    ],
    system: systemPrompt,
    stream: request.stream !== false,
    max_tokens: 4096,
  };
}

/**
 * Send request to CCR server
 */
async function sendToRouter(request: CopilotRequest): Promise<void> {
  try {
    const serviceInfo = await getServiceInfo();
    const claudeRequest = copilotToClaudeFormat(request);

    const response = await fetch(`${serviceInfo.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(serviceInfo.apiKey && { "x-api-key": serviceInfo.apiKey }),
      },
      body: JSON.stringify(claudeRequest),
    });

    if (!response.ok) {
      throw new Error(`Router returned ${response.status}: ${response.statusText}`);
    }

    if (request.stream !== false) {
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta") {
                process.stdout.write(parsed.delta.text);
              }
            } catch (e) {
              // Ignore parse errors in streaming
            }
          }
        }
      }
      process.stdout.write("\n");
    } else {
      // Handle non-streaming response
      const result = await response.json();
      if (result.content && result.content[0]) {
        console.log(result.content[0].text);
      }
    }
  } catch (error: any) {
    console.error("Error communicating with router:", error.message);
    process.exit(1);
  }
}

/**
 * Start the CCR service if not running
 */
async function ensureServiceRunning(): Promise<void> {
  if (!isServiceRunning()) {
    console.log("Starting ACPRMCPP router service...");
    const startProcess = spawn("ccr", ["start"], {
      detached: true,
      stdio: "ignore",
    });
    startProcess.unref();

    // Wait for service to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (!isServiceRunning()) {
      throw new Error("Failed to start router service. Run 'ccr start' manually.");
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
GitHub Copilot CLI Router (GHCR) - Part of ACPRMCPP

Usage: ghcr [options] "your prompt or command"

Options:
  -m, --model <model>     Model to use (default: gpt-4)
  --mode <mode>          Mode: explain|suggest|fix (default: suggest)
  --no-stream            Disable streaming output
  -h, --help             Show this help message

Examples:
  ghcr "How do I reverse a string in Python?"
  ghcr --mode explain "What does this regex do: ^[a-z]+$"
  ghcr --mode fix "Fix this SQL injection vulnerability"

The GHCR wrapper routes GitHub Copilot CLI requests through the ACPRMCPP router,
enabling you to use any LLM provider configured in your CCR config.
    `);
    process.exit(0);
  }

  // Parse arguments
  const request: CopilotRequest = {
    prompt: "",
    stream: true,
    mode: "suggest",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-m":
      case "--model":
        request.model = args[++i];
        break;
      case "--mode":
        const mode = args[++i];
        if (mode === "explain" || mode === "suggest" || mode === "fix") {
          request.mode = mode;
        }
        break;
      case "--no-stream":
        request.stream = false;
        break;
      default:
        request.prompt = arg;
        break;
    }
  }

  if (!request.prompt) {
    console.error("Error: No prompt provided");
    process.exit(1);
  }

  try {
    await ensureServiceRunning();
    await sendToRouter(request);
  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { sendToRouter, copilotToClaudeFormat };
