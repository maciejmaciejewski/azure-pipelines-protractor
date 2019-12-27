const fs = require('fs')
const path = require('path')
const tl = require('azure-pipelines-task-lib/task')
const globby = require('globby')

function uploadScreenshots (reportDirPath) {
  const files = globby.sync([`${reportDirPath}/screenshots`], {expandDirectories: { extensions: ['png'], files: [ '*' ]}})
  files.forEach(file => {
      const screenshotProperties = {
        name: path.basename(file),
        type: 'protractor.screenshot'
      }

      tl.command('task.addattachment', screenshotProperties, file)
  })
}

function uploadResultsJson (reportDirPath) {
    const properties = {
      name: 'protractor_report.json',
      type: 'protractor.report'
    }

    const combinedPath = path.join(reportDirPath, 'combined.json')
    if (fs.existsSync(combinedPath)) {
      tl.command('task.addattachment', properties, combinedPath)
    } else {
      throw new Error('Could not find report file')
    }
}

function run () {
  try {
    const reportDirPath = path.resolve(tl.getInput('cwd', true))
    tl.debug(reportDirPath)

    if(fs.existsSync(reportDirPath)) {
      uploadScreenshots(reportDirPath)
      uploadResultsJson(reportDirPath)
    } else {
      throw new Error('Could not find Protractor report directory')
    }
  } catch (err) {
    tl.warning(err)
    tl.setResult(tl.TaskResult.SucceededWithIssues)
  }
}

run()
