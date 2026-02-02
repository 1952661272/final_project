
const path = require('path')
const { chromium } = require('playwright')

const baseDir = '/Users/mac/Downloads/毕设产品说明书'
const demoPath = path.join(baseDir, 'campus-trade-demo', 'index.html')
const outDir = path.join(baseDir, 'report_images')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } })

  const fileUrl = `file://${demoPath}`

  // Login screen
  await page.goto(fileUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'report_login.png') })

  // Login
  await page.fill('input[aria-label="学号/手机号"]', '20230001')
  await page.fill('input[aria-label="密码"]', '123456')
  await page.click('button:has-text("登录")')
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'report_home.png') })

  // Open detail for first item
  await page.click('text=查看详情')
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(outDir, 'report_detail.png') })

  await browser.close()
})().catch(err => {
  console.error(err)
  process.exit(1)
})
