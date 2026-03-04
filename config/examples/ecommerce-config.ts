/**
 * E-Commerce Store Configuration Example
 * 
 * To use this config:
 * 1. Replace the content of config/company.ts with this configuration
 * 2. Update the products array with your actual products
 * 3. Add relevant documents to the documents/ folder
 * 4. Run the agent: bun run support-agent.ts
 */

import { CompanyConfig } from '../company'

export const ECOMMERCE_CONFIG: CompanyConfig = {
  name: 'StyleHub',
  industry: 'E-commerce',
  description: 'AI-powered customer support with product recommendations and smart assistance',
  greeting: 'Welcome to StyleHub! 👕 I\'m your AI shopping assistant. I can help you find products, answer questions about orders, and assist with purchases. What are you looking for today?',
  supportedLanguages: ['en'],
  features: [
    'Product recommendations',
    'Order tracking',
    'Returns & exchanges',
    'Size & fit guidance',
    'Personalized shopping'
  ],
  policies: {
    returnPolicy: '30-day return policy for unused items',
    shippingPolicy: 'Free shipping on orders over $50',
    warrantyPolicy: '1-year warranty on all products'
  }
}

// Example products for an e-commerce store
export const ECOMMERCE_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Premium Cotton T-Shirt',
    description: 'Soft, breathable 100% organic cotton t-shirt. Available in multiple colors.',
    price: 29.99,
    negotiable: false,
    category: 'Apparel',
    features: [
      '100% organic cotton',
      'Pre-shrunk fabric',
      'Available in XS-3XL',
      'Machine washable'
    ]
  },
  {
    id: 'prod-002',
    name: 'Designer Jeans',
    description: 'Premium denim jeans with modern fit and style.',
    price: 89.99,
    negotiable: true,
    category: 'Apparel',
    features: [
      'Stretch denim blend',
      'Slim/regular fit options',
      'Multiple wash options',
      '5-pocket design'
    ]
  },
  {
    id: 'prod-003',
    name: 'Leather Crossbody Bag',
    description: 'Handcrafted genuine leather crossbody bag with adjustable strap.',
    price: 129.99,
    negotiable: true,
    category: 'Accessories',
    features: [
      'Genuine leather',
      'Adjustable strap',
      'Multiple compartments',
      'Available in 4 colors'
    ]
  },
  {
    id: 'prod-004',
    name: 'Running Sneakers',
    description: 'High-performance running shoes with advanced cushioning.',
    price: 119.99,
    negotiable: false,
    category: 'Footwear',
    features: [
      'Advanced cushioning',
      'Breathable mesh upper',
      'Durable rubber outsole',
      'Available in sizes 6-13'
    ]
  },
  {
    id: 'prod-005',
    name: 'Wool Blend Sweater',
    description: 'Cozy wool blend sweater perfect for fall and winter.',
    price: 69.99,
    negotiable: true,
    category: 'Apparel',
    features: [
      '70% wool, 30% acrylic blend',
      'Ribbed cuffs and hem',
      'Available in S-XXL',
      'Hand wash recommended'
    ]
  }
]

// Example knowledge base document content
export const ECOMMERCE_KB_EXAMPLE = `
# StyleHub Customer Support Knowledge Base

## Shipping Information

### Domestic Shipping
- Standard Shipping (5-7 business days): FREE on orders over $50, otherwise $5.99
- Express Shipping (2-3 business days): $12.99
- Overnight Shipping (1 business day): $24.99

### International Shipping
We ship to over 100 countries worldwide. International shipping rates vary by destination and are calculated at checkout.

## Returns & Exchanges

### Return Policy
StyleHub offers a 30-day return policy on all unused items in original condition with tags attached.

### How to Return
1. Log into your account
2. Go to Order History
3. Select the order and click "Return Items"
4. Print the prepaid shipping label
5. Ship the package within 5 days

### Refund Timeline
Refunds are processed within 5-7 business days after we receive your return.

## Size Guide

### Women's Clothing
- XS: Bust 32-33", Waist 24-25", Hips 34-35"
- S: Bust 34-35", Waist 26-27", Hips 36-37"
- M: Bust 36-37", Waist 28-29", Hips 38-39"
- L: Bust 38-40", Waist 30-32", Hips 40-42"
- XL: Bust 42-44", Waist 34-36", Hips 44-46"

### Men's Clothing
- S: Chest 34-36", Waist 28-30"
- M: Chest 38-40", Waist 32-34"
- L: Chest 42-44", Waist 36-38"
- XL: Chest 46-48", Waist 40-42"
- XXL: Chest 50-52", Waist 44-46"

## Order Tracking

Once your order ships, you'll receive a tracking number via email. You can also track your order by:
1. Logging into your account
2. Visiting the Order History page
3. Clicking on your order number

## Payment Methods

We accept:
- All major credit cards (Visa, Mastercard, American Express, Discover)
- PayPal
- Apple Pay
- Google Pay
- Shop Pay

## Customer Service

- Email: support@stylehub.com
- Phone: 1-800-STYLE-HUB (1-800-789-5348)
- Live Chat: Available Mon-Fri, 9 AM - 6 PM EST
- Response time: Within 24 hours
`
