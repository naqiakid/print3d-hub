import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const artifactDir = 'C:/Users/akid/.gemini/antigravity-ide/brain/2dea06ef-74cd-471d-b45c-70b06ace494e'
const model3mfPath = 'C:/Users/akid/Downloads/3D_Printing/3d model/P_JB_V1_C_260311.3mf'
const orderId = 'c0cb04dc-9427-4704-a176-56b8013dd902'

console.log('🎬 Launching Comprehensive Full-Page Visual Recording via Microsoft Edge...')

async function runFullWindowRecording() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  // 1440x900 resolution (crisp desktop widescreen format)
  const context = await browser.newContext({
    recordVideo: {
      dir: artifactDir,
      size: { width: 1440, height: 900 }
    },
    viewport: { width: 1440, height: 900 }
  })

  const page = await context.newPage()

  // Helper for smooth scrolling across the entire page
  async function smoothScrollPage(scrollSteps = 5, stepPx = 350, pauseMs = 1500) {
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate((px) => window.scrollBy({ top: px, behavior: 'smooth' }), stepPx)
      await page.waitForTimeout(pauseMs)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SCENE 1: HOMEPAGE & 3D CONFIGURATOR WITH USER'S 3MF FILE
  // ─────────────────────────────────────────────────────────────
  console.log('📍 SCENE 1: Navigating to Homepage...')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, 'full_01_homepage_top.png') })

  console.log('📍 Scrolling to Instant 3D Price Estimator & Dropzone...')
  await smoothScrollPage(2, 380, 1500)
  await page.screenshot({ path: path.join(artifactDir, 'full_02_configurator_empty.png') })

  console.log(`📍 Uploading User 3MF File: ${path.basename(model3mfPath)}...`)
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(model3mfPath)
    console.log('   Waiting 8s for Three.js 3MF parsing, geometry calculation & bed render...')
    await page.waitForTimeout(8000)
    await page.screenshot({ path: path.join(artifactDir, 'full_03_3mf_rendered_on_bed.png') })
  }

  console.log('📍 Scrolling through 3D Configurator options (materials, infill, specs)...')
  await smoothScrollPage(3, 350, 2000)
  await page.screenshot({ path: path.join(artifactDir, 'full_04_configurator_specs_breakdown.png') })

  console.log('📍 Scrolling through remainder of Homepage (trust badges, printer specs)...')
  await smoothScrollPage(3, 400, 1500)

  // ─────────────────────────────────────────────────────────────
  // SCENE 2: FULL CUSTOMER TRACKING PAGE WITH COMPLETE SCROLL
  // ─────────────────────────────────────────────────────────────
  console.log(`\n📍 SCENE 2: Navigating to Customer Tracking Page (/track/${orderId})...`)
  await page.goto(`http://localhost:3000/track/${orderId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(artifactDir, 'full_05_tracking_header_and_3d.png') })

  // Scroll down step-by-step through the ENTIRE tracking page so user sees every single element
  console.log('📍 Step-by-step full scroll down the customer tracking page:')
  
  console.log('   -> Inspecting Official Price Breakdown & Sliced G-code Specs...')
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, 'full_06_tracking_price_breakdown.png') })

  console.log('   -> Clicking "Specs" Tab to showcase Slicer Manufacturing Passport (Infill, Brim, Walls, Thermals, Supports)...')
  const specsTabBtn = page.locator('button:has-text("Specs")').first()
  if (await specsTabBtn.count() > 0) {
    await specsTabBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(artifactDir, 'full_07_tracking_specs_cards.png') })
  }

  console.log('   -> Clicking "Files" Tab to showcase Machine Sliced G-code & Badge Ribbon...')
  const filesTabBtn = page.locator('button:has-text("Files")').first()
  if (await filesTabBtn.count() > 0) {
    await filesTabBtn.click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(artifactDir, 'full_07b_tracking_files_tab.png') })
  }

  console.log('   -> Inspecting Fulfillment, Studio Pickup, and Complete Order Timeline...')
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: 'smooth' }))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, 'full_08_tracking_timeline_complete.png') })

  console.log('   -> Inspecting Bottom of Tracking Page (WhatsApp Studio button, footer)...')
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, 'full_09_tracking_page_bottom.png') })

  // Smooth scroll back up to top of tracking page
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await page.waitForTimeout(2000)

  // ─────────────────────────────────────────────────────────────
  // SCENE 3: OWNER DASHBOARD LOGIN & JOB QUEUE
  // ─────────────────────────────────────────────────────────────
  console.log('\n📍 SCENE 3: Logging into Owner Dashboard (/login)...')
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  const passInput = page.locator('input[type="password"], input[name="password"]').first()
  const submitBtn = page.locator('button[type="submit"]').first()

  if (await emailInput.count() > 0 && await passInput.count() > 0) {
    await emailInput.fill('admin@qid3d.com')
    await passInput.fill('Password123!')
    await page.waitForTimeout(500)
    await submitBtn.click()
    console.log('   Logged in! Redirecting to /dashboard...')
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await page.screenshot({ path: path.join(artifactDir, 'full_10_owner_dashboard_top.png') })

    console.log('   Scrolling down Owner Dashboard to inspect Job Cards & Orders...')
    await smoothScrollPage(3, 400, 2000)
    await page.screenshot({ path: path.join(artifactDir, 'full_11_owner_dashboard_jobs.png') })
  }

  console.log('\nWrapping up video recording...')
  const video = page.video()
  await context.close()
  await browser.close()

  if (video) {
    const originalVideoPath = await video.path()
    const targetVideoPath = path.join(artifactDir, '3mf_studio_full_window_walkthrough.webm')
    fs.copyFileSync(originalVideoPath, targetVideoPath)
    
    // Also copy to public/demo for instant browser access
    const publicDemoPath = path.resolve(__dirname, '../public/demo/3mf_studio_full_window_walkthrough.webm')
    fs.copyFileSync(originalVideoPath, publicDemoPath)

    console.log('\n🎉 COMPREHENSIVE FULL-WINDOW VIDEO SAVED AT:')
    console.log(`   Artifact: ${targetVideoPath}`)
    console.log(`   Public:   ${publicDemoPath}\n`)
  }
}

runFullWindowRecording().catch(err => {
  console.error('❌ Full recording failed:', err)
  process.exit(1)
})
