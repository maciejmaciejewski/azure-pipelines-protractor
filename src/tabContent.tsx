import "./tabContent.scss"

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as SDK from "azure-devops-extension-sdk"

import fetch from "node-fetch"
import * as createDOMPurify from "dompurify"

import { getClient } from "azure-devops-extension-api"
import { ReleaseEnvironment, ReleaseRestClient, ReleaseTaskAttachment } from "azure-devops-extension-api/Release"
import { Build, BuildRestClient, Attachment } from "azure-devops-extension-api/Build"
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api"

import { ObservableValue, ObservableObject } from "azure-devops-ui/Core/Observable"
import { Observer } from "azure-devops-ui/Observer"
import { Tab, TabBar, TabSize } from "azure-devops-ui/Tabs"

import * as mustache from 'mustache'

const ATTACHMENT_TYPE = "protractor.report";
const SCREENSHOT_ATTACHMENT_TYPE = "protractor.screenshot";
const OUR_TASK_IDS = ["f921c333-68d3-50ff-9d01-c71ecafad96b", "3b603ffa-eaed-5a30-87b4-7ffdadd8f7c2"] // 3b603ffa is the dev ext published as Finastra

SDK.init()
SDK.ready().then(() => {
    try {
        const config = SDK.getConfiguration()
        if (typeof config.onBuildChanged === "function") {
            config.onBuildChanged((build: Build) => {
                let buildAttachmentClient = new BuildAttachmentClient(build)
                buildAttachmentClient.init().then(() => {
                    displayReports(buildAttachmentClient)
                }).catch(error => {setError(error)})
            })
        } else if (typeof config.releaseEnvironment === "object") {
            let releaseAttachmentClient = new ReleaseAttachmentClient(config.releaseEnvironment)
            releaseAttachmentClient.init().then(() => {
                displayReports(releaseAttachmentClient)
            }).catch(error => {setError(error)})
        }
    } catch(error) {
        setError(error)
    }
})

function setText (message: string) {
    console.log(message)
    const messageContainer = document.querySelector("#protractor-ext-message p")
    if (messageContainer) {
        messageContainer.innerHTML = message
    }
}

function setError (error: Error) {
    setText('Error loading reports')
    console.log(error)
}

function displayReports(attachmentClient: AttachmentClient) {
    const nbAttachments = attachmentClient.getAttachments().length
    if (nbAttachments) {
        ReactDOM.render(<TaskAttachmentPanel attachmentClient={attachmentClient} />, document.getElementById("protractor-ext-container"))
        document.getElementById("protractor-ext-message").style.display = "none"
    } else {
        setText("Can't find any report attachment")
    }
}

SDK.register("registerRelease", {
  isInvisible: function (state) {
      let resultArray = []
      state.releaseEnvironment.deployPhasesSnapshot.forEach(phase => {
          phase.workflowTasks.forEach(task => {
              resultArray.push(task.taskId)
          })
      })
      return !OUR_TASK_IDS.some(id => resultArray.includes(id))
  }
})

interface TaskAttachmentPanelProps {
  attachmentClient: AttachmentClient
}

export default class TaskAttachmentPanel extends React.Component<TaskAttachmentPanelProps> {
  private selectedTabId: ObservableValue<string>
  private tabContents: ObservableObject<string>
  private tabInitialContent: string = '<div class="wide"><p>Loading...</p></div>'
  private purify = createDOMPurify()
  private purifyConfig = {
      USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
      ALLOW_DATA_ATTR: true,
      FORCE_BODY: true
  }

  constructor(props: TaskAttachmentPanelProps) {
      super(props);
      this.selectedTabId = new ObservableValue(props.attachmentClient.getAttachments()[0].name)
      this.tabContents = new ObservableObject()
  }
  public componentDidMount() {
      const config = SDK.getConfiguration()
      SDK.notifyLoadSucceeded().then(() => {
          SDK.resize()
      });
  }

  public escapeHTML(str: string) {
    return str.replace(/[&<>'"]/g, tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag] || tag))
  }

  public render() {
      const attachments = this.props.attachmentClient.getAttachments()
      if (attachments.length == 0) {
          return (null)
      } else {
          const tabs = []
          for (const attachment of attachments) {
              tabs.push(<Tab name={attachment.name} id={attachment.name} key={attachment.name} url={attachment._links.self.href}/>)
              this.tabContents.add(attachment.name, this.tabInitialContent)
          }
          return (
              <div className="flex-column">
                  { attachments.length > 1 ?
                      <TabBar
                          onSelectedTabChanged={this.onSelectedTabChanged}
                          selectedTabId={this.selectedTabId}
                          tabSize={TabSize.Tall}
                      >
                          {tabs}

                      </TabBar>
                  : null }
                  <Observer selectedTabId={this.selectedTabId} tabContents={this.tabContents}>
                      {(props: { selectedTabId: string }) => {
                          if ( this.tabContents.get(props.selectedTabId) === this.tabInitialContent) {
                              this.props.attachmentClient.getAttachmentContent(props.selectedTabId).then((content) => {
                                  //this.tabContents.set(props.selectedTabId, this.purify.sanitize(content, this.purifyConfig))
                              this.tabContents.set(props.selectedTabId, '<iframe class="wide" srcdoc="' + this.escapeHTML(content) + '"></iframe>')
                              }).catch(error => {
                                  this.tabContents.set(props.selectedTabId, '<div class="wide"><p>Error loading report:<br/>' + error + '</p></div>')
                                  setError(error)
                              })
                          }
                          return  <span dangerouslySetInnerHTML={ {__html: this.tabContents.get(props.selectedTabId)} } />
                      }}
                  </Observer>
              </div>
          );
      }
  }

  private onSelectedTabChanged = (newTabId: string) => {
      this.selectedTabId.value = newTabId;
  }
}

abstract class AttachmentClient {
  protected attachments: Attachment[]  | ReleaseTaskAttachment[] = []
  protected authHeaders: Object = undefined
  protected reportHtmlContent: string = undefined
  protected appJsContent: string = undefined
  constructor() {}

  async loadReportTemplates() {
    console.log('Get report templates')
    const response = await fetch('./report.html')
    this.reportHtmlContent = await response.text()
    const appJs = await fetch('./app.js')
    this.appJsContent = await appJs.text()
  }

  // Retrieve attachments and attachment contents from AzDO
  abstract async init(): Promise<void>

  public getAttachments() : Attachment[]  | ReleaseTaskAttachment[] {
      return this.attachments
  }

  public getDownloadableAttachment(attachmentName: string): Attachment | ReleaseTaskAttachment {
      const attachment = this.attachments.find((attachment) => { return attachment.name === attachmentName})
      if (!(attachment && attachment._links && attachment._links.self && attachment._links.self.href)) {
          throw new Error("Attachment " + attachmentName + " is not downloadable")
      }
      return attachment
  }

  abstract async getScreenshotAttachments(): Promise<Attachment[] | ReleaseTaskAttachment[]>

  public async getAttachmentContent(attachmentName: string): Promise<string> {
    setText('Looking for Report File')
    if (this.authHeaders === undefined) {
        console.log('Get access token')
        const accessToken = await SDK.getAccessToken()
        const b64encodedAuth = Buffer.from(':' + accessToken).toString('base64')
        this.authHeaders = { headers: {'Authorization': 'Basic ' + b64encodedAuth} }
    }
    console.log("Get " + attachmentName + " attachment content")
    const attachment = this.getDownloadableAttachment(attachmentName)
    const response = await fetch(attachment._links.self.href, this.authHeaders)
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    setText('Processing Report File')
    const contentJSON = JSON.parse(JSON.parse(await response.text()))
    const screenshots = await this.getScreenshotAttachments()
    if (screenshots.length > 0) {
      screenshots.forEach(screenshot => {
        const tc = contentJSON.find((x) => x.screenShotFile.includes(screenshot.name))
        if (tc) {
          tc.screenShotFile = screenshot._links.self.href
        }
      })
    }
    mustache.tags =  [ '<%', '%>' ];
    mustache.escape = function(text) { return text }
    const renderedApp = mustache.render(this.appJsContent, {resultJSON: JSON.stringify(contentJSON)})
    const renderedReportHtml = mustache.render(this.reportHtmlContent, { appJsScript: renderedApp })
    return renderedReportHtml
  }
}



class BuildAttachmentClient extends AttachmentClient {
  private build: Build

  constructor(build: Build) {
    super()
    this.build = build
  }

  public async init() {
    await this.loadReportTemplates()
    console.log('Get attachment list')
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    this.attachments = await buildClient.getAttachments(this.build.project.id, this.build.id, ATTACHMENT_TYPE)
  }

  public async getScreenshotAttachments(): Promise<Attachment[]> {
    const buildClient: BuildRestClient = getClient(BuildRestClient)
    return await buildClient.getAttachments(this.build.project.id, this.build.id, SCREENSHOT_ATTACHMENT_TYPE)
  }
}

class ReleaseAttachmentClient extends AttachmentClient {
  private releaseEnvironment: ReleaseEnvironment
  private projectId
  private deployStepAttempt
  private runPlanId

  constructor(releaseEnvironment: ReleaseEnvironment) {
    super()
    this.releaseEnvironment = releaseEnvironment
  }

  public async init() {
    await this.loadReportTemplates()
    const releaseId = this.releaseEnvironment.releaseId
    const environmentId = this.releaseEnvironment.id
    console.log('Get project')
    const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService)
    const project = await projectService.getProject()
    console.log('Get release')
    const releaseClient: ReleaseRestClient = getClient(ReleaseRestClient)
    const release = await releaseClient.getRelease(project.id, releaseId)
    const env = release.environments.filter((e) => e.id === environmentId)[0]

    if (!(env.deploySteps && env.deploySteps.length)) {
      throw new Error("This release has not been deployed yet")
    }

    const deployStep = env.deploySteps[env.deploySteps.length - 1]
    if (!(deployStep.releaseDeployPhases && deployStep.releaseDeployPhases.length)) {
      throw new Error("This release has no job");
    }

    const runPlanIds = deployStep.releaseDeployPhases.map((phase) => phase.runPlanId)
    if (!runPlanIds.length) {
        throw new Error("There are no plan IDs");
    } else {
      searchForRunPlanId: {
        for (const phase of deployStep.releaseDeployPhases) {
          for (const deploymentJob of phase.deploymentJobs) {
            for (const task of deploymentJob.tasks){
              if (OUR_TASK_IDS.includes(task.task?.id)) {
                this.runPlanId = phase.runPlanId;
                break searchForRunPlanId
              }
            }
          }
        }
      }
    }
    this.projectId = project.id
    this.deployStepAttempt = deployStep.attempt
    console.log('Get attachments')
    this.attachments = await releaseClient.getReleaseTaskAttachments(project.id, releaseId, environmentId, deployStep.attempt, this.runPlanId, ATTACHMENT_TYPE)
    if (this.attachments.length === 0) {
        throw new Error("There is no attachment")
    }
    if (this.attachments.length >1) {
        throw new Error("There is more than a single attachment, this is not expected")
    }
  }

  public async getScreenshotAttachments(): Promise<ReleaseTaskAttachment[]> {
    const releaseClient: ReleaseRestClient = getClient(ReleaseRestClient)
    return await releaseClient.getReleaseTaskAttachments(this.projectId, this.releaseEnvironment.releaseId, this.releaseEnvironment.id, this.deployStepAttempt, this.runPlanId, SCREENSHOT_ATTACHMENT_TYPE)
  }

}






    // } catch (error) {
    //   const container = this.getElement().get(0);
    //   const spinner = container.querySelector(".spinner") as HTMLElement;
    //   const errorBadge = container.querySelector('.error-badge') as HTMLElement;
    //   if (spinner && errorBadge) {
    //     spinner.style.display = 'none';
    //     errorBadge.style.display = 'block';
    //   }
    //   this.setTabText('Failed to load Protractor Report')
    // }
