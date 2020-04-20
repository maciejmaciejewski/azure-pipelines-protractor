const fs = require('fs')
const path = require('path')
const tl = require('azure-pipelines-task-lib/task')
const globby = require('globby')
const hat = require('hat')
const dashify = require('dashify')

function uploadScreenshots (reportDirPath) {
  const files = globby.sync([`${reportDirPath.replace(/\\/g, '/')}/screenshots`], {expandDirectories: { extensions: ['png'], files: [ '*' ]}})
  files.forEach(file => {
      const screenshotProperties = {
        name: path.basename(file),
        type: 'protractor.screenshot'
      }

      tl.command('task.addattachment', screenshotProperties, file)
  })
}

function uploadResultsJson (reportDirPath) {
    const jobName = dashify(tl.getVariable('Agent.JobName'))
    const stageName = dashify(tl.getVariable('System.StageDisplayName'))
    const stageAttempt = tl.getVariable('System.StageAttempt')
    const tabName = tl.getInput('tabName', false ) || 'Protractor'
    const uniqueId = hat()

    const properties = {
      name:  `${tabName}.${jobName}.${stageName}.${stageAttempt}.${uniqueId}`,
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
  tl.info("New version has been released, please find change log at https://github.com/maciejmaciejewski/azure-pipelines-protractor/releases")
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
