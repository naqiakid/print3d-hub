import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const artifactDir = 'C:/Users/akid/.gemini/antigravity-ide/brain/2dea06ef-74cd-471d-b45c-70b06ace494e'
const stlPath = path.resolve(__dirname, '../public/test-models/cube_50mm.stl')
const orderId = '86f2703d-950e-4b72-ade7-cf8077b7a366'

console.log('🎬 Launching Automated Browser Recording Session via Microsoft Edge...')

async function runRecording() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })

  const context = await browser.newContext({
    recordVideo: {
      dir: artifactDir,
      size: { width: 1280, height: 768 }
    },
    viewport: { width: 1280, height: 768 }
  })

  const page = await context.newPage()

  // 1. Visit Homepage & Hero
  console.log('📍 1. Navigating to 3MF Studio Homepage...')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(artifactDir, '01_homepage_hero.png') })

  // 2. Scroll to 3D Configurator
  console.log('📍 2. Scrolling down to 3D Price Configurator & Ender-3 Bed...')
  await page.evaluate(() => window.scrollBy({ top: 750, behavior: 'smooth' }))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, '02_empty_configurator.png') })

  // 3. Upload STL File into dropzone
  console.log('📍 3. Uploading cube_50mm.stl into File Dropzone...')
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(stlPath)
    console.log('   Three.js calculating geometry volume, parsing mesh, rendering 3D bed...')
    await page.waitForTimeout(5000)
    await page.screenshot({ path: path.join(artifactDir, '03_stl_uploaded_3d_preview.png') })
  }

  // 4. Visit the Live Customer Tracking Page
  console.log(`📍 4. Navigating to Customer Live Tracking Page (/track/${orderId})...`)
  await page.goto(`http://localhost:3000/track/${orderId}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(artifactDir, '04_customer_tracking_top.png') })

  // 5. Scroll down Tracking Page to inspect timeline & true price breakdown
  console.log('📍 5. Scrolling down Tracking Page to inspect timeline & true price breakdown...')
  await page.evaluate(() => window.scrollBy({ top: 480, behavior: 'smooth' }))
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, '05_tracking_timeline_specs.png') })

  // 6. Visit Owner Dashboard
  console.log('📍 6. Navigating to Owner Dashboard (/dashboard)...')
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(artifactDir, '06_owner_dashboard.png') })

  const video = page.video()
  await context.close()
  await browser.close()

  if (video) {
    const originalVideoPath = await video.path()
    const targetVideoPath = path.join(artifactDir, 'e2e_printing_flow_walkthrough.webm')
    fs.copyFileSync(originalVideoPath, targetVideoPath)
    console.log('\n🎥 FINAL VIDEO RECORDED & SAVED SUCCESSFULLY AT:')
    console.log(`   ${targetVideoPath}\n`)
  }
}

runRecording().catch(err => {
  console.error('❌ Recording failed:', err)
  process.exit(1)
})
