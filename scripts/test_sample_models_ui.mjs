import { chromium } from 'playwright'
import path from 'path'

const artifactDir = 'C:/Users/akid/.gemini/antigravity-ide/brain/2dea06ef-74cd-471d-b45c-70b06ace494e'

async function runTest() {
  console.log('🚀 Testing Sample 3D Models in Price Configurator...')
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  // Scroll to configurator
  await page.evaluate(() => {
    const el = document.getElementById('quote')
    if (el) el.scrollIntoView({ behavior: 'instant' })
  })
  await page.waitForTimeout(1500)

  // 1. Capture the Sample Models Selector
  console.log('📸 1. Capturing sample selector banner...')
  await page.screenshot({ path: path.join(artifactDir, 'sample_banner_empty_configurator.png') })

  // 2. Click Phone Stand sample
  console.log('📱 Clicking "Desk Phone Stand"...')
  const phoneStandBtn = page.locator('button:has-text("Desk Phone Stand")').first()
  await phoneStandBtn.click()
  await page.waitForTimeout(4000)

  // Scroll down to center the 3D bed viewer and price card
  await page.evaluate(() => {
    window.scrollBy({ top: 380, behavior: 'instant' })
  })
  await page.waitForTimeout(1000)

  console.log('📸 2. Capturing Phone Stand rendered on Ender-3 bed...')
  await page.screenshot({ path: path.join(artifactDir, 'sample_phone_stand_rendered.png') })

  // 3. Clear file queue to test next sample
  const removeBtn = page.locator('button:has(svg.lucide-trash-2), button[title*="Remove"]').first()
  if (await removeBtn.count() > 0) {
    await removeBtn.click()
    await page.waitForTimeout(1000)
  }

  // Scroll back up to sample selector
  await page.evaluate(() => {
    const el = document.getElementById('quote')
    if (el) el.scrollIntoView({ behavior: 'instant' })
  })
  await page.waitForTimeout(1000)

  // 4. Click 3D Benchy Boat
  console.log('🚤 Clicking "3D Benchy Boat"...')
  const benchyBtn = page.locator('button:has-text("3D Benchy Boat")').first()
  if (await benchyBtn.count() > 0) {
    await benchyBtn.click()
    await page.waitForTimeout(5000)

    // Scroll down to center bed
    await page.evaluate(() => {
      window.scrollBy({ top: 380, behavior: 'instant' })
    })
    await page.waitForTimeout(1000)

    console.log('📸 3. Capturing 3DBenchy rendered on Ender-3 bed...')
    await page.screenshot({ path: path.join(artifactDir, 'sample_benchy_rendered.png') })
  }

  // 5. Test Drone Assembly 3MF
  const removeBtn2 = page.locator('button:has(svg.lucide-trash-2), button[title*="Remove"]').first()
  if (await removeBtn2.count() > 0) {
    await removeBtn2.click()
    await page.waitForTimeout(1000)
  }

  // Scroll back up
  await page.evaluate(() => {
    const el = document.getElementById('quote')
    if (el) el.scrollIntoView({ behavior: 'instant' })
  })
  await page.waitForTimeout(1000)

  console.log('⚙️ Clicking "Drone Assembly 3MF"...')
  const assemblyBtn = page.locator('button:has-text("Drone Assembly 3MF")').first()
  if (await assemblyBtn.count() > 0) {
    await assemblyBtn.click()
    await page.waitForTimeout(6000)

    // Scroll down to center bed
    await page.evaluate(() => {
      window.scrollBy({ top: 380, behavior: 'instant' })
    })
    await page.waitForTimeout(1000)

    console.log('📸 4. Capturing Multi-Part Assembly rendered on Ender-3 bed...')
    await page.screenshot({ path: path.join(artifactDir, 'sample_assembly_rendered.png') })
  }

  console.log('✅ Sample models testing completed successfully!')
  await browser.close()
}

runTest().catch((err) => {
  console.error('Error during sample test:', err)
  process.exit(1)
})
