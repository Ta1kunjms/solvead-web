declare module "sanitize-html" {
  const sanitizeHtml: (html: string, options?: Record<string, unknown>) => string
  export default sanitizeHtml
}
