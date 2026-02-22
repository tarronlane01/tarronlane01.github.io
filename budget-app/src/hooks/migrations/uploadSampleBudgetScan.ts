/**
 * Scan a zip file to validate sample budget structure.
 */

import JSZip from 'jszip'

export interface UploadSampleBudgetStatus {
  monthsFound: number
  categoriesFound: number
  accountsFound: number
  isValid: boolean
  validationErrors: string[]
}

/**
 * Scan a zip file to validate it contains proper sample budget structure.
 * Expected: budget.json, accounts.json, categories.json, category_groups.json, months/month_YYYY_MM/
 */
export async function scanSampleBudgetZip(zipFile: File): Promise<UploadSampleBudgetStatus> {
  const zip = new JSZip()
  const zipData = await zip.loadAsync(zipFile)

  const validationErrors: string[] = []
  let monthsFound = 0
  let categoriesFound = 0
  let accountsFound = 0

  const requiredFiles = ['budget.json', 'accounts.json', 'categories.json', 'category_groups.json']
  for (const file of requiredFiles) {
    if (!zipData.files[file]) {
      validationErrors.push(`Missing required file: ${file}`)
    }
  }

  if (zipData.files['categories.json']) {
    try {
      const content = await zipData.files['categories.json'].async('string')
      const categories = JSON.parse(content)
      categoriesFound = Object.keys(categories).length
    } catch {
      validationErrors.push('Invalid categories.json format')
    }
  }

  if (zipData.files['accounts.json']) {
    try {
      const content = await zipData.files['accounts.json'].async('string')
      const accounts = JSON.parse(content)
      accountsFound = Object.keys(accounts).length
    } catch {
      validationErrors.push('Invalid accounts.json format')
    }
  }

  const monthFolders = new Set<string>()
  for (const path of Object.keys(zipData.files)) {
    const monthMatch = path.match(/^months\/month_\d{4}_\d{2}\//)
    if (monthMatch) {
      monthFolders.add(path.split('/')[1])
    }
  }
  monthsFound = monthFolders.size

  return {
    monthsFound,
    categoriesFound,
    accountsFound,
    isValid: validationErrors.length === 0,
    validationErrors,
  }
}
