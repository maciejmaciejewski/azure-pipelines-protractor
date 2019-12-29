# Protractor Report Tab for Azure Pipelines

This repository contains the source code of Azure DevOps extension for publishig Protractor Report on Build and Release tabs.

The uses reports from :heart: [Protractor Beautiful Reporter](https://www.npmjs.com/package/protractor-beautiful-reporter) :heart:.

## Configuration

### Protractor configuration

Before starting using this extension it is necessary to install `Protractor Beautiful Reporter` package via npm. For more information and configuration please refer to [protractor-beautiful-reporter](https://www.npmjs.com/package/protractor-beautiful-reporter).

```JavaScript
import * as BeautifulReporter from 'protractor-beautiful-reporter';

const beautifulReporter = new BeautifulReporter({
  baseDirectory: resultsDir,
  screenshotsSubfolder: 'screenshots',
  jsonsSubfolder: 'jsons',
  takeScreenShotsOnlyForFailedSpecs: false,
  docName: 'report.html',
  preserveDirectory: true
});

jasmine.getEnv().addReporter(beautifulReporter.getJasmine2Reporter());
```

### Extension configuration

In order to see report on Protractor Tab one must first use `Publish Protractor Report` task. This is supporting task which makes Protractor tab visible.

This task takes one parameter `Report Directory` which is a path to Protractor Report directory. The report directory must contain `combined.json` file which is a source of the data displayed in the report. We also check content of `screenshots` directory for associated screenshots image files. All of the files are uploaded as Azure DevOps attachments to the cloud storage.

## Usage Examples

### Configuration screenshot

![Protractor Report Task](documentation/azure-pipelines-configuration.png)

### Report on Build tab

![Protractor Report Task](documentation/protractor-tab-build.png)
