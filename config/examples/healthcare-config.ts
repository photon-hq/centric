/**
 * Healthcare Services Configuration Example
 * 
 * To use this config:
 * 1. Replace the content of config/company.ts with this configuration
 * 2. Update the products array with your actual medical services
 * 3. Add relevant documents to the documents/ folder
 * 4. Run the agent: bun run tax-support-agent.ts
 * 
 * IMPORTANT: This is a demonstration only. Real healthcare support systems
 * require HIPAA compliance, proper security measures, and should never
 * provide medical advice without licensed healthcare professionals.
 */

import { CompanyConfig } from '../company'

export const HEALTHCARE_CONFIG: CompanyConfig = {
  name: 'WellCare Health',
  industry: 'Healthcare',
  description: 'AI-powered administrative support for scheduling, billing, and general inquiries',
  greeting: 'Welcome to WellCare Health! 🏥 I\'m your administrative assistant. I can help with appointment scheduling, billing questions, and general information about our services. For medical emergencies, please call 911. How can I assist you today?',
  supportedLanguages: ['en'],
  features: [
    'Appointment scheduling',
    'Insurance verification',
    'Billing inquiries',
    'Service information',
    'Location & hours'
  ],
  policies: {
    returnPolicy: 'Appointment cancellations require 24-hour notice',
    shippingPolicy: 'Medical records delivered via secure patient portal',
    warrantyPolicy: 'All care provided by licensed healthcare professionals'
  }
}

// Example services for a healthcare provider
export const HEALTHCARE_PRODUCTS = [
  {
    id: 'service-001',
    name: 'Primary Care Visit',
    description: 'Comprehensive primary care appointment with a licensed physician.',
    price: 150,
    negotiable: false,
    category: 'Medical Services',
    features: [
      '30-minute appointment',
      'Licensed physician',
      'Basic diagnostic tests',
      'Treatment plan development',
      'Insurance accepted'
    ]
  },
  {
    id: 'service-002',
    name: 'Annual Physical Exam',
    description: 'Complete annual physical examination and health assessment.',
    price: 250,
    negotiable: false,
    category: 'Medical Services',
    features: [
      '60-minute comprehensive exam',
      'Blood work & lab tests',
      'Health screening',
      'Wellness counseling',
      'Immunization review',
      'Often covered by insurance'
    ]
  },
  {
    id: 'service-003',
    name: 'Specialist Consultation',
    description: 'Consultation with a board-certified specialist physician.',
    price: 300,
    negotiable: false,
    category: 'Medical Services',
    features: [
      '45-minute consultation',
      'Board-certified specialist',
      'Diagnostic review',
      'Treatment recommendations',
      'Referral if needed'
    ]
  },
  {
    id: 'service-004',
    name: 'Telemedicine Visit',
    description: 'Virtual healthcare appointment via secure video call.',
    price: 75,
    negotiable: false,
    category: 'Telehealth',
    features: [
      '15-20 minute video call',
      'Licensed provider',
      'E-prescriptions available',
      'Convenient from home',
      'Available 7 days/week'
    ]
  },
  {
    id: 'service-005',
    name: 'Wellness Package',
    description: 'Comprehensive wellness program with preventive care services.',
    price: 500,
    negotiable: true,
    category: 'Wellness Programs',
    features: [
      '4 wellness visits per year',
      'Nutritional counseling',
      'Fitness assessment',
      'Mental health screening',
      'Personalized wellness plan',
      'Health coaching'
    ]
  },
  {
    id: 'service-006',
    name: 'Concierge Medicine Membership',
    description: 'Premium healthcare membership with enhanced access and services.',
    price: 2500,
    negotiable: true,
    category: 'Membership',
    features: [
      'Same-day appointments',
      '24/7 physician access',
      'Unlimited office visits',
      'Extended appointment times',
      'Comprehensive physicals',
      'Care coordination',
      'Annual membership'
    ]
  }
]

