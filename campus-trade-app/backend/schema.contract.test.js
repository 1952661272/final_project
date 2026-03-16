import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('database schema contract', () => {
  it('contains listing tag table and foreign key contract', () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/database/schema_mysql.sql'), 'utf-8')

    expect(sql).toContain('CREATE TABLE ct_listing_tag')
    expect(sql).toContain('tag_name VARCHAR(64) NOT NULL')
    expect(sql).toContain('CONSTRAINT fk_listing_tag_listing FOREIGN KEY (listing_id) REFERENCES ct_listing(listing_id)')
    expect(sql).toContain('UNIQUE KEY uk_listing_tag_name (listing_id, tag_name)')
  })
})
