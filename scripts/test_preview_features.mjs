import { chromium } from 'playwright'
import path from 'path'

const artifactDir = 'C:/Users/akid/.gemini/antigravity-ide/brain/2dea06ef-74cd-471d-b45c-70b06ace494e'
const orderId = '22251984-8293-40cb-abec-bb9a39904f16'

async function runTest() {
  console.log('🚀 Launching browser to test Slicer Feature Colors in GcodeViewer...')
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()

  const url = `http://localhost:3000/track/${orderId}`
  console.log(`Navigating to ${url}...`)
  await page.goto(url, { waitUntil: 'networkidle' })

  // Find G-code view toggle if on 3D Model view
  console.log('Checking viewer mode...')
  const gcodeTab = page.locator('button:has-text("G-code Preview"), button:has-text("Toolpath"), button:has-text("Sliced G-code")').first()
  if (await gcodeTab.count() > 0) {
    console.log('Switching to G-code viewer mode...')
    await gcodeTab.click()
  }

  // Look for "Load 3D Slicer Preview" button if not auto-started
  const loadBtn = page.locator('button:has-text("Load 3D Slicer Preview"), button:has-text("Load 3D Preview")').first()
  if (await loadBtn.count() > 0 && await loadBtn.isVisible()) {
    console.log('Clicking Load 3D Slicer Preview button...')
    await loadBtn.click()
  }

  // Wait for WebGL rendering to settle
  console.log('Waiting for WebGL preview to render features...')
  await page.waitForTimeout(6000)

  // Scroll to bring viewer prominently into view
  await page.evaluate(() => {
    window.scrollTo({ top: 120, behavior: 'instant' })
  })
  await page.waitForTimeout(1000)

  // 1. Capture Features view with color-coded lines and legend
  console.log('📸 Capturing 01_features_view_slicer_colors.png...')
  await page.screenshot({ path: path.join(artifactDir, '01_features_view_slicer_colors.png') })

  // 2. Click Filament button
  const filamentBtn = page.locator('button:has-text("Filament")').first()
  if (await filamentBtn.count() > 0) {
    console.log('Switching to Filament mode...')
    await filamentBtn.click()
    await page.waitForTimeout(1500)
    console.log('📸 Capturing 02_filament_view.png...')
    await page.screenshot({ path: path.join(artifactDir, '02_filament_view.png') })
  }

  // 3. Click Model Only button
  const modelOnlyBtn = page.locator('button:has-text("Model Only")').first()
  if (await modelOnlyBtn.count() > 0) {
    console.log('Switching to Model Only mode...')
    await modelOnlyBtn.click()
    await page.waitForTimeout(1500)
    console.log('📸 Capturing 03_model_only_view.png...')
    await page.screenshot({ path: path.join(artifactDir, '03_model_only_view.png') })
  }

  // Switch back to Features mode
  const featuresBtn = page.locator('button:has-text("Features")').first()
  if (await featuresBtn.count() > 0) {
    await featuresBtn.click()
    await page.waitForTimeout(1000)
  }

  // Drag canvas slightly to show 3D angle
  const canvas = page.locator('canvas').first()
  if (await canvas.count() > 0) {
    const box = await canvas.boundingBox()
    if (box) {
      console.log('Rotating 3D camera for perspective shot...')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 80, { steps: 15 })
      await page.mouse.up()
      await page.waitForTimeout(1500)
      console.log('📸 Capturing 04_features_perspective_3d.png...')
      await page.screenshot({ path: path.join(artifactDir, '04_features_perspective_3d.png') })
    }
  }

  console.log('✅ Testing complete!')
  await browser.close()
}

runTest().catch((err) => {
  console.error('Error during test:', err)
  process.exit(1)
})