// Example knowledge base document content
export const HEALTHCARE_KB_EXAMPLE = `
# WellCare Health Administrative Information

## Important Notice
This AI assistant provides administrative support only. For medical emergencies, call 911. For urgent medical questions, contact your physician directly or use our 24/7 nurse line at 1-800-WELLCARE.

## Office Locations & Hours

### Main Campus
123 Healthcare Drive, Suite 200
Medical City, MC 12345
Phone: (555) 123-4567

Hours:
- Monday-Friday: 7:00 AM - 7:00 PM
- Saturday: 8:00 AM - 2:00 PM
- Sunday: Closed

### North Clinic
456 Wellness Boulevard
North Town, MC 12346
Phone: (555) 234-5678

Hours:
- Monday-Friday: 8:00 AM - 6:00 PM
- Saturday-Sunday: Closed

## Scheduling Appointments

### New Patients
New patients should call (555) 123-4567 to schedule. Please have ready:
- Photo ID
- Insurance card
- List of current medications
- Medical history (if available)

### Existing Patients
Book appointments through:
- Patient portal: portal.wellcare.com
- Phone: (555) 123-4567
- Mobile app: WellCare Health App

### Appointment Types
- Primary Care Visit: 30 minutes
- Annual Physical: 60 minutes
- Specialist Consultation: 45 minutes
- Telemedicine Visit: 15-20 minutes
- Follow-up Visit: 15 minutes

### Cancellation Policy
Please provide 24-hour notice for cancellations. Late cancellations or no-shows may result in a $50 fee.

## Insurance & Billing

### Accepted Insurance
We accept most major insurance plans including:
- Blue Cross Blue Shield
- UnitedHealthcare
- Aetna
- Cigna
- Medicare
- Medicaid

### Verification
Please call (555) 123-4567 x2 to verify your insurance coverage before your appointment.

### Payment Options
- Insurance (check coverage first)
- Credit/debit cards
- Health Savings Account (HSA)
- Flexible Spending Account (FSA)
- Payment plans available

### Billing Questions
Contact our billing department:
- Phone: (555) 123-4567 x3
- Email: billing@wellcare.com
- Hours: Monday-Friday, 8:00 AM - 5:00 PM

## Patient Portal

### Features
- View test results
- Request prescription refills
- Schedule appointments
- Message your care team
- View billing statements
- Update personal information

### Registration
1. Visit portal.wellcare.com
2. Click "Register"
3. Enter your date of birth and account number
4. Create username and password
5. Set up security questions

## Medical Records

### Requesting Records
Submit requests through:
- Patient portal
- Email: records@wellcare.com
- Fax: (555) 123-4599
- Mail: Medical Records, 123 Healthcare Drive, Medical City, MC 12345

### Processing Time
Records requests are processed within 7-10 business days. Rush requests (2-3 days) available for $25 fee.

### Delivery Methods
- Patient portal (secure, instant)
- Secure email (if available)
- Mail (standard)
- CD-ROM ($10 fee)

## Prescription Refills

### Requesting Refills
- Patient portal (preferred)
- Phone: (555) 123-4567 x4
- Through your pharmacy

### Processing Time
Allow 24-48 hours for refill requests. Do not wait until you're completely out of medication.

### Controlled Substances
Controlled substance refills require an office visit or telemedicine appointment.

## Telemedicine Services

### Availability
Daily, 7:00 AM - 10:00 PM (including weekends)

### How It Works
1. Schedule through patient portal or phone
2. You'll receive a secure video link via email
3. Join the call at your appointment time
4. Physician conducts virtual examination
5. E-prescriptions sent to your pharmacy if needed

### Best For
- Minor illnesses (cold, flu, allergies)
- Follow-up visits
- Medication management
- Routine check-ins
- Non-emergency conditions

## Wellness Programs

### Annual Wellness Package
$500/year includes:
- 4 wellness visits
- Nutritional counseling
- Fitness assessment
- Mental health screening
- Personalized wellness plan
- Health coaching sessions

### Concierge Medicine Membership
$2,500/year premium membership includes:
- Unlimited office visits
- Same-day appointments
- 24/7 physician access
- Extended appointment times
- Comprehensive annual physical
- Care coordination
- Direct physician cell phone access

## Patient Rights & Privacy

### HIPAA Compliance
WellCare Health strictly adheres to HIPAA regulations to protect your health information.

### Your Rights
- Right to access your medical records
- Right to request corrections
- Right to privacy
- Right to confidential communications
- Right to file a complaint

## Contact Information

### General Inquiries
Phone: (555) 123-4567
Email: info@wellcare.com

### Appointments
Phone: (555) 123-4567 x1
Or use patient portal

### Billing
Phone: (555) 123-4567 x3
Email: billing@wellcare.com

### Medical Records
Phone: (555) 123-4567 x5
Email: records@wellcare.com

### 24/7 Nurse Line
Phone: 1-800-WELLCARE

### After-Hours Emergencies
For life-threatening emergencies, call 911
For urgent after-hours care, call (555) 123-URGENT
`
