import TFS_Release_Contracts = require("ReleaseManagement/Core/Contracts");
import TFS_Build_Contracts = require("TFS/Build/Contracts");
import TFS_DistributedTask_Contracts = require("TFS/DistributedTask/Contracts");
import TFS_Build_Extension_Contracts = require("TFS/Build/ExtensionContracts");
import RM_Client = require("ReleaseManagement/Core/RestClient");
import DT_Client = require("TFS/DistributedTask/TaskRestClient");
import Controls = require("VSS/Controls");
import mustache = require('mustache')

abstract class BaseProtractorReportTab extends Controls.BaseControl {
  protected static readonly ATTACHMENT_TYPE = "finastra.protractor_report";

  protected constructor() {
    super();
  }

  protected convertBufferToString(buffer: ArrayBuffer): string {
    const enc = new TextDecoder("utf-8");
    const arr = new Uint8Array(buffer);
    return enc.decode(arr);
  }

  protected setFrameHtmlContent(htmlStr: string) {
    const htmlContainer = this.getElement().get(0);
    const frame = htmlContainer.querySelector("#protractor-result") as HTMLIFrameElement;
    const waiting = htmlContainer.querySelector("#waiting") as HTMLElement;

    if (htmlStr && frame && waiting) {
      frame.srcdoc = htmlStr;
      waiting.style.display = "none";
      frame.style.display = "block";
    }
  }
}

class BuildProtractorReportTab extends BaseProtractorReportTab {
  config: TFS_Build_Extension_Contracts.IBuildResultsViewExtensionConfig = VSS.getConfiguration()
  hubName: string = "build"
  attachmentType: string = "protractor.report"
  attachmentName: string = "protractor_report.json"
  screenshotAttachmentType: string = "protractor.screenshot"

  constructor() {
    super()
  }

  public initialize(): void {
    this.config.onBuildChanged((build: TFS_Build_Contracts.Build) => {
      this.findAttachment(build)
    })
  }

  private async findAttachment(build: TFS_Build_Contracts.Build)  {
    try {
      let response = await fetch('./report.html')
      let reportHtmlContent = await response.text()

      let appJs = await fetch('./app.js')
      let appJsContent = await appJs.text()

      this.setTabText('Looking for Report File')
      const vsoContext: WebContext = VSS.getWebContext();
      let taskClient: DT_Client.TaskHttpClient = DT_Client.getClient();

      const projectId = vsoContext.project.id;
      const planId = build.orchestrationPlan.planId;

      let protractorScreenshots = await taskClient.getPlanAttachments(projectId, this.hubName, planId, this.screenshotAttachmentType)
      let protractorAttachment = (await taskClient.getPlanAttachments(projectId, this.hubName, planId, this.attachmentType)).find((attachment) => { return attachment.name === this.attachmentName})

      if (protractorAttachment) {
        this.setTabText('Processing Report File')

        let attachmentContent = await taskClient.getAttachmentContent(projectId, this.hubName, planId, protractorAttachment.timelineId, protractorAttachment.recordId, this.attachmentType, protractorAttachment.name)
        let contentJSON = JSON.parse(JSON.parse(this.convertBufferToString(attachmentContent)))

        if (protractorScreenshots.length > 0) {
          protractorScreenshots.forEach(screenshot => {
            let tc = contentJSON.find((x) => x.screenShotFile.includes(screenshot.name))
            if (tc) {
              tc.screenShotFile = screenshot._links.self.href
            }
          })
        }

        mustache.tags =  [ '<%', '%>' ];
        mustache.escape = function(text) { return text }
        let renderedApp = mustache.render(appJsContent, {resultJSON: JSON.stringify(contentJSON)})
        let renderedReportHtml = mustache.render(reportHtmlContent, { appJsScript: renderedApp })
        this.setFrameHtmlContent(renderedReportHtml)
      } else {
        throw new Error("Report File Not Found")
      }
    } catch (err) {
      const container = this.getElement().get(0);
      const spinner = container.querySelector(".spinner") as HTMLElement;
      const errorBadge = container.querySelector('.error-badge') as HTMLElement;
      if (spinner && errorBadge) {
        spinner.style.display = 'none';
        errorBadge.style.display = 'block';
      }
      this.setTabText('Failed to load Protractor Report')
    }
  }

  private setTabText (message: string) {
    const htmlContainer = this.getElement().get(0)
    htmlContainer.querySelector("#waiting p").innerHTML = message
  }
}



// class ReleaseProtractorResultTab extends BaseProtractorResultTab {
//   environment: TFS_Release_Contracts.ReleaseEnvironment

//   constructor() {
//     super();
//   }

//   public initialize(): void {
//     super.initialize();
//     this.environment =  VSS.getConfiguration().releaseEnvironment
//   }
// }


const htmlContainer = document.getElementById("container");
BuildProtractorReportTab.enhance(BuildProtractorReportTab, htmlContainer, {});

