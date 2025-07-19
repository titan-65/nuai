import { getMetrics } from './metrics'
import { getErrorTracker, ErrorSeverity, ErrorCategory } from './error-tracking'

/**
 * Alert types
 */
export enum AlertType {
  ERROR_RATE = 'error_rate',
  LATENCY = 'latency',
  COST = 'cost',
  TOKEN_USAGE = 'token_usage',
  QUOTA_USAGE = 'quota_usage',
  CACHE_MISS_RATE = 'cache_miss_rate',
  AGENT_FAILURE = 'agent_failure',
  PROVIDER_HEALTH = 'provider_health'
}

/**
 * Alert severity
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Alert condition
 */
export interface AlertCondition {
  type: AlertType
  threshold: number
  timeWindow: number // in minutes
  comparison: 'greater_than' | 'less_than' | 'equals'
  filters?: Record<string, string>
}

/**
 * Alert rule
 */
export interface AlertRule {
  id: string
  name: string
  description: string
  condition: AlertCondition
  severity: AlertSeverity
  enabled: boolean
  cooldown: number // in minutes
  channels: AlertChannel[]
  lastTriggered?: Date
}

/**
 * Alert channel interface
 */
export interface AlertChannel {
  type: 'email' | 'webhook' | 'slack' | 'discord' | 'console'
  config: Record<string, any>
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  message: string
  timestamp: Date
  value: number
  threshold: number
  metadata: Record<string, any>
}

/**
 * Email alert channel
 */
export class EmailAlertChannel implements AlertChannel {
  type = 'email' as const
  config: {
    to: string[]
    from: string
    smtpConfig: {
      host: string
      port: number
      secure: boolean
      auth: {
        user: string
        pass: string
      }
    }
  }

  constructor(config: EmailAlertChannel['config']) {
    this.config = config
  }

  async send(alert: AlertEvent): Promise<void> {
    // In a real implementation, this would use nodemailer or similar
    console.log('Email Alert:', {
      to: this.config.to,
      subject: `AI Nuxt Alert: ${alert.ruleName}`,
      body: this.formatEmailBody(alert)
    })
  }

  private formatEmailBody(alert: AlertEvent): string {
    return `
Alert: ${alert.ruleName}
Severity: ${alert.severity.toUpperCase()}
Time: ${alert.timestamp.toISOString()}
Message: ${alert.message}
Value: ${alert.value}
Threshold: ${alert.threshold}

Metadata:
${JSON.stringify(alert.metadata, null, 2)}
    `.trim()
  }
}

/**
 * Webhook alert channel
 */
export class WebhookAlertChannel implements AlertChannel {
  type = 'webhook' as const
  config: {
    url: string
    headers?: Record<string, string>
    method?: 'POST' | 'PUT'
  }

  constructor(config: WebhookAlertChannel['config']) {
    this.config = config
  }

  async send(alert: AlertEvent): Promise<void> {
    try {
      const response = await fetch(this.config.url, {
        method: this.config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify(alert)
      })

      if (!response.ok) {
        console.error('Webhook alert failed:', response.statusText)
      }
    } catch (error) {
      console.error('Webhook alert error:', error)
    }
  }
}

/**
 * Slack alert channel
 */
export class SlackAlertChannel implements AlertChannel {
  type = 'slack' as const
  config: {
    webhookUrl: string
    channel?: string
    username?: string
  }

  constructor(config: SlackAlertChannel['config']) {
    this.config = config
  }

  async send(alert: AlertEvent): Promise<void> {
    const payload = {
      channel: this.config.channel,
      username: this.config.username || 'AI Nuxt Alerts',
      attachments: [{
        color: this.getSeverityColor(alert.severity),
        title: alert.ruleName,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Value',
            value: alert.value.toString(),
            short: true
          },
          {
            title: 'Threshold',
            value: alert.threshold.toString(),
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ],
        footer: 'AI Nuxt Monitoring',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error('Slack alert failed:', response.statusText)
      }
    } catch (error) {
      console.error('Slack alert error:', error)
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'danger'
      case AlertSeverity.WARNING: return 'warning'
      case AlertSeverity.INFO: return 'good'
      default: return 'good'
    }
  }
}

/**
 * Console alert channel
 */
