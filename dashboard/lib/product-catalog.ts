/**
 * Product Catalog
 * 
 * Manages tax service products with pricing and negotiation capabilities
 */

export interface BaseProduct {
    id: string
    name: string
    description: string
    price: number
    features: string[]
    keywords: string[]
}

export interface FixedPriceProduct extends BaseProduct {
    negotiable: false
}

export interface NegotiableProduct extends BaseProduct {
    negotiable: true
    lowestNegotiationPrice: number
}

export type Product = FixedPriceProduct | NegotiableProduct

export class ProductCatalog {
    private products: Map<string, Product> = new Map()
    
    constructor() {
        this.initializeProducts()
    }
    
    /**
     * Initialize the product catalog with tax services
     */
    private initializeProducts() {
        const products: Product[] = [
            // Premium Services (Negotiable)
            {
                id: 'individual-tax-filing',
                name: 'Individual Tax Filing',
                description: 'Complete personal tax return preparation and filing',
                price: 299,
                negotiable: true,
                lowestNegotiationPrice: 249,
                features: [
                    'Complete Form 1040 preparation',
                    'All standard deductions and credits',
                    'State tax return included',
                    'E-filing with IRS',
                    'Audit support guarantee',
                    'Direct deposit setup'
                ],
                keywords: ['individual', 'personal', '1040', 'tax return', 'filing']
            },
            {
                id: 'small-business-tax',
                name: 'Small Business Tax Package',
                description: 'Comprehensive tax services for small businesses and sole proprietors',
                price: 799,
                negotiable: true,
                lowestNegotiationPrice: 649,
                features: [
                    'Business income tax return (Schedule C or 1120-S)',
                    'Quarterly estimated tax calculations',
                    'Business expense categorization',
                    'Home office deduction calculation',
                    'State business tax returns',
                    'Tax planning consultation (1 hour)',
                    'Year-round email support'
                ],
                keywords: ['business', 'small business', 'schedule c', 'sole proprietor', 'llc', 's-corp']
            },
            {
                id: 'tax-planning-session',
                name: 'Tax Planning Consultation',
                description: 'Strategic tax planning session with certified tax professional',
                price: 249,
                negotiable: true,
                lowestNegotiationPrice: 199,
                features: [
                    '90-minute one-on-one consultation',
                    'Personalized tax strategy roadmap',
                    'Deduction optimization analysis',
                    'Retirement planning tax implications',
                    'Written action plan',
                    '30-day follow-up email support'
                ],
                keywords: ['planning', 'consultation', 'strategy', 'advice', 'meeting']
            },
            
            // Fixed Price Services
            {
                id: 'tax-amendment',
                name: 'Tax Return Amendment',
                description: 'File an amended tax return (Form 1040-X)',
                price: 199,
                negotiable: false,
                features: [
                    'Form 1040-X preparation',
                    'Error correction',
                    'Documentation review',
                    'IRS submission',
                    'Status tracking'
                ],
                keywords: ['amendment', '1040-x', 'correction', 'amend', 'fix']
            },
            {
                id: 'prior-year-return',
                name: 'Prior Year Tax Return',
                description: 'File a missing tax return from previous years',
                price: 349,
                negotiable: false,
                features: [
                    'Historical tax return preparation',
                    'Income reconstruction if needed',
                    'Penalty mitigation assistance',
                    'IRS communication',
                    'Compliance certification'
                ],
                keywords: ['prior year', 'old return', 'back taxes', 'missed filing', 'late']
            },
            {
                id: 'audit-defense',
                name: 'IRS Audit Defense',
                description: 'Professional representation for IRS audits',
                price: 1499,
                negotiable: false,
                features: [
                    'Full audit representation',
                    'Document preparation and organization',
                    'IRS communication handling',
                    'Appeal support if needed',
                    'Settlement negotiation',
                    'Unlimited consultation during audit'
                ],
                keywords: ['audit', 'irs audit', 'examination', 'defense', 'representation']
            },
            
            // Add-on Services
            {
                id: 'state-return-addon',
                name: 'Additional State Return',
                description: 'File tax return for an additional state',
                price: 99,
                negotiable: false,
                features: [
                    'Full state tax return preparation',
                    'State-specific deductions',
                    'E-filing included',
                    'Multi-state tax allocation if applicable'
                ],
                keywords: ['state', 'additional state', 'multiple states', 'state return']
            },
            {
                id: 'extension-filing',
                name: 'Tax Extension Filing',
                description: 'File for a 6-month tax extension',
                price: 49,
                negotiable: false,
                features: [
                    'Form 4868 preparation',
                    'Estimated tax calculation',
                    'Immediate filing',
                    'Confirmation receipt'
                ],
                keywords: ['extension', '4868', 'more time', 'deadline']
            }
        ]
        
        // Add all products to the map
        for (const product of products) {
            this.products.set(product.id, product)
        }
    }
    
