import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  applyClaim,
  undoClaim,
  type ClaimUpdate,
} from "./claim-orders-logic"

export const moveGuestOrdersStep = createStep(
  "move-guest-orders",
  async (updates: ClaimUpdate[], { container }) => {
    const moved = await applyClaim(container.resolve(Modules.ORDER), updates)
    return new StepResponse(moved, updates)
  },
  // If a later step of the workflow fails, the orders go back to their guests
  async (updates, { container }) => {
    if (!updates) {
      return
    }
    await undoClaim(container.resolve(Modules.ORDER), updates)
  }
)

export type ClaimOrdersInput = {
  updates: ClaimUpdate[]
}

// Moves guest orders to the customer that proved the email (the checks are made
// by the route, see api/guest-claim.ts). Gives the ids that were moved.
export const claimOrdersWorkflow = createWorkflow(
  "claim-orders",
  (input: ClaimOrdersInput) => {
    const updates = transform({ input }, ({ input }) => input.updates)
    const moved = moveGuestOrdersStep(updates)
    return new WorkflowResponse(moved)
  }
)
