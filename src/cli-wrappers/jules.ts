#!/usr/bin/env node

/**
 * Google Jules CLI Router Wrapper (JCR)
 *
 * Jules is Google's autonomous coding agent that works in the background.
 * This wrapper provides a direct interface to Jules through ACPRMCPP routing.
 *
 * Note: Jules is officially a Gemini CLI extension. This wrapper provides
 * standalone access by routing through the ACPRMCPP router.
 *
 * Usage: jcr "your coding task"
 */

import { spawn } from "child_process";
import { getServiceInfo, isServiceRunning } from "../utils/processCheck";
import { mcpHandler } from "../protocols/mcp";

interface JulesRequest {
  task: string;
  model?: string;
  mode?: "bug-fix" | "feature" | "refactor" | "test" | "dependency-update";
  stream?: boolean;
}

/**
 * Convert Jules request to Claude-compatible format with Jules-specific system prompt
 */
function julesToClaudeFormat(request: JulesRequest): any {
  let systemPrompt = `You are Jules, Google's autonomous AI coding agent. You work asynchronously in the background to help with coding tasks. You are thorough, careful, and create production-ready code.`;

  switch (request.mode) {
    case "bug-fix":
      systemPrompt += ` Focus on identifying and fixing bugs. Analyze the root cause and provide a comprehensive fix.`;
      break;
    case "feature":
      systemPrompt += ` Build new features following best practices. Consider edge cases, error handling, and testing.`;
      break;
    case "refactor":
      systemPrompt += ` Refactor code to improve readability, performance, and maintainability while preserving functionality.`;
      break;
    case "test":
      systemPrompt += ` Write comprehensive tests with good coverage. Include unit tests, integration tests, and edge cases.`;
      break;
    case "dependency-update":
      systemPrompt += ` Update dependencies safely. Check for breaking changes and update code as needed.`;
      break;
    default:
      systemPrompt += ` Analyze the task and determine the best approach. Provide clear, well-documented code.`;
  }

  return {
    model: request.model || "gemini-2.5-pro",
    messages: [
      {
        role: "user",
        content: request.task,
      },
    ],
    system: systemPrompt,
    stream: request.stream !== false,
    max_tokens: 8192,
    temperature: 0.7,
  };
}

/**
 * Send request to CCR server
 */
async function sendToRouter(request: JulesRequest): Promise<void> {
  try {
    const serviceInfo = await getServiceInfo();
    const claudeRequest = julesToClaudeFormat(request);

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

    console.log(`\n🤖 Jules is working on your task...\n`);

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
      console.log(`\n\n✅ Jules has completed the task!`);
    } else {
      // Handle non-streaming response
      const result = await response.json();
      if (result.content && result.content[0]) {
        console.log(result.content[0].text);
        console.log(`\n✅ Jules has completed the task!`);
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
Jules CLI Router (JCR) - Part of ACPRMCPP

Jules is Google's autonomous AI coding agent that works in the background
to help with bug fixes, features, refactoring, tests, and dependency updates.

Usage: jcr [options] "your coding task"

Options:
  -m, --model <model>     Model to use (default: gemini-2.5-pro)
  --mode <mode>          Task mode: bug-fix|feature|refactor|test|dependency-update
  --no-stream            Disable streaming output
  -h, --help             Show this help message

Examples:
  jcr "Fix the authentication timeout issue in auth.ts"
  jcr --mode feature "Add pagination to the user list endpoint"
  jcr --mode refactor "Refactor the database connection pool"
  jcr --mode test "Write tests for the payment processing module"
  jcr --mode dependency-update "Update React to the latest version"

Jules works asynchronously and creates production-ready code with proper
error handling, testing, and documentation.

Note: Jules is officially a Gemini CLI extension. This wrapper provides
standalone access by routing through the ACPRMCPP router.
    `);
    process.exit(0);
  }

  // Parse arguments
  const request: JulesRequest = {
    task: "",
    stream: true,
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
        if (
          mode === "bug-fix" ||
          mode === "feature" ||
          mode === "refactor" ||
          mode === "test" ||
          mode === "dependency-update"
        ) {
          request.mode = mode;
        } else {
          console.error(
            `Invalid mode: ${mode}. Valid modes: bug-fix, feature, refactor, test, dependency-update`
          );
          process.exit(1);
        }
        break;
      case "--no-stream":
        request.stream = false;
        break;
      default:
        request.task = arg;
        break;
    }
  }

  if (!request.task) {
    console.error("Error: No task provided");
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

export { sendToRouter, julesToClaudeFormat };