    /**
     * Get a product by ID
     */
    getProduct(id: string): Product | undefined {
        return this.products.get(id)
    }
    
    /**
     * Get all products
     */
    getAllProducts(): Product[] {
        return Array.from(this.products.values())
    }
    
    /**
     * Get all negotiable products
     */
    getNegotiableProducts(): NegotiableProduct[] {
        return this.getAllProducts().filter(
            (p): p is NegotiableProduct => p.negotiable === true
        )
    }
    
    /**
     * Get all fixed price products
     */
    getFixedPriceProducts(): FixedPriceProduct[] {
        return this.getAllProducts().filter(
            (p): p is FixedPriceProduct => p.negotiable === false
        )
    }
    
    /**
     * Search products by keyword
     */
    searchProducts(query: string): Product[] {
        const lowerQuery = query.toLowerCase()
        return this.getAllProducts().filter(product => 
            product.name.toLowerCase().includes(lowerQuery) ||
            product.description.toLowerCase().includes(lowerQuery) ||
            product.keywords.some(k => k.includes(lowerQuery))
        )
    }
    
    /**
     * Get a formatted product description
     */
    getProductDescription(id: string): string {
        const product = this.getProduct(id)
        if (!product) return 'Product not found'
        
        const negotiableText = product.negotiable 
            ? `\n💡 Price is negotiable (minimum: $${product.lowestNegotiationPrice})`
            : '\n🔒 Fixed price (not negotiable)'
        
        return `
📦 ${product.name}
💰 Price: $${product.price}
${negotiableText}

${product.description}

✨ What's included:
${product.features.map(f => `  • ${f}`).join('\n')}
`.trim()
    }
    
    /**
     * Get a summary of all products
     */
    getProductSummary(): string {
        const products = this.getAllProducts()
        const categories = {
            premium: products.filter(p => p.price >= 500),
            standard: products.filter(p => p.price >= 200 && p.price < 500),
            basic: products.filter(p => p.price < 200)
        }
        
        let summary = '🛍️  TaxPro Services Catalog\n\n'
        
        if (categories.premium.length > 0) {
            summary += '💎 Premium Services:\n'
            categories.premium.forEach(p => {
                summary += `  • ${p.name} - $${p.price}${p.negotiable ? ' *' : ''}\n`
            })
            summary += '\n'
        }
        
        if (categories.standard.length > 0) {
            summary += '⭐ Standard Services:\n'
            categories.standard.forEach(p => {
                summary += `  • ${p.name} - $${p.price}${p.negotiable ? ' *' : ''}\n`
            })
            summary += '\n'
        }
        
        if (categories.basic.length > 0) {
            summary += '📌 Quick Services:\n'
            categories.basic.forEach(p => {
                summary += `  • ${p.name} - $${p.price}\n`
            })
            summary += '\n'
        }
        
        summary += '\n* Negotiable pricing available'
        
        return summary
    }
    
    /**
     * Calculate negotiated price
     */
    calculateNegotiatedPrice(
        productId: string,
        requestedPrice: number
    ): { approved: boolean; finalPrice: number; message: string } {
        const product = this.getProduct(productId)
        
        if (!product) {
            return {
                approved: false,
                finalPrice: 0,
                message: 'Product not found'
            }
        }
        
        if (!product.negotiable) {
            return {
                approved: false,
                finalPrice: product.price,
                message: `${product.name} has a fixed price of $${product.price}`
            }
        }
        
        const negotiableProduct = product as NegotiableProduct
        
        if (requestedPrice >= negotiableProduct.lowestNegotiationPrice) {
            return {
                approved: true,
                finalPrice: requestedPrice,
                message: `Great! I can offer ${product.name} at $${requestedPrice}`
            }
        } else {
            return {
                approved: false,
                finalPrice: negotiableProduct.lowestNegotiationPrice,
                message: `I appreciate your interest, but the lowest I can go for ${product.name} is $${negotiableProduct.lowestNegotiationPrice}`
            }
        }
    }
}
