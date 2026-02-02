const path = require('path')
const { chromium } = require('playwright')

const baseDir = '/Users/mac/Downloads/毕设产品说明书'
const demoPath = path.join(baseDir, 'campus-trade-demo', 'index.html')
const outDir = path.join(baseDir, 'assets_png')

const screens = [
  { name: 'fig_3_1_1_login.png', param: 'fig_3_1_1' },
  { name: 'fig_3_1_2_admin_login.png', param: 'fig_3_1_2' },
  { name: 'fig_3_1_3_register.png', param: 'fig_3_1_3' },
  { name: 'fig_3_2_1_home.png', param: 'fig_3_2_1' },
  { name: 'fig_3_2_3_searchbar.png', param: 'fig_3_2_3' },
  { name: 'fig_3_3_detail.png', param: 'fig_3_3' },
  { name: 'fig_3_4_orders.png', param: 'fig_3_4' },
  { name: 'fig_3_5_1_mylist.png', param: 'fig_3_5_1' },
  { name: 'fig_3_5_2_edit.png', param: 'fig_3_5_2' },
  { name: 'fig_3_5_3_publish.png', param: 'fig_3_5_3' },
  { name: 'fig_3_5_4_seller_orders.png', param: 'fig_3_5_4' },
  { name: 'fig_3_5_5_finance.png', param: 'fig_3_5_5' },
  { name: 'fig_3_6_1_dashboard.png', param: 'fig_3_6_1' },
  { name: 'fig_3_6_2_listing_review.png', param: 'fig_3_6_2' },
  { name: 'fig_3_6_3_order_mgmt.png', param: 'fig_3_6_3' },
  { name: 'fig_3_6_4_user_finance.png', param: 'fig_3_6_4' }
]

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } })

  for (const screen of screens) {
    const fileUrl = `file://${demoPath}?screen=${screen.param}`
    await page.goto(fileUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(outDir, screen.name) })
    console.log('saved', screen.name)
  }

  await browser.close()
})().catch(err => {
  console.error(err)
  process.exit(1)
})