export class ConsoleAlertChannel implements AlertChannel {
  type = 'console' as const
  config = {}

  async send(alert: AlertEvent): Promise<void> {
    const color = this.getSeverityColor(alert.severity)
    console.log(`${color}[ALERT] ${alert.ruleName}: ${alert.message}\x1b[0m`)
    console.log(`  Severity: ${alert.severity}`)
    console.log(`  Value: ${alert.value} (threshold: ${alert.threshold})`)
    console.log(`  Time: ${alert.timestamp.toISOString()}`)
    if (Object.keys(alert.metadata).length > 0) {
      console.log(`  Metadata:`, alert.metadata)
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return '\x1b[31m' // Red
      case AlertSeverity.WARNING: return '\x1b[33m'  // Yellow
      case AlertSeverity.INFO: return '\x1b[36m'     // Cyan
      default: return '\x1b[0m'                      // Reset
    }
  }
}

/**
 * Alert manager
 */
export class AlertManager {
  private rules = new Map<string, AlertRule>()
  private channels = new Map<string, AlertChannel>()
  private alertHistory: AlertEvent[] = []
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    // Add default console channel
    this.addChannel('console', new ConsoleAlertChannel())
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId)
  }

  /**
   * Get alert rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId)
  }

  /**
   * List all rules
   */
  listRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Add alert channel
   */
  addChannel(id: string, channel: AlertChannel): void {
    this.channels.set(id, channel)
  }

  /**
   * Remove alert channel
   */
  removeChannel(id: string): void {
    this.channels.delete(id)
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(() => {
      this.checkAlerts()
    }, intervalMs)

    console.log('Alert monitoring started')
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    console.log('Alert monitoring stopped')
  }

  /**
   * Check all alert rules
   */
  private async checkAlerts(): Promise<void> {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled)

    for (const rule of enabledRules) {
      try {
        await this.checkRule(rule)
      } catch (error) {
        console.error(`Error checking alert rule ${rule.id}:`, error)
      }
    }
  }

  /**
   * Check individual alert rule
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    // Check cooldown
    if (rule.lastTriggered) {
      const cooldownMs = rule.cooldown * 60 * 1000
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime()
      if (timeSinceLastTrigger < cooldownMs) {
        return // Still in cooldown
      }
    }

    const value = await this.evaluateCondition(rule.condition)
    const shouldTrigger = this.shouldTriggerAlert(value, rule.condition)

    if (shouldTrigger) {
      await this.triggerAlert(rule, value)
    }
  }

  /**
   * Evaluate alert condition
   */
  private async evaluateCondition(condition: AlertCondition): Promise<number> {
    const metrics = getMetrics()
    const errorTracker = getErrorTracker()

    switch (condition.type) {
      case AlertType.ERROR_RATE:
        return this.calculateErrorRate(condition.timeWindow, condition.filters)
      
      case AlertType.LATENCY:
        return this.calculateAverageLatency(condition.timeWindow, condition.filters)
      
      case AlertType.COST:
        return this.calculateCostRate(condition.timeWindow, condition.filters)
      
      case AlertType.TOKEN_USAGE:
        return this.calculateTokenUsage(condition.timeWindow, condition.filters)
      
      case AlertType.QUOTA_USAGE:
        return this.calculateQuotaUsage(condition.filters)
      
      case AlertType.CACHE_MISS_RATE:
        return this.calculateCacheMissRate(condition.timeWindow, condition.filters)
      
      case AlertType.AGENT_FAILURE:
        return this.calculateAgentFailureRate(condition.timeWindow, condition.filters)
      
      case AlertType.PROVIDER_HEALTH:
        return this.calculateProviderHealth(condition.timeWindow, condition.filters)
      
      default:
        return 0
    }
  }

  /**
   * Check if alert should trigger
   */
  private shouldTriggerAlert(value: number, condition: AlertCondition): boolean {
    switch (condition.comparison) {
      case 'greater_than':
        return value > condition.threshold
      case 'less_than':
        return value < condition.threshold
      case 'equals':
        return Math.abs(value - condition.threshold) < 0.001
      default:
        return false
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: AlertEvent = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.formatAlertMessage(rule, value),
      timestamp: new Date(),
      value,
      threshold: rule.condition.threshold,
      metadata: {
        condition: rule.condition,
        description: rule.description
      }
    }

    // Update rule
    rule.lastTriggered = alert.timestamp

    // Store in history
    this.alertHistory.push(alert)
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000)
    }

    // Send to channels
    for (const channelConfig of rule.channels) {
      const channel = this.findChannel(channelConfig)
      if (channel) {
        try {
          await channel.send(alert)
        } catch (error) {
          console.error(`Failed to send alert to ${channelConfig.type}:`, error)
        }
      }
    }
  }

  /**
   * Find channel by config
   */
  private findChannel(channelConfig: AlertChannel): AlertChannel | null {
    // Find matching channel by type and config
    for (const [id, channel] of this.channels) {
      if (channel.type === channelConfig.type) {
        return channel
      }
    }
    return null
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, value: number): string {
    const condition = rule.condition
    return `${rule.name}: ${condition.type} is ${value} (threshold: ${condition.threshold})`
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100): AlertEvent[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = []
  }

  // Metric calculation methods (simplified implementations)
  private calculateErrorRate(timeWindow: number, filters?: Record<string, string>): number {
    // In a real implementation, this would query actual metrics
    return Math.random() * 10 // Mock error rate percentage
  }

  private calculateAverageLatency(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 1000 + 100 // Mock latency in ms
  }

  private calculateCostRate(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 10 // Mock cost rate in USD/hour
  }

  private calculateTokenUsage(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 10000 // Mock token usage
  }

  private calculateQuotaUsage(filters?: Record<string, string>): number {
    return Math.random() * 100 // Mock quota usage percentage
  }

  private calculateCacheMissRate(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 50 // Mock cache miss rate percentage
  }

  private calculateAgentFailureRate(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 5 // Mock agent failure rate percentage
  }

  private calculateProviderHealth(timeWindow: number, filters?: Record<string, string>): number {
    return Math.random() * 100 // Mock provider health score
  }
}

