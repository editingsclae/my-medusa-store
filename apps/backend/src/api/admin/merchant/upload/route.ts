import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { getMerchantContext } from "../utils"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  await getMerchantContext(req)

  const rawFiles = (req as any).files || ((req as any).file ? [(req as any).file] : [])
  const allFiles: any[] = Array.isArray(rawFiles) ? rawFiles : [rawFiles]

  if (!allFiles || !allFiles.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No files provided for upload"
    )
  }

  // Deduplicate: multer's upload.any() collects all form fields including duplicates
  // (e.g. if client accidentally appends the same file under two field names).
  // Keep only the first occurrence of each unique file by originalname + size.
  const seen = new Set<string>()
  const files = allFiles.filter((f: any) => {
    const key = `${f.originalname}::${f.size}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

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
