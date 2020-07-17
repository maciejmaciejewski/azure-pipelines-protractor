[![Donate](https://img.shields.io/static/v1?logo=paypal&label=PayPal&message=Donate&color=yellow)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZH953HFWKBJFA)
[![Build Status](https://dev.azure.com/maciejmaciejewski-dev/extensions/_apis/build/status/Protractor/extension-build?branchName=master)](https://dev.azure.com/maciejmaciejewski-dev/extensions/_build/latest?definitionId=1&branchName=master)

# Protractor Report Tab for Azure Pipelines

Azure DevOps extension that provides a task for publishing Protractor report in a HTML format and embeds it into a Build and Release pages.

The extension is and will remain free of charge, however if you would like to support me please consider donating by using the PayPal button above.

## Configuration

### Protractor

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

### Extension

In order to see report on Protractor Tab one must first use `Publish Protractor Report` task. This is supporting task which makes Protractor tab visible.

This task takes two parameters - required `cwd` which is a path to Protractor Report directory and also optional `tabName` which is the name of the tab displayed within Azure DevOps report. The directory used to generate HTML must contain `combined.json` - file which is a source of the data displayed in the report. We also check content of `screenshots` directory for associated screenshots image files and upload them as attachments to the Azure DevOps cloud storage.

#### Example YAML setup

```YAML
steps:
- task: PublishProtractorReport@1
  displayName: 'Publish Protractor Report'
  inputs:
    cwd: './protractor'
    tabName: 'My Web Test'
```

#### Example GUI setup

![Protractor Report Task](documentation/azure-pipelines-configuration.png)

### Result Example

![Protractor Report Task](documentation/protractor-tab-build.png)

## Contributors
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
      <td align="center">
      <a href="https://github.com/maciejmaciejewski">
        <img src="https://avatars1.githubusercontent.com/u/15831316?v=4" width="100px;" alt=""/>
        <br />
        <b>Maciej Maciejewski</b>
    </td>
    <td align="center">
      <a href="https://github.com/janzaremski">
        <img src="https://avatars1.githubusercontent.com/u/30691590" width="100px;" alt=""/>
        <br />
        <b>Jan Zaremski</b>
    </td>
    <td align="center">
      <a href="https://github.com/afeblot">
        <img src="https://avatars1.githubusercontent.com/u/12073123?v=4" width="100px;" alt=""/>
        <br />
        <b>Alexandre Feblot</b>
    </td>
  </tr>
</table>
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

## Changelog

1.1.1

- Introduced new variable `tabName` task variable to control the name of the report tab. If none specified it is defaulted to `Protractor`
- Support for multi-stage pipelines. With multiple attempts counter is added to the tab header
- Support for multiple tasks in the same job
- Support for multiple jobs

1.1.0

- Extension rewritten to React component

1.0.0

- Initial release
