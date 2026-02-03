const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const outDir = '/Users/mac/Downloads/毕设产品说明书/assets_png'
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:9001'
const hashBase = baseURL.replace(/\/$/, '') + '/#'

function hashUrl (path) {
  if (!path.startsWith('/')) {
    throw new Error(`hashUrl path must start with "/": ${path}`)
  }
  return `${hashBase}${path}`
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

async function waitPage(page, ms = 800) {
  await page.waitForTimeout(ms)
}

async function clickProfileTab(page, label) {
  const tab = page.locator('.sub-tabs .q-tab').filter({ hasText: label }).first()
  await tab.waitFor()
  await tab.click()
}

async function capture() {
  const browser = await chromium.launch()

  const pagePublic = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const publicScreens = [
    { name: 'fig_3_1_1_login.png', url: '/login' },
    { name: 'fig_3_1_2_admin_login.png', url: '/admin/login' },
    {
      name: 'fig_3_1_3_verify.png',
      url: '/',
      action: async (p) => {
        await p.getByText('校园认证').first().click()
      }
    },
    { name: 'fig_3_2_1_home.png', url: '/' },
    { name: 'fig_3_2_3_searchbar.png', url: '/search?category=数码' },
    { name: 'fig_3_3_detail.png', url: '/detail/1' }
  ]

  for (const screen of publicScreens) {
    await pagePublic.goto(hashUrl(screen.url), { waitUntil: 'domcontentloaded' })
    if (screen.action) {
      await screen.action(pagePublic)
    }
    await waitPage(pagePublic)
    await pagePublic.screenshot({ path: path.join(outDir, screen.name), fullPage: true })
  }

  const pageUser = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await pageUser.addInitScript(() => {
    localStorage.setItem('user_auth', '1')
    localStorage.setItem('campus_trade_state_v3', JSON.stringify({ userName: '张同学' }))
  })

  const userScreens = [
    { name: 'fig_3_4_orders.png', url: '/profile' },
    {
      name: 'fig_3_5_4_seller_orders.png',
      url: '/profile',
      action: async (p) => {
        await clickProfileTab(p, '我卖掉的')
      }
    },
    {
      name: 'fig_3_5_1_mylist.png',
      url: '/profile',
      action: async (p) => {
        await clickProfileTab(p, '我发布的')
      }
    },
    {
      name: 'fig_3_5_2_edit.png',
      url: '/profile',
      action: async (p) => {
        await clickProfileTab(p, '我发布的')
        const editBtn = p.locator('button:has-text("编辑")').first()
        await editBtn.waitFor()
        await editBtn.click()
      }
    },
    {
      name: 'fig_3_5_3_publish.png',
      url: '/publish',
      action: async (p) => {
        const input = p.locator('input[type="file"]').first()
        await input.setInputFiles('/Users/mac/Downloads/毕设产品说明书/campus-trade-app/public/assets/real/item_01.jpg')
      }
    },
    { name: 'fig_3_5_5_messages.png', url: '/messages' }
  ]

  for (const screen of userScreens) {
    await pageUser.goto(hashUrl(screen.url), { waitUntil: 'domcontentloaded' })
    if (screen.action) {
      await screen.action(pageUser)
    }
    await waitPage(pageUser)
    await pageUser.screenshot({ path: path.join(outDir, screen.name), fullPage: true })
  }

  const pageAdmin = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await pageAdmin.addInitScript(() => {
    localStorage.setItem('admin_auth', '1')
  })

  const adminScreens = [
    { name: 'fig_3_6_1_dashboard.png', url: '/admin/dashboard' },
    { name: 'fig_3_6_2_listing_review.png', url: '/admin/listings' },
    { name: 'fig_3_6_3_user_mgmt.png', url: '/admin/users' }
  ]

  for (const screen of adminScreens) {
    await pageAdmin.goto(hashUrl(screen.url), { waitUntil: 'domcontentloaded' })
    await waitPage(pageAdmin)
    await pageAdmin.screenshot({ path: path.join(outDir, screen.name), fullPage: true })
  }

  await browser.close()
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
