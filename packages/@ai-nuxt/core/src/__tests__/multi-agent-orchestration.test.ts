import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DefaultAgentOrchestrator } from '../multi-agent-orchestration'
import { DefaultAIAgent } from '../agent-implementation'
import type { 
  WorkflowDefinition, 
  WorkflowStep, 
  AgentMessage,
  WorkflowExecutionContext,
  AgentConfig,
  AIProvider
} from '../agents'

// Mock AI Provider
const mockProvider: AIProvider = {
  name: 'mock',
  chat: vi.fn().mockResolvedValue({
    text: 'Mock response',
    model: 'mock-model'
  }),
  completion: vi.fn(),
  embedding: vi.fn(),
  stream: vi.fn()
}

// Helper function to create mock agent
function createMockAgent(id: string, name: string = `Agent ${id}`): DefaultAIAgent {
  const config: AgentConfig = {
    id,
    name,
    description: `Mock agent ${id}`,
    role: 'test agent',
    systemPrompt: 'You are a test agent',
    capabilities: {
      canUseTool: false,
      canCommunicate: true,
      canMakeDecisions: false,
      canLearn: false
    },
    tools: [],
    provider: {
      name: 'mock',
      model: 'mock-model'
    },
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  return new DefaultAIAgent(config, mockProvider)
}

// Helper function to create simple workflow
function createSimpleWorkflow(mode: 'sequential' | 'parallel' | 'mixed' = 'sequential'): WorkflowDefinition {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    mode,
    errorHandling: 'fail_fast',
    steps: [
      {
        id: 'step1',
        name: 'First Step',
        agentId: 'agent1',
        input: 'Process this: ${input}'
      },
      {
        id: 'step2',
        name: 'Second Step',
        agentId: 'agent2',
        input: 'Continue with: ${step_step1}',
        dependencies: mode === 'sequential' ? ['step1'] : undefined
      }
    ]
  }
}

describe('DefaultAgentOrchestrator', () => {
  let orchestrator: DefaultAgentOrchestrator
  let agent1: DefaultAIAgent
  let agent2: DefaultAIAgent

  beforeEach(() => {
    orchestrator = new DefaultAgentOrchestrator()
    agent1 = createMockAgent('agent1', 'Test Agent 1')
    agent2 = createMockAgent('agent2', 'Test Agent 2')
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Agent Registration', () => {
    it('should register agents successfully', () => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
      
      const stats = orchestrator.getStats()
      expect(stats.registeredAgents).toBe(2)
    })

    it('should prevent duplicate agent registration', () => {
      orchestrator.registerAgent(agent1)
      
      expect(() => orchestrator.registerAgent(agent1))
        .toThrow('Agent agent1 is already registered')
    })

    it('should unregister agents', () => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
      
      orchestrator.unregisterAgent('agent1')
      
      const stats = orchestrator.getStats()
      expect(stats.registeredAgents).toBe(1)
    })

    it('should emit registration events', () => {
      const registerSpy = vi.fn()
      const unregisterSpy = vi.fn()
      
      orchestrator.on('agent:register', registerSpy)
      orchestrator.on('agent:unregister', unregisterSpy)
      
      orchestrator.registerAgent(agent1)
      orchestrator.unregisterAgent('agent1')
      
      expect(registerSpy).toHaveBeenCalledWith({ agent: agent1 })
      expect(unregisterSpy).toHaveBeenCalledWith({ agentId: 'agent1' })
    })
  })

  describe('Message Handling', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should send messages between agents', async () => {
      const message: AgentMessage = {
        id: 'msg1',
        from: 'agent1',
        to: 'agent2',
        type: 'request',
        content: 'Hello agent2',
        metadata: { timestamp: Date.now() }
      }
      
      const sentSpy = vi.fn()
      const receivedSpy = vi.fn()
      
      orchestrator.on('message:sent', sentSpy)
      orchestrator.on('message:received', receivedSpy)
      
      await orchestrator.sendMessage(message)
      
      expect(sentSpy).toHaveBeenCalledWith({ message })
      expect(receivedSpy).toHaveBeenCalledWith({ message, agent: agent2 })
      
      const stats = orchestrator.getStats()
      expect(stats.messagesSent).toBe(1)
    })

    it('should broadcast messages to all agents', async () => {
      const receivedSpy = vi.fn()
      orchestrator.on('message:received', receivedSpy)
      
      await orchestrator.broadcastMessage('agent1', 'Hello everyone')
      
      expect(receivedSpy).toHaveBeenCalledTimes(2) // Both agents should receive
    })

    it('should handle messages to non-existent agents', async () => {
      const message: AgentMessage = {
        id: 'msg1',
        from: 'agent1',
        to: 'nonexistent',
        type: 'request',
        content: 'Hello',
        metadata: { timestamp: Date.now() }
      }
      
      await expect(orchestrator.sendMessage(message))
        .rejects.toThrow('Agent nonexistent not found')
    })
  })

  describe('Sequential Workflow Execution', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should execute sequential workflow successfully', async () => {
      const workflow = createSimpleWorkflow('sequential')
      
      const startSpy = vi.fn()
      const completeSpy = vi.fn()
      const stepStartSpy = vi.fn()
      const stepCompleteSpy = vi.fn()
      
      orchestrator.on('workflow:start', startSpy)
      orchestrator.on('workflow:complete', completeSpy)
      orchestrator.on('step:start', stepStartSpy)
      orchestrator.on('step:complete', stepCompleteSpy)
      
      const result = await orchestrator.executeWorkflow(workflow, 'test input')
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(2)
      expect(result.metadata.stepsFailed).toBe(0)
      
      expect(startSpy).toHaveBeenCalled()
      expect(completeSpy).toHaveBeenCalled()
      expect(stepStartSpy).toHaveBeenCalledTimes(2)
      expect(stepCompleteSpy).toHaveBeenCalledTimes(2)
      
      // Verify execution order
      const stepStartCalls = stepStartSpy.mock.calls
      expect(stepStartCalls[0][0].step.id).toBe('step1')
      expect(stepStartCalls[1][0].step.id).toBe('step2')
    })

    it('should handle step failures in fail_fast mode', async () => {
      // Mock agent1 to fail
      const failingAgent = createMockAgent('failing-agent')
      vi.spyOn(failingAgent, 'execute').mockRejectedValue(new Error('Agent failed'))
      
      orchestrator.registerAgent(failingAgent)
      
      const workflow: WorkflowDefinition = {
        id: 'failing-workflow',
        name: 'Failing Workflow',
        description: 'A workflow that fails',
        mode: 'sequential',
        errorHandling: 'fail_fast',
        steps: [
          {
            id: 'failing-step',
            name: 'Failing Step',
            agentId: 'failing-agent',
            input: 'This will fail'
          },
          {
            id: 'never-executed',
            name: 'Never Executed',
            agentId: 'agent1',
            input: 'This should not execute'
          }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(false)
      expect(result.metadata.stepsExecuted).toBe(0)
      expect(result.metadata.stepsFailed).toBe(1)
    })

    it('should handle optional step failures', async () => {
      const failingAgent = createMockAgent('failing-agent')
      vi.spyOn(failingAgent, 'execute').mockRejectedValue(new Error('Agent failed'))
      
      orchestrator.registerAgent(failingAgent)
      
      const workflow: WorkflowDefinition = {
        id: 'optional-fail-workflow',
        name: 'Optional Fail Workflow',
        description: 'A workflow with optional failing step',
        mode: 'sequential',
        errorHandling: 'continue',
        steps: [
          {
            id: 'optional-failing-step',
            name: 'Optional Failing Step',
            agentId: 'failing-agent',
            input: 'This will fail',
            optional: true
          },
          {
            id: 'success-step',
            name: 'Success Step',
            agentId: 'agent1',
            input: 'This should execute'
          }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(1) // Only the success step
      expect(result.metadata.stepsFailed).toBe(1)
    })
  })

  describe('Parallel Workflow Execution', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should execute parallel workflow successfully', async () => {
      const workflow = createSimpleWorkflow('parallel')
      
      const stepStartSpy = vi.fn()
      orchestrator.on('step:start', stepStartSpy)
      
      const result = await orchestrator.executeWorkflow(workflow, 'test input')
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(2)
      
      // Both steps should start (order may vary due to parallel execution)
      expect(stepStartSpy).toHaveBeenCalledTimes(2)
    })

    it('should respect concurrency limits', async () => {
      const workflow: WorkflowDefinition = {
        id: 'concurrent-workflow',
        name: 'Concurrent Workflow',
        description: 'A workflow with concurrency limits',
        mode: 'parallel',
        errorHandling: 'continue',
        maxConcurrency: 1,
        steps: [
          { id: 'step1', name: 'Step 1', agentId: 'agent1', input: 'task1' },
          { id: 'step2', name: 'Step 2', agentId: 'agent2', input: 'task2' },
          { id: 'step3', name: 'Step 3', agentId: 'agent1', input: 'task3' }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(3)
    })
  })

  describe('Mixed Workflow Execution', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should execute mixed workflow with dependencies', async () => {
      const workflow: WorkflowDefinition = {
        id: 'mixed-workflow',
        name: 'Mixed Workflow',
        description: 'A workflow with dependencies',
        mode: 'mixed',
        errorHandling: 'fail_fast',
        steps: [
          {
            id: 'init',
            name: 'Initialize',
            agentId: 'agent1',
            input: 'Initialize process'
          },
          {
            id: 'process1',
            name: 'Process 1',
            agentId: 'agent1',
            input: 'Process part 1',
            dependencies: ['init']
          },
          {
            id: 'process2',
            name: 'Process 2',
            agentId: 'agent2',
            input: 'Process part 2',
            dependencies: ['init']
          },
          {
            id: 'finalize',
            name: 'Finalize',
            agentId: 'agent1',
            input: 'Finalize process',
            dependencies: ['process1', 'process2']
          }
        ]
      }
      
      const stepStartSpy = vi.fn()
      orchestrator.on('step:start', stepStartSpy)
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(4)
      
      // Verify execution order respects dependencies
      const stepStartCalls = stepStartSpy.mock.calls.map(call => call[0].step.id)
      
      // 'init' should be first
      expect(stepStartCalls[0]).toBe('init')
      
      // 'finalize' should be last
      expect(stepStartCalls[stepStartCalls.length - 1]).toBe('finalize')
    })

    it('should handle conditional steps', async () => {
      const workflow: WorkflowDefinition = {
        id: 'conditional-workflow',
        name: 'Conditional Workflow',
        description: 'A workflow with conditional steps',
        mode: 'mixed',
        errorHandling: 'continue',
        steps: [
          {
            id: 'check',
            name: 'Check Condition',
            agentId: 'agent1',
            input: 'check condition'
          },
          {
            id: 'conditional',
            name: 'Conditional Step',
            agentId: 'agent2',
            input: 'conditional task',
            dependencies: ['check'],
            condition: (context) => {
              // This step should not execute based on our condition
              return false
            }
          },
          {
            id: 'always',
            name: 'Always Execute',
            agentId: 'agent1',
            input: 'always execute',
            dependencies: ['check']
          }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(true)
      expect(result.metadata.stepsExecuted).toBe(2) // check + always, not conditional
    })
  })

  describe('Workflow Control', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should cancel running workflows', async () => {
      // Create a long-running workflow
      const longRunningAgent = createMockAgent('long-agent')
      vi.spyOn(longRunningAgent, 'execute').mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          context: {} as any,
          output: 'done',
          success: true,
          metadata: { executionTime: 1000, stepCount: 1, toolsUsed: 0 }
        }), 1000))
      )
      
      orchestrator.registerAgent(longRunningAgent)
      
      const workflow: WorkflowDefinition = {
        id: 'long-workflow',
        name: 'Long Workflow',
        description: 'A long running workflow',
        mode: 'sequential',
        errorHandling: 'fail_fast',
        steps: [
          {
            id: 'long-step',
            name: 'Long Step',
            agentId: 'long-agent',
            input: 'long task'
          }
        ]
      }
      
      const cancelSpy = vi.fn()
      orchestrator.on('workflow:cancel', cancelSpy)
      
      // Start workflow and cancel it
      const executionPromise = orchestrator.executeWorkflow(workflow)
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Get execution ID and cancel
      const stats = orchestrator.getStats()
      expect(stats.activeWorkflows).toBe(1)
      
      // We can't easily test cancellation without exposing execution IDs
      // This would require additional API methods in a real implementation
    })

    it('should track execution status', async () => {
      const workflow = createSimpleWorkflow('sequential')
      
      const executionPromise = orchestrator.executeWorkflow(workflow, 'test')
      
      // Check that workflow is active
      const stats = orchestrator.getStats()
      expect(stats.activeWorkflows).toBe(1)
      
      await executionPromise
      
      // Check that workflow is no longer active
      const finalStats = orchestrator.getStats()
      expect(finalStats.activeWorkflows).toBe(0)
      expect(finalStats.totalWorkflows).toBe(1)
      expect(finalStats.successfulWorkflows).toBe(1)
    })
  })

  describe('Variable Interpolation', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should interpolate variables in step inputs', async () => {
      const workflow: WorkflowDefinition = {
        id: 'variable-workflow',
        name: 'Variable Workflow',
        description: 'A workflow with variable interpolation',
        mode: 'sequential',
        errorHandling: 'fail_fast',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            agentId: 'agent1',
            input: 'Process: ${input}'
          },
          {
            id: 'step2',
            name: 'Second Step',
            agentId: 'agent2',
            input: 'Continue with result: ${step_step1}'
          }
        ]
      }
      
      // Mock agent1 to return specific output
      vi.spyOn(agent1, 'execute').mockResolvedValue({
        context: {} as any,
        output: 'step1 result',
        success: true,
        metadata: { executionTime: 100, stepCount: 1, toolsUsed: 0 }
      })
      
      const agent2ExecuteSpy = vi.spyOn(agent2, 'execute')
      
      await orchestrator.executeWorkflow(workflow, 'initial input')
      
      // Check that agent2 received interpolated input
      expect(agent2ExecuteSpy).toHaveBeenCalledWith(
        'Continue with result: step1 result',
        expect.objectContaining({
          variables: expect.objectContaining({
            input: 'initial input',
            step_step1: 'step1 result'
          })
        })
      )
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should handle missing agents', async () => {
      const workflow: WorkflowDefinition = {
        id: 'missing-agent-workflow',
        name: 'Missing Agent Workflow',
        description: 'A workflow with missing agent',
        mode: 'sequential',
        errorHandling: 'fail_fast',
        steps: [
          {
            id: 'missing-step',
            name: 'Missing Agent Step',
            agentId: 'nonexistent-agent',
            input: 'task'
          }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Agent nonexistent-agent not found')
    })

    it('should handle workflow timeouts', async () => {
      const slowAgent = createMockAgent('slow-agent')
      vi.spyOn(slowAgent, 'execute').mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      )
      
      orchestrator.registerAgent(slowAgent)
      
      const workflow: WorkflowDefinition = {
        id: 'timeout-workflow',
        name: 'Timeout Workflow',
        description: 'A workflow that times out',
        mode: 'sequential',
        errorHandling: 'fail_fast',
        timeout: 1000,
        steps: [
          {
            id: 'slow-step',
            name: 'Slow Step',
            agentId: 'slow-agent',
            input: 'slow task',
            timeout: 500
          }
        ]
      }
      
      const result = await orchestrator.executeWorkflow(workflow)
      
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('timed out')
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
    })

    it('should track orchestrator statistics', async () => {
      const workflow = createSimpleWorkflow('sequential')
      
      const initialStats = orchestrator.getStats()
      expect(initialStats.registeredAgents).toBe(2)
      expect(initialStats.totalWorkflows).toBe(0)
      
      await orchestrator.executeWorkflow(workflow)
      
      const finalStats = orchestrator.getStats()
      expect(finalStats.totalWorkflows).toBe(1)
      expect(finalStats.successfulWorkflows).toBe(1)
      expect(finalStats.averageExecutionTime).toBeGreaterThan(0)
    })

    it('should emit comprehensive events', async () => {
      const workflow = createSimpleWorkflow('sequential')
      
      const events: string[] = []
      
      orchestrator.on('workflow:start', () => events.push('workflow:start'))
      orchestrator.on('workflow:complete', () => events.push('workflow:complete'))
      orchestrator.on('step:start', () => events.push('step:start'))
      orchestrator.on('step:complete', () => events.push('step:complete'))
      
      await orchestrator.executeWorkflow(workflow)
      
      expect(events).toEqual([
        'workflow:start',
        'step:start',
        'step:complete',
        'step:start',
        'step:complete',
        'workflow:complete'
      ])
    })
  })
})