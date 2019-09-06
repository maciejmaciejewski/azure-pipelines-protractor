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

  protected setTabText (message: string) {
    const htmlContainer = this.getElement().get(0)
    htmlContainer.querySelector("#waiting p").innerHTML = message
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
    super.initialize();

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
}


class ReleaseProtractorReportTab extends BaseProtractorReportTab {
  environment: TFS_Release_Contracts.ReleaseEnvironment
  attachmentType: string = "protractor.report"
  attachmentName: string = "protractor_report.json"
  screenshotAttachmentType: string = "protractor.screenshot"

  constructor() {
    super();
  }

  public initialize(): void {
    super.initialize();
    this.environment =  VSS.getConfiguration().releaseEnvironment
    this.findfindAttachment(this.environment.releaseId, this.environment.id)
  }

  private async findfindAttachment(releaseId, environmentId) {
    let response = await fetch('./report.html')
    let reportHtmlContent = await response.text()

    let appJs = await fetch('./app.js')
    let appJsContent = await appJs.text()

    const vsoContext: WebContext = VSS.getWebContext();
    const rmClient = RM_Client.getClient() as RM_Client.ReleaseHttpClient;
    const release = await rmClient.getRelease(vsoContext.project.id, releaseId);
    const env = release.environments.filter((e) => e.id === environmentId)[0];

    try {
      if (!(env.deploySteps && env.deploySteps.length)) {
        throw new Error("This release has not been deployed yet");
      }

      const deployStep = env.deploySteps[env.deploySteps.length - 1];
      if (!(deployStep.releaseDeployPhases && deployStep.releaseDeployPhases.length)) {
        throw new Error("This release has no job");
      }

      const runPlanIds = deployStep.releaseDeployPhases.map((phase) => phase.runPlanId);
      var runPlanId = null;
      if (!runPlanIds.length) {
        throw new Error("There are no plan IDs");
      } else {
        searchForRunPlanId: {
          for (const phase of deployStep.releaseDeployPhases) {
            for (const deploymentJob of phase.deploymentJobs){
              for (const task of deploymentJob.tasks){
                if (typeof task.task !== 'undefined' && task.task.id === "58dde358-3f32-518a-8081-df29ee91c249"){
                  runPlanId = phase.runPlanId;
                  break searchForRunPlanId;
                }
              }
            }
          }
        }
      }

      const attachments = await rmClient.getTaskAttachments(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        this.attachmentType,
      );


      if (attachments.length === 0) {
        throw new Error("There is no HTML result attachment");
      }

      const attachment = attachments[attachments.length - 1];
      if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
        throw new Error("There is no downloadable HTML result attachment");
      }

      const attachmentContent = await rmClient.getTaskAttachmentContent(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        attachment.recordId,
        this.attachmentType,
        attachment.name,
      );

      const contentJSON =  JSON.parse(JSON.parse(this.convertBufferToString(attachmentContent)));
      console.log(contentJSON)

      const screenshots = (await rmClient.getTaskAttachments(
        vsoContext.project.id,
        env.releaseId,
        env.id,
        deployStep.attempt,
        runPlanId,
        this.screenshotAttachmentType,
      ))

      screenshots.forEach(screenshot => {
          let tc = contentJSON.find((x) => x.screenShotFile.includes(screenshot.name))
          tc.screenShotFile = screenshot._links.self.href;
      })

      mustache.tags =  [ '<%', '%>' ];
      mustache.escape = function(text) { return text }
      let renderedApp = mustache.render(appJsContent, {resultJSON: JSON.stringify(contentJSON)})
      let renderedReportHtml = mustache.render(reportHtmlContent, { appJsScript: renderedApp })
      this.setFrameHtmlContent(renderedReportHtml)
    } catch (error) {
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
}

const htmlContainer = document.getElementById("container");
console.log(VSS.getConfiguration())
if (typeof VSS.getConfiguration().onBuildChanged === "function") {
  BuildProtractorReportTab.enhance(BuildProtractorReportTab, htmlContainer, {});
} else if (typeof VSS.getConfiguration().releaseEnvironment === "object") {
  ReleaseProtractorReportTab.enhance(ReleaseProtractorReportTab, htmlContainer, {});
}

