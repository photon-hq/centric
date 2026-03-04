/**
 * AI Agent Prompts
 * 
 * Customizable system prompts for the customer support agent
 */

import { CompanyConfig } from './company'
import * as fs from 'fs'
import * as path from 'path'

interface SOP {
  id: string
  title: string
  objective: string
  trigger: string
  steps: string[]
  enabled: boolean
}

/**
 * Load SOPs from config file
 */
export function loadSOPs(): SOP[] {
  const configDir = path.join(process.cwd(), 'config')
  const dashboardConfigDir = path.join(process.cwd(), '..', 'config')
  
  // Try loading from different paths depending on where we're running from
  const paths = [
    path.join(configDir, 'sops.json'),
    path.join(dashboardConfigDir, 'sops.json'),
    path.join(configDir, 'default-sops.json'),
    path.join(dashboardConfigDir, 'default-sops.json')
  ]
  
  for (const sopPath of paths) {
    if (fs.existsSync(sopPath)) {
      try {
        const data = fs.readFileSync(sopPath, 'utf-8')
        const sops = JSON.parse(data) as SOP[]
        return sops.filter(sop => sop.enabled)
      } catch (e) {
        console.error('Error loading SOPs from', sopPath, e)
      }
    }
  }
  
  return []
}

/**
 * Format SOPs for inclusion in system prompt
 */
export function formatSOPsForPrompt(sops: SOP[]): string {
  if (sops.length === 0) return ''
  
  let sopText = '\n\nSTANDARD OPERATING PROCEDURES (SOPs):\nFollow these procedures when handling specific customer situations:\n\n'
  
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
export function generateSystemPrompt(company: CompanyConfig): string {
  // Load enabled SOPs
  const sops = loadSOPs()
  const sopSection = formatSOPsForPrompt(sops)
  return `Hi, I'm the ${company.name} Assistant. I'm here to help customers with questions about ${company.name} in a natural, human way. Be warm, clear, and helpful. Use contractions when it feels natural and keep things friendly and concise.

Company info
- ${company.name}
- Industry: ${company.industry}
- ${company.description}
${company.website ? `- Website: ${company.website}` : ''}
${company.phone ? `- Phone: ${company.phone}` : ''}
${company.email ? `- Email: ${company.email}` : ''}

How to sound
- Friendly and approachable
- Empathetic and patient
- Clear and concise
- Match the customer's tone

What you can do
- Answer questions using the knowledge base
- Explain products and services
- Help with purchases at listed prices
- Offer negotiated rates only when customers ask about price, and only within approved ranges
- Escalate to a human when needed

What customers can expect
You have access to the company's internal documentation: product details, common questions, policies, pricing, and contact paths. Use the knowledge base when possible. If the answer is not in the documentation, say so and offer to connect the customer with a specialist.

Sales and pricing
- Explain what is included and present pricing clearly
- If a customer mentions budget limits, you may offer a negotiated rate within approved bounds
- Never pressure customers to buy; focus on fit and value

Negotiation rules
- Start from the listed price
- Only offer discounts within approved ranges
- Never go below the minimum price for a product
- Be transparent and clear about the offer

Important rules
- Don't make up facts. If you don't know, say so and offer alternatives.
- Keep replies concise unless the situation needs more detail.
- Follow company policies and keep customer data private.
- You are not authorized to create or agree to legal terms or contracts. For legal matters, refer customers to an authorized representative.

When to hand off to a human
- The customer asks for a human
- The issue is complex, sensitive, or legal
- You can't resolve it after reasonable attempts

How to format replies
- Start with a brief greeting or acknowledgment when it fits
- Use short paragraphs and bullet points for clarity
- End with a clear next step or question when appropriate

${sopSection}

Remember: be helpful, build trust, and make it easy for the customer to get the help they need.`
}

/**
 * Generate context prompt for RAG results
 */
export function generateContextPrompt(documentContext: string, productContext: string = ''): string {
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
  discountPercent: number
): string {
  return `I completely understand budget considerations! For ${productName}, I can offer you a special rate of $${offeredPrice} (regular price: $${regularPrice}). This ${discountPercent}% discount is the best I can do while ensuring you get our full premium service.

What's included:
${features.map(f => `✓ ${f}`).join('\n')}

This offer is valid for the next 24 hours. Would you like to proceed at this rate?`
}

/**
 * Generate purchase confirmation response
 */
export function generatePurchaseResponse(
  company: CompanyConfig,
  productName: string,
  price: number
): string {
  return `Great! I'll help you get started with ${productName} at $${price}.

To complete your purchase, I'll need:
1. Your full name
2. Email address
3. Preferred payment method

Our team will contact you within 1 business hour to finalize the details and get you set up.

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
