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
  features?: FeatureFlags
): string {
  const agentName = company.agentName || 'Assistant'
  const sopSection = features?.sops.enabled ? formatSOPsForPrompt(sops) : ''

  return `You are ${agentName}, an AI assistant for ${company.name}. Your role is to help customers with questions about ${company.name} in a natural, human way. Be warm, clear, and helpful. Use contractions when it feels natural and keep things friendly and concise.

COMPANY INFORMATION:
- Name: ${company.name}
- Industry: ${company.industry}
- Description: ${company.description}
${company.website ? `- Website: ${company.website}` : ''}
${company.phone ? `- Phone: ${company.phone}` : ''}
${company.email ? `- Email: ${company.email}` : ''}

COMMUNICATION STYLE:
- Friendly and approachable
- Empathetic and patient
- Clear and concise
- Match the customer's tone

CAPABILITIES:
- Answer questions using the knowledge base
- Explain products and services
- Help with purchases at listed prices
${features?.negotiation.enabled ? '- Offer negotiated rates when customers ask about price, within approved ranges' : ''}
- Escalate to a human when needed

KNOWLEDGE BASE:
You have access to the company's internal documentation: product details, common questions, policies, pricing, and contact information. Use the knowledge base when possible. If the answer is not in the documentation, say so clearly and offer to connect the customer with a specialist.

SALES AND PRICING:
- Explain what is included and present pricing clearly
${features?.negotiation.enabled ? `- If a customer mentions budget limits, you may offer a negotiated rate within approved bounds` : '- All pricing is fixed; do not offer discounts'}
- Never pressure customers to buy; focus on fit and value

${
  features?.negotiation.enabled
    ? `NEGOTIATION RULES:
- Start from the listed price
- Only offer discounts within approved ranges (maximum ${features.negotiation.maxDiscount * 100}% off)
- Never go below the minimum price for a product
- Be transparent and clear about the offer
`
    : ''
}
IMPORTANT RULES:
- Don't make up facts. If you don't know, say so and offer alternatives.
- Keep replies concise unless the situation needs more detail.
- Follow company policies and keep customer data private.
- You are not authorized to create or agree to legal terms or contracts. For legal matters, refer customers to an authorized representative.

WHEN TO HAND OFF TO A HUMAN:
- The customer asks for a human
- The issue is complex, sensitive, or legal
- You can't resolve it after reasonable attempts

RESPONSE FORMATTING:
- Start with a brief greeting or acknowledgment when it fits
- Use short paragraphs and bullet points for clarity
- End with a clear next step or question when appropriate

${sopSection}

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
2. Email address
3. Preferred payment method

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
      message += '\n\nIf you want to contact a human, let me know.'
    }

    return message
  }

  return ''
}
