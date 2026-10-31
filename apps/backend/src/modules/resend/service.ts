import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { Resend } from "resend"
import {
  EMAIL_TEMPLATES,
  EmailDataError,
  formatFrom,
  renderEmail,
} from "./email-templates"

type ResendOptions = {
  api_key: string
  // The sender address, for example "orders@getcardy.shop". The store's name is
  // put in front of it for each email.
  from: string
}

type InjectedDependencies = {
  logger: Logger
}

// Sends the store's emails through Resend. The notification module records a
// notification as sent whenever send() returns, so a failed email must throw:
// returning an empty result would show a failed email as sent and a retry
// with the same idempotency key would be skipped.
class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  protected resendClient: Resend
  protected options: ResendOptions
  protected logger: Logger

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super()
    this.resendClient = new Resend(options.api_key)
    this.options = options
    this.logger = logger
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the Resend provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the Resend provider's options."
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    let email: ReturnType<typeof renderEmail>
    try {
      email = renderEmail(notification.template, notification.data)
    } catch (e) {
      if (e instanceof EmailDataError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, e.message)
      }
      throw e
    }

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `There is no email template "${notification.template}". The valid ones are: ${Object.values(EMAIL_TEMPLATES).join(", ")}`
      )
    }

    const { data, error } = await this.resendClient.emails.send({
      from: formatFrom(this.options.from, email.fromName),
      to: [notification.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    if (error || !data) {
      const reason = error?.message || "unknown error"
      this.logger.error(`Resend could not send the "${notification.template}" email: ${reason}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend could not send the email: ${reason}`
      )
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
