# Configuration Examples

This folder contains example configurations for different industries to demonstrate how to adapt the customer support agent for your specific use case.

## Available Examples

### 1. E-Commerce Store (`ecommerce-config.ts`)
**Industry:** Online Retail  
**Use Case:** Product recommendations, order tracking, returns & exchanges  
**Products:** Physical goods (clothing, accessories)  
**Features:** Size guides, shipping info, return policies

### 2. SaaS Platform (`saas-config.ts`)
**Industry:** Software as a Service  
**Use Case:** Subscription management, feature support, troubleshooting  
**Products:** Subscription plans and add-ons  
**Features:** API documentation, billing support, technical help

### 3. Healthcare Services (`healthcare-config.ts`)
**Industry:** Medical Services  
**Use Case:** Appointment scheduling, billing inquiries, administrative support  
**Products:** Medical services and wellness programs  
**Features:** Insurance verification, patient portal, HIPAA compliance notice

## How to Use These Examples

### Option 1: Replace Entire Configuration

1. **Choose your example** based on your industry
2. **Copy the config** from the example file
3. **Replace** the content of `config/company.ts` with the example config:

```bash
# For e-commerce
cp config/examples/ecommerce-config.ts config/company.ts

# For SaaS
cp config/examples/saas-config.ts config/company.ts

# For healthcare
cp config/examples/healthcare-config.ts config/company.ts
```

4. **Update products** in `lib/product-catalog.ts` with your actual products
5. **Add documents** to the `documents/` folder with your company's information
6. **Run the agent**: `bun run tax-support-agent.ts`

### Option 2: Mix and Match

You can also take pieces from different examples and combine them:

```typescript
// config/company.ts
import { CompanyConfig } from './company'

export const COMPANY_CONFIG: CompanyConfig = {
  name: 'Your Company Name',
  industry: 'Your Industry',
  description: 'Your description', // Use examples as inspiration
  greeting: 'Your custom greeting', // Adapt from examples
  supportedLanguages: ['en'],
  features: [
    // Pick relevant features from examples
    'Feature 1',
    'Feature 2',
  ],
  policies: {
    returnPolicy: 'Your policy',
    shippingPolicy: 'Your policy',
    warrantyPolicy: 'Your policy'
  }
}
```

### Option 3: Create Your Own

Use the `CompanyConfig` interface as a guide:

```typescript
interface CompanyConfig {
  name: string                    // Your company name
  industry: string                // Your industry
  description: string             // Brief description for UI
  greeting: string                // AI assistant greeting message
  supportedLanguages: string[]    // Languages (currently ['en'])
  features: string[]              // Key features of your service
  policies: {
    returnPolicy: string          // Your return/cancellation policy
    shippingPolicy: string        // Delivery/fulfillment policy
    warrantyPolicy: string        // Warranty/guarantee policy
  }
}
```

## Customizing Products

Each example includes sample products. Update `lib/product-catalog.ts` with your actual offerings:

```typescript
export const products = [
  {
    id: 'unique-id',
    name: 'Product/Service Name',
    description: 'Detailed description',
    price: 99.99,
    negotiable: true,  // or false for fixed pricing
    category: 'Category Name',
    features: [
      'Feature 1',
      'Feature 2',
      'Feature 3'
    ]
  },
  // Add more products...
]
```

## Adding Knowledge Base Documents

The examples include sample knowledge base content. For your implementation:

1. Create `.txt` or `.md` files in the `documents/` folder
2. Include information about:
   - Company policies
   - Product/service details
   - FAQs
   - Pricing information
   - Contact information
   - Terms and conditions

Example structure:
```
documents/
├── company-overview.txt
├── product-catalog.txt
├── shipping-policy.txt
├── return-policy.txt
├── faq.txt
└── contact-info.txt
```

## Testing Your Configuration

After setting up your configuration:

1. **Test the iMessage agent**:
   ```bash
   bun run tax-support-agent.ts
   ```

2. **Test the web dashboard**:
   ```bash
   cd dashboard
   ./start.sh
   ```

3. **Try common queries**:
   - "What services do you offer?"
   - "How much does [product] cost?"
   - "Can you give me a discount?"
   - "I'd like to purchase [product]"

## Industry-Specific Considerations

### E-Commerce
- Focus on product discovery and recommendations
- Include detailed shipping and return policies
- Add size guides and product specifications
- Consider multi-language support for international customers

### SaaS
- Emphasize feature explanations and comparisons
- Include API documentation and technical guides
- Focus on subscription management and billing
- Provide troubleshooting support

### Healthcare
- **CRITICAL**: Never provide medical advice
- Focus on administrative support only
- Include emergency disclaimers prominently
- Ensure HIPAA compliance for production use
- Add appointment scheduling functionality

### Other Industries
- **Financial Services**: Add compliance disclaimers, focus on account management
- **Education**: Emphasize course information, enrollment, scheduling
- **Real Estate**: Property listings, showing appointments, documentation
- **Legal Services**: Practice areas, consultation scheduling (no legal advice)

## Need Help?

- Review the main README for complete setup instructions
- Check `config/prompts.ts` to customize AI responses
- See `lib/product-catalog.ts` for product management
- Examine `lib/vector-store.ts` for RAG implementation

## Contributing

If you create a configuration for a new industry, consider sharing it! Submit a pull request with your example configuration and knowledge base content.
