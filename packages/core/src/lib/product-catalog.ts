/**
 * Product Catalog
 * Data-driven product management with pricing and negotiation capabilities
 */

import type { Product, NegotiableProduct } from '../types/index.js'
import { ProductError } from '../errors/index.js'
import { logger } from '../logger/index.js'

export class ProductCatalog {
  private products: Map<string, Product> = new Map()

  constructor(products?: Product[]) {
    if (products) {
      this.loadProducts(products)
    }
  }

  /**
   * Load products from array
   */
  loadProducts(products: Product[]): void {
    this.products.clear()
    for (const product of products) {
      this.products.set(product.id, product)
    }
    logger.info({ count: products.length }, 'Products loaded')
  }

  /**
   * Get a product by ID
   */
  getProduct(productId: string): Product | undefined {
    return this.products.get(productId)
  }

  /**
   * Get all products
   */
  getAllProducts(): Product[] {
    return Array.from(this.products.values())
  }

  /**
   * Search for products by keyword
   */
  searchProducts(query: string): Product[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllProducts().filter((product) => {
      const matchesName = product.name.toLowerCase().includes(lowerQuery)
      const matchesDescription = product.description.toLowerCase().includes(lowerQuery)
      const matchesKeywords = product.keywords.some((keyword) =>
        keyword.toLowerCase().includes(lowerQuery)
      )
      return matchesName || matchesDescription || matchesKeywords
    })
  }

  /**
   * Get product summary for display
   */
  getProductSummary(companyName: string): string {
    const products = this.getAllProducts()

    if (products.length === 0) {
      return `No products available at this time.`
    }

    let summary = `${companyName} Services Catalog\n\n`

    for (const product of products) {
      summary += `${product.name}\n`
      summary += `$${product.price}`
      if (product.negotiable) {
        summary += ' (negotiable)'
      }
      summary += `\n${product.description}\n`
      summary += `Features:\n`
      for (const feature of product.features) {
        summary += `  - ${feature}\n`
      }
      summary += `\n`
    }

    return summary
  }

  /**
   * Get negotiable products
   */
  getNegotiableProducts(): NegotiableProduct[] {
    return this.getAllProducts().filter(
      (p): p is NegotiableProduct => p.negotiable === true
    )
  }

  /**
   * Check if a product is negotiable
   */
  isNegotiable(productId: string): boolean {
    const product = this.getProduct(productId)
    return product?.negotiable === true
  }

  /**
   * Get the lowest negotiation price for a product
   */
  getLowestPrice(productId: string): number | undefined {
    const product = this.getProduct(productId)
    if (product && product.negotiable) {
      return product.lowestNegotiationPrice
    }
    return product?.price
  }

  /**
   * Validate if an offer is acceptable
   */
  isOfferAcceptable(productId: string, offer: number): boolean {
    const product = this.getProduct(productId)
    if (!product) {
      throw ProductError(`Product not found: ${productId}`, { productId })
    }

    if (!product.negotiable) {
      return offer >= product.price
    }

    return offer >= product.lowestNegotiationPrice
  }
}
