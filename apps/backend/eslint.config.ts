import { defineConfig } from "eslint/config"
import medusa from "@medusajs/eslint-plugin"

export default defineConfig([
  // Built files are not our code: the admin bundle in public/ is one 7 MB minified
  // line that makes `medusa lint` fail with "Invalid string length".
  { ignores: ["public/**", ".medusa/**", "dist/**", "build/**", "uploads/**"] },
  ...medusa.configs.recommended,
])
