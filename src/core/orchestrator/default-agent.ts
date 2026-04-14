/**
 * Default Agent - Fallback agent implementation
 *
 * When no specialized agent is available, the orchestrator uses
 * this default agent for general-purpose task execution.
 */

import type {
  AgentId,
  IAgent,
  Task,
  TaskResult,
  ExecutionContext,
  AgentCapability,
  AgentStatus,
  TaskStatus,
  TaskStep,
} from '../../types/index.js';
import { createAgentId } from '../../types/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.

## Guidelines
- Be clear and concise
- Think step by step when solving complex problems
- Ask for clarification when requirements are unclear
- Use available tools to accomplish tasks
- Explain your reasoning when helpful

## Available Actions
- Use tools when appropriate
- Break complex tasks into steps
- Verify results before responding`;

export class DefaultAgent implements IAgent {
  readonly id: AgentId;
  readonly name: string;
  private _status: AgentStatus = 'idle';

  constructor(name: string = 'DefaultAgent') {
    this.id = createAgentId(`default-${Date.now()}`);
    this.name = name;
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'general-assistance',
        description: 'Provides general task execution and assistance',
        version: '1.0.0',
      },
      {
        name: 'text-processing',
        description: 'Analyzes and generates text content',
        version: '1.0.0',
      },
    ];
  }

  getSystemPrompt(): string {
    return DEFAULT_SYSTEM_PROMPT;
  }

  get status(): AgentStatus {
    return this._status;
  }

  async execute(task: Task, context: ExecutionContext): Promise<TaskResult> {
    this._status = 'running';
    const startTime = Date.now();
    const steps: TaskStep[] = [];

    try {
      // Step 1: Analyze task
      steps.push({
        stepNumber: 1,
        action: 'analyze-task',
        timestamp: Date.now(),
        input: { taskType: task.type, description: task.description },
      });

      // Step 2: Process based on task type
      let output: string | undefined;

      if (task.type === 'text-generation' || task.type === 'general') {
        output = await this.handleTextTask(task, context);
      } else if (task.type === 'question') {
        output = await this.handleQuestionTask(task, context);
      } else {
        output = `Task processed: ${task.description}`;
      }

      steps.push({
        stepNumber: 2,
        action: 'execute-task',
        timestamp: Date.now(),
        output,
      });

      this._status = 'idle';

      return {
        taskId: task.id,
        status: 'completed' as TaskStatus,
        output: { content: output },
        executionTime: Date.now() - startTime,
        steps,
      };
    } catch (error) {
      this._status = 'error';

      return {
        taskId: task.id,
        status: 'failed',
        error: {
          code: 'DEFAULT_AGENT_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
        executionTime: Date.now() - startTime,
        steps,
      };
    }
  }

  private async handleTextTask(task: Task, context: ExecutionContext): Promise<string> {
    // For text tasks, just echo back the description for now
    // In production, this would integrate with LLM providers
    return `Processed text task: ${task.description}\nContext session: ${context.sessionId}`;
  }

  private async handleQuestionTask(task: Task, context: ExecutionContext): Promise<string> {
    return `Answered question: ${task.input.query ?? task.description}`;
  }
}
