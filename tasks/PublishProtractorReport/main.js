const fs = require('fs')
const path = require('path')
const taskLibrary = require('azure-pipelines-task-lib/task')

function uploadScreenshots (reportDirPath) {
  const screenshotsDir = path.join(reportDirPath, 'screenshots')
  try{
    fs.readdirSync(screenshotsDir).forEach((fileName) => {
      const screenshotProperties = {
        name: fileName,
        type: 'protractor.screenshot'
      }

      taskLibrary.command('task.addattachment', screenshotProperties, path.join(screenshotsDir, fileName))
    })
  } catch(err) {
    throw new Error('Unable to process report')
  }
}

function uploadResultsJson (reportDirPath) {
  try {
    const properties = {
      name: 'protractor_report.json',
      type: 'protractor.report'
    }

    taskLibrary.command('task.addattachment', properties, path.join(reportDirPath, 'combined.json'))
  } catch (err) {
    throw new Error('Unable to process report')
  }
}

function run () {
  try {
    const reportDirPath = path.resolve(taskLibrary.getInput('cwd', true))
    uploadResultsJson(reportDirPath)
    uploadScreenshots(reportDirPath)
  } catch (err) {
    taskLibrary.warning(err)
    taskLibrary.setResult(taskLibrary.TaskResult.SucceededWithIssues)
  }
}

run()
