#!/usr/bin/env node

/**
 * Gemini CLI Router Wrapper (GCR)
 *
 * This wrapper intercepts Gemini CLI requests and routes them through
 * the ACPRMCPP router, enabling multi-provider support for Gemini.
 *
 * Usage: gcr "your prompt here"
 */

import { spawn } from "child_process";
import { getServiceInfo, isServiceRunning } from "../utils/processCheck";
import { mcpHandler } from "../protocols/mcp";

interface GeminiRequest {
  prompt: string;
  model?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Convert Gemini request to Claude-compatible format
 */
function geminiToClaudeFormat(request: GeminiRequest): any {
  return {
    model: request.model || "gemini-2.5-pro",
    messages: [
      {
        role: "user",
        content: request.prompt,
      },
    ],
    stream: request.stream !== false,
    temperature: request.temperature || 0.7,
    max_tokens: request.maxTokens || 4096,
  };
}

/**
 * Send request to CCR server
 */
async function sendToRouter(request: GeminiRequest): Promise<void> {
  try {
    const serviceInfo = await getServiceInfo();
    const claudeRequest = geminiToClaudeFormat(request);

    // Use fetch to send request to the router
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
Gemini CLI Router (GCR) - Part of ACPRMCPP

Usage: gcr [options] "your prompt"

Options:
  -m, --model <model>        Model to use (default: gemini-2.5-pro)
  -t, --temperature <temp>   Temperature (0-1, default: 0.7)
  --max-tokens <tokens>      Maximum tokens (default: 4096)
  --no-stream               Disable streaming output
  -h, --help                Show this help message

Examples:
  gcr "Explain quantum computing"
  gcr -m gemini-2.5-flash "Write a hello world in Python"
  gcr --temperature 0.9 "Be creative: write a poem"

The GCR wrapper routes Gemini CLI requests through the ACPRMCPP router,
enabling you to use any LLM provider configured in your CCR config.
    `);
    process.exit(0);
  }

  // Parse arguments
  const request: GeminiRequest = {
    prompt: "",
    stream: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-m":
      case "--model":
        request.model = args[++i];
        break;
      case "-t":
      case "--temperature":
        request.temperature = parseFloat(args[++i]);
        break;
      case "--max-tokens":
        request.maxTokens = parseInt(args[++i]);
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

export { sendToRouter, geminiToClaudeFormat };
