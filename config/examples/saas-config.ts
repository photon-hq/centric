/**
 * SaaS Platform Configuration Example
 * 
 * To use this config:
 * 1. Replace the content of config/company.ts with this configuration
 * 2. Update the products array with your actual subscription plans
 * 3. Add relevant documents to the documents/ folder
 * 4. Run the agent: bun run tax-support-agent.ts
 */

import { CompanyConfig } from '../company'

export const SAAS_CONFIG: CompanyConfig = {
  name: 'DataFlow Analytics',
  industry: 'SaaS',
  description: 'AI-powered customer support for enterprise data analytics platform',
  greeting: 'Hi! I\'m the DataFlow Analytics support assistant. 📊 I can help you with platform questions, explain our features, assist with subscription upgrades, and troubleshoot issues. How can I help?',
  supportedLanguages: ['en'],
  features: [
    'Plan comparisons',
    'Feature explanations',
    'Technical troubleshooting',
    'Subscription management',
    'Integration support'
  ],
  policies: {
    returnPolicy: '14-day money-back guarantee on annual plans',
    shippingPolicy: 'Digital delivery - instant access upon payment',
    warrantyPolicy: '99.9% uptime SLA for Enterprise plans'
  }
}

// Example subscription plans for a SaaS platform
export const SAAS_PRODUCTS = [
  {
    id: 'plan-starter',
    name: 'Starter Plan',
    description: 'Perfect for individuals and small teams just getting started with data analytics.',
    price: 29,
    negotiable: false,
    category: 'Monthly Subscription',
    features: [
      'Up to 5 users',
      '10GB data storage',
      'Basic analytics dashboards',
      'Email support',
      '50 API calls/day'
    ]
  },
  {
    id: 'plan-professional',
    name: 'Professional Plan',
    description: 'Advanced features for growing teams with serious data needs.',
    price: 99,
    negotiable: true,
    category: 'Monthly Subscription',
    features: [
      'Up to 25 users',
      '100GB data storage',
      'Advanced analytics & custom dashboards',
      'Priority email & chat support',
      '1,000 API calls/day',
      'Custom integrations',
      'Data export functionality'
    ]
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise Plan',
    description: 'Enterprise-grade solution with unlimited scale and dedicated support.',
    price: 499,
    negotiable: true,
    category: 'Monthly Subscription',
    features: [
      'Unlimited users',
      'Unlimited data storage',
      'White-label dashboards',
      '24/7 phone & chat support',
      'Unlimited API calls',
      'Custom integrations & SSO',
      'Dedicated account manager',
      '99.9% uptime SLA',
      'On-premise deployment option'
    ]
  },
  {
    id: 'addon-ai',
    name: 'AI Insights Add-on',
    description: 'Machine learning powered predictive analytics and automated insights.',
    price: 199,
    negotiable: false,
    category: 'Add-on',
    features: [
      'Predictive analytics',
      'Automated anomaly detection',
      'Natural language queries',
      'Custom ML models',
      'Works with any plan'
    ]
  },
  {
    id: 'addon-premium-support',
    name: 'Premium Support Package',
    description: '24/7 dedicated support with 1-hour response time guarantee.',
    price: 299,
    negotiable: true,
    category: 'Add-on',
    features: [
      '24/7 priority support',
      '1-hour response time',
      'Dedicated support engineer',
      'Quarterly training sessions',
      'Custom onboarding'
    ]
  }
]

// Example knowledge base document content
export const SAAS_KB_EXAMPLE = `
# DataFlow Analytics Support Documentation

## Platform Overview

DataFlow Analytics is a powerful data analytics platform that helps businesses make data-driven decisions through intuitive dashboards, advanced analytics, and machine learning capabilities.

## Getting Started

### Account Setup
1. Sign up at dataflow.com/signup
2. Verify your email address
3. Complete the onboarding wizard
4. Invite team members (if applicable)
5. Connect your data sources

### Data Sources
We support integration with 100+ data sources including:
- Databases: PostgreSQL, MySQL, MongoDB, Snowflake, BigQuery
- Cloud Storage: AWS S3, Google Cloud Storage, Azure Blob
- SaaS Applications: Salesforce, HubSpot, Stripe, Google Analytics
- Custom APIs via REST or GraphQL

## Features by Plan

### Starter Plan ($29/month)
- 5 users maximum
- 10GB data storage
- Pre-built dashboard templates
- Email support (24-48 hour response)
- 50 API calls per day

### Professional Plan ($99/month)
- 25 users maximum
- 100GB data storage
- Custom dashboard builder with 50+ widgets
- Priority support (4-8 hour response)
- 1,000 API calls per day
- Custom data connectors
- CSV/Excel export
- Scheduled reports

### Enterprise Plan ($499/month)
- Unlimited users
- Unlimited storage
- White-label dashboards
- 24/7 phone support (1-hour response)
- Unlimited API calls
- SSO (SAML, OAuth)
- Advanced security features
- Dedicated account manager
- On-premise deployment option
- 99.9% uptime SLA

## Common Tasks

### Creating a Dashboard
1. Navigate to Dashboards → New Dashboard
2. Choose a template or start blank
3. Add widgets by clicking "Add Widget"
4. Configure data sources for each widget
5. Customize colors, filters, and date ranges
6. Save and share with your team

### Connecting Data Sources
1. Go to Settings → Data Sources
2. Click "Add Data Source"
3. Select your data source type
4. Enter connection credentials
5. Test connection
6. Save and start querying

### Inviting Team Members
1. Go to Settings → Team
2. Click "Invite Member"
3. Enter email address
4. Select role (Admin, Editor, Viewer)
5. Send invitation
6. They'll receive an email to join

## API Documentation

### Authentication
All API requests require authentication using an API key:
```
Authorization: Bearer YOUR_API_KEY
```

### Rate Limits
- Starter: 50 requests/day
- Professional: 1,000 requests/day
- Enterprise: Unlimited

### Common Endpoints
- GET /api/v1/dashboards - List all dashboards
- POST /api/v1/query - Execute a data query
- GET /api/v1/users - List team members

## Billing & Subscriptions

### Payment Methods
We accept all major credit cards and ACH transfers for annual plans.

### Upgrade/Downgrade
You can change your plan at any time:
- Upgrades take effect immediately
- Downgrades take effect at the end of the billing cycle
- Pro-rated refunds for annual plans

### Refund Policy
- 14-day money-back guarantee on annual plans
- Monthly plans are non-refundable but can be cancelled anytime

## Troubleshooting

### Data Not Updating
1. Check data source connection status
2. Verify API credentials haven't expired
3. Check rate limits
4. Review query logs for errors

### Dashboard Loading Slowly
1. Reduce date range for queries
2. Optimize complex calculations
3. Enable caching in dashboard settings
4. Contact support if issues persist

### Can't Invite Team Members
1. Verify you have remaining seats on your plan
2. Check that you have Admin permissions
3. Ensure email address is valid
4. Check spam folder for invitation emails

## Support Channels

- Email: support@dataflow.com
- Live Chat: Available in-app (Professional & Enterprise)
- Phone: 1-800-DATA-FLOW (Enterprise only)
- Documentation: docs.dataflow.com
- Community Forum: community.dataflow.com

Response Times:
- Starter: 24-48 hours
- Professional: 4-8 hours
- Enterprise: 1 hour (24/7 support)
`
