import os from 'os'
import { execSync } from 'child_process'
import * as prettier from "prettier";

const targetLang = process.env.TARGET_LANG || 'zh'

// if macos
if(os.platform() === 'darwin') {
  console.log('removing non-standard HTML tags...')
  // Remove all non-standard HTML tags to prevent prettier errors
  const result = execSync(`find ${targetLang} -name "*.html" -exec sed -i '' -E 's#</(input|img|br|hr|meta|link)>##g' {} \;`)
  console.log(result)
}
try {
  console.log('formatting with prettier...')
  await prettier.format(targetLang, {
    parser: 'html',
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'all',
  })
} catch (error) {
  console.error(error)
}
