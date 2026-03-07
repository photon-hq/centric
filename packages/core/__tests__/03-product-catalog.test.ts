/**
 * ProductCatalog Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { ProductCatalog } from '../src/lib/product-catalog.ts'
import type { Product } from '../src/types/index.ts'

const testProducts: Product[] = [
  {
    id: 'basic',
    name: 'Basic Plan',
    description: 'Entry-level plan',
    price: 29,
    features: ['5 users', '10GB storage'],
    keywords: ['starter', 'basic', 'entry'],
    negotiable: false
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    description: 'Professional tier',
    price: 99,
    features: ['Unlimited users', '100GB storage'],
    keywords: ['professional', 'pro', 'premium'],
    negotiable: true,
    lowestNegotiationPrice: 79
  }
]

describe('ProductCatalog', () => {
  let catalog: ProductCatalog

  beforeEach(() => {
    catalog = new ProductCatalog(testProducts)
  })

  it('loads products on construction', () => {
    expect(catalog.getAllProducts()).toHaveLength(2)
  })

  it('getProduct returns correct product by id', () => {
    const product = catalog.getProduct('basic')
    expect(product).toBeDefined()
    expect(product!.name).toBe('Basic Plan')
  })

  it('getProduct returns undefined for unknown id', () => {
    expect(catalog.getProduct('nonexistent')).toBeUndefined()
  })

  it('getAllProducts returns all products', () => {
    const all = catalog.getAllProducts()
    const names = all.map(p => p.name)
    expect(names).toContain('Basic Plan')
    expect(names).toContain('Pro Plan')
  })

  it('searchProducts finds by name', () => {
    const results = catalog.searchProducts('basic')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toBe('Basic Plan')
  })

  it('searchProducts finds by keyword', () => {
    const results = catalog.searchProducts('professional')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toBe('Pro Plan')
  })

  it('searchProducts returns empty array for no match', () => {
    const results = catalog.searchProducts('xyz_no_match_12345')
    expect(results).toHaveLength(0)
  })

  it('correctly identifies negotiable products', () => {
    const pro = catalog.getProduct('pro')
    expect(pro).toBeDefined()
    expect(pro!.negotiable).toBe(true)
    if (pro!.negotiable) {
      expect(pro!.lowestNegotiationPrice).toBe(79)
    }
  })

  it('works with empty product list', () => {
    const empty = new ProductCatalog([])
    expect(empty.getAllProducts()).toHaveLength(0)
  })

  it('works with no initial products (loadProducts later)', () => {
    const late = new ProductCatalog()
    expect(late.getAllProducts()).toHaveLength(0)
    late.loadProducts(testProducts)
    expect(late.getAllProducts()).toHaveLength(2)
  })
})
