const fs = require('fs')
const path = require('path')
const tl = require('azure-pipelines-task-lib/task')
const globby = require('globby')

function uploadScreenshots (files) {
  files.forEach((file) => {
      const screenshotProperties = {
        name: file,
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
      tl.warning('Could not find combined.json report file')
    }
}

function run () {
  try {
    const reportDirPath = path.resolve(tl.getInput('cwd', true))
    const screenshots = globby.sync([`${reportDirPath}/screenshots`], {expandDirectories: { extensions: ['png'], files: [ '*' ]}})

    uploadScreenshots(screenshots)
    uploadResultsJson(reportDirPath)

  } catch (err) {
    tl.warning(err)
    tl.setResult(tl.TaskResult.SucceededWithIssues)
  }
}

run()
