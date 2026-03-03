/**
 * Company Configuration
 * 
 * Customize this file to adapt the agent for your specific company
 */

export interface CompanyConfig {
  name: string
  industry: string
  description: string
  website?: string
  phone?: string
  email?: string
  features: string[]
  greeting: string
}

/**
 * Current company configuration - Edit this to change the agent's company
 */
export const COMPANY_CONFIG: CompanyConfig = {
  name: 'TaxPro Tax Services',
  industry: 'Tax Preparation and Planning',
  description: 'Professional tax services for individuals and businesses',
  website: 'taxpro.com',
  phone: '1-800-TAXPRO (829-7776)',
  email: 'support@taxpro.com',
  features: [
    'Tax filing for individuals and businesses',
    'Tax planning consultation',
    'IRS audit defense and representation',
    'Prior year returns and amendments',
    'State tax returns',
    'Extension filing'
  ],
  greeting: 'Hello! I\'m your AI Assistant. I can help you with questions, explain our services, and assist with purchases. How can I help you today?'
}

/**
 * Example: E-commerce company
 */
export const ECOMMERCE_EXAMPLE: CompanyConfig = {
  name: 'ShopElite',
  industry: 'E-commerce Retail',
  description: 'Premium online shopping with fast delivery',
  website: 'shopelite.com',
  phone: '1-800-SHOP-NOW',
  email: 'support@shopelite.com',
  features: [
    'Product recommendations',
    'Order tracking and support',
    'Returns and refunds',
    'Account management',
    'Loyalty program assistance',
    'Gift card support'
  ],
  greeting: 'Hi! I\'m the ShopElite Assistant. I\'m here to help you with orders, products, returns, or any questions you have. What can I help you with today?'
}

/**
 * Example: SaaS company
 */
export const SAAS_EXAMPLE: CompanyConfig = {
  name: 'CloudFlow',
  industry: 'SaaS / Productivity Software',
  description: 'Cloud-based workflow automation platform',
  website: 'cloudflow.io',
  phone: '1-855-CLOUD-HQ',
  email: 'help@cloudflow.io',
  features: [
    'Account setup and onboarding',
    'Feature tutorials and guides',
    'Billing and subscription support',
    'Integration assistance',
    'Troubleshooting technical issues',
    'Plan upgrades and downgrades'
  ],
  greeting: 'Hey there! I\'m the CloudFlow Support Bot. I can help you with setup, features, billing, or any technical questions. What brings you here today?'
}

/**
 * Example: Healthcare provider
 */
export const HEALTHCARE_EXAMPLE: CompanyConfig = {
  name: 'MediCare Plus',
  industry: 'Healthcare Services',
  description: 'Comprehensive healthcare services and support',
  website: 'medicareplus.health',
  phone: '1-800-MEDI-CARE',
  email: 'support@medicareplus.health',
  features: [
    'Appointment scheduling',
    'Prescription refill requests',
    'Insurance verification',
    'Medical records access',
    'Billing inquiries',
    'General health information'
  ],
  greeting: 'Hello! I\'m the MediCare Plus Assistant. I can help you schedule appointments, request prescription refills, verify insurance, or answer general questions. How may I assist you?'
}
