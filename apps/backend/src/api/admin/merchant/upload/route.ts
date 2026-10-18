import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  await getMerchantContext(req)

  const rawFiles = (req as any).files || ((req as any).file ? [(req as any).file] : [])
  const files = Array.isArray(rawFiles) ? rawFiles : [rawFiles]

  if (!files || !files.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files provided for upload"
    )
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: files.map((f: any) => ({
        filename: f.originalname,
        content: f.buffer.toString("base64"),
        mimeType: f.mimetype,
        access: "public",
      })),
    },
  })

  res.status(201).json({ files: result })
}
