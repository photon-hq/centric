/**
 * Prompts Module
 * Template-based prompt generation with variable substitution
 */

import type { CompanyConfig, SOP, FeatureFlags } from '../types/index.js'

/**
 * Substitute template variables in a string
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, String(value))
  }
  return result
}

/**
 * Format SOPs for inclusion in system prompt
 */
export function formatSOPsForPrompt(sops: SOP[]): string {
  if (sops.length === 0) return ''

  let sopText =
    '\n\nSTANDARD OPERATING PROCEDURES (SOPs):\nFollow these procedures when handling specific customer situations:\n\n'

  sops.forEach((sop, index) => {
    sopText += `### SOP ${index + 1}: ${sop.title}\n`
    sopText += `**Objective:** ${sop.objective}\n`
    sopText += `**Trigger:** ${sop.trigger}\n`
    sopText += `**Steps:**\n`
    sop.steps.forEach((step, stepIndex) => {
      sopText += `  ${stepIndex + 1}. ${step}\n`
    })
    sopText += '\n'
  })

  return sopText
}

/**
 * Generate the system prompt based on company configuration
 */
export function generateSystemPrompt(
  company: CompanyConfig,
  sops: SOP[] = [],
  features?: FeatureFlags,
  customerPhoneNumber?: string
): string {
  const agentName = company.agentName || 'Assistant'
  const sopSection = features?.sops.enabled ? formatSOPsForPrompt(sops) : ''
  const customerContext = customerPhoneNumber ? `\n\nCUSTOMER CONTACT INFORMATION:\nThis customer is texting you from: ${customerPhoneNumber}` : ''

  return `
COMPANY INFORMATION:
- Name: ${company.name}
- Industry: ${company.industry}
- Description: ${company.description}
${company.website ? `- Website: ${company.website}
` : ''}${company.phone ? `- Phone: ${company.phone}
` : ''}${company.email ? `- Email: ${company.email}
` : ''}

Tone and approach:
- Be friendly, human, and concise. Use natural language and contractions when appropriate.
- Show empathy and stay calm, even if the customer is upset.
- Focus on clear, actionable answers and next steps.

What you can do:
- Use the knowledge base and SOPs to answer questions.
- Explain products, pricing, and features.
- Help customers start purchases or request human help when needed.

When information isn't available:
- Say you don't have that detail, offer related options, and suggest connecting to a specialist if needed.

Pricing and negotiations:
- Present prices clearly. Only offer negotiated rates when policies allow it.
${features?.negotiation.enabled ? `- Negotiation rules: follow approved discounts and never go below minimums.` : ''}

Safety & policy:
- Don't invent facts. If unsure, say so and propose safe alternatives.
- Protect customer data. Never ask for passwords or full credit card numbers in chat.
- For legal or high-security matters, escalate to a human.

When to hand off to a human:
- Customer asks explicitly for a human.
- Issue is sensitive, legal, or requires privileged access.
- AI can't resolve after reasonable attempts.

How to format replies:
- Start with a short acknowledgement when it helps.
- Use short paragraphs and bullet points for clarity.
- End with a clear next step or a question to move the conversation forward.

${sopSection}

${customerContext}

Remember: be helpful, build trust, and make it easy for the customer to get the help they need.`
}

/**
 * Generate context prompt for RAG results
 */
export function generateContextPrompt(
  documentContext: string,
  productContext: string = ''
): string {
  return `
RETRIEVED KNOWLEDGE BASE:
${documentContext}
${productContext ? `\n\nRELEVANT PRODUCT INFORMATION:\n${productContext}` : ''}

Use this information to provide accurate, helpful responses. If the information isn't in the knowledge base, say so clearly and offer alternative assistance.`
}

/**
 * Generate negotiation response
 */
export function generateNegotiationResponse(
  productName: string,
  regularPrice: number,
  offeredPrice: number,
  features: string[],
  discountPercent: number,
  validityHours: number = 24
): string {
  return `I completely understand budget considerations! For ${productName}, I can offer you a special rate of $${offeredPrice} (regular price: $${regularPrice}). This ${discountPercent}% discount is the best I can do while ensuring you get our full premium service.

What's included:
${features.map((f) => `✓ ${f}`).join('\n')}

This offer is valid for the next ${validityHours} hours. Would you like to proceed at this rate?`
}

/**
 * Generate purchase confirmation response
 */
export function generatePurchaseResponse(
  company: CompanyConfig,
  productName: string,
  price: number,
  responseTimeMinutes: number = 60
): string {
  const agentName = company.agentName || 'Assistant'
  const responseTimeHours = Math.ceil(responseTimeMinutes / 60)

  return `Great! I'll help you get started with ${productName} at $${price}.

To complete your purchase, I'll need:
1. Your full name
2. Preferred payment method

Our team will contact you within ${responseTimeHours} business hour${responseTimeHours > 1 ? 's' : ''} to finalize the details and get you set up.

Please reply with your information, and we'll get you started right away!${company.phone ? `\n\nFor immediate assistance, you can also call us at ${company.phone}` : ''}`
}

/**
 * Generate fixed-price response
 */
export function generateFixedPriceResponse(productName: string, price: number): string {
  return `I appreciate your interest! However, ${productName} is offered at a fixed price of $${price}. This is already our best rate for this comprehensive service. The pricing ensures we can deliver the highest quality while keeping it accessible.

Would you like to proceed with the purchase at this price? I'm happy to explain more about what's included and why it's valuable.`
}

/**
 * Generate error/fallback response
 */
export function generateErrorResponse(company: CompanyConfig): string {
  return `I apologize, but I'm experiencing technical difficulties at the moment. Please try again in a moment${company.phone ? `, or call us at ${company.phone}` : ''}${company.email ? `, or email ${company.email}` : ''} for immediate assistance.`
}

/**
 * Generate greeting message
 */
export function generateGreeting(company: CompanyConfig, isFirstMessage: boolean = false): string {
  if (!isFirstMessage) return ''

  const greeting = company.greeting

  // Handle legacy string greeting
  if (typeof greeting === 'string') {
    return greeting
  }

  // Use template with variable substitution
    if (greeting.enabled && greeting.template) {
    const variables = {
      agentName: company.agentName || 'Assistant',
      companyName: company.name,
      industry: company.industry
    }
    
    let message = substituteVariables(greeting.template, variables)

    if (greeting.showHumanEscalation) {
      message += "\n\nIf you'd like to speak with a human, just say so and we'll connect you."
    }

    return message
  }

  return ''
}