/**
 * Global alert manager instance
 */
let globalAlertManager: AlertManager | null = null

/**
 * Get global alert manager
 */
export function getAlertManager(): AlertManager {
  if (!globalAlertManager) {
    globalAlertManager = new AlertManager()
  }
  return globalAlertManager
}

/**
 * Configure alerts
 */
export function configureAlerts(config: {
  rules: AlertRule[]
  channels?: { id: string; channel: AlertChannel }[]
  monitoringInterval?: number
}): void {
  const manager = getAlertManager()

  // Add rules
  config.rules.forEach(rule => manager.addRule(rule))

  // Add channels
  config.channels?.forEach(({ id, channel }) => manager.addChannel(id, channel))

  // Start monitoring
  manager.startMonitoring(config.monitoringInterval)
}

/**
 * Create common alert rules
 */
export function createCommonAlertRules(): AlertRule[] {
  return [
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds 5% over 5 minutes',
      condition: {
        type: AlertType.ERROR_RATE,
        threshold: 5,
        timeWindow: 5,
        comparison: 'greater_than'
      },
      severity: AlertSeverity.WARNING,
      enabled: true,
      cooldown: 15,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'high-latency',
      name: 'High Latency',
      description: 'Average latency exceeds 2 seconds over 5 minutes',
      condition: {
        type: AlertType.LATENCY,
        threshold: 2000,
        timeWindow: 5,
        comparison: 'greater_than'
      },
      severity: AlertSeverity.WARNING,
      enabled: true,
      cooldown: 10,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'high-cost',
      name: 'High Cost Rate',
      description: 'Cost rate exceeds $5/hour',
      condition: {
        type: AlertType.COST,
        threshold: 5,
        timeWindow: 60,
        comparison: 'greater_than'
      },
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      cooldown: 30,
      channels: [{ type: 'console', config: {} }]
    },
    {
      id: 'quota-warning',
      name: 'Quota Usage Warning',
      description: 'Quota usage exceeds 80%',
      condition: {
        type: AlertType.QUOTA_USAGE,
        threshold: 80,
        timeWindow: 1,
        comparison: 'greater_than'
      },
      severity: AlertSeverity.WARNING,
      enabled: true,
      cooldown: 60,
      channels: [{ type: 'console', config: {} }]
    }
  ]
}