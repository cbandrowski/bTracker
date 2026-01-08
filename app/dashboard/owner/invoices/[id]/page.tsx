
'use client'

import React, { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function InvoiceViewPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const invoiceId = resolvedParams.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [depositApplications, setDepositApplications] = useState<any[]>([])
  const [paymentApplications, setPaymentApplications] = useState<any[]>([])
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const invoiceRef = useRef<HTMLDivElement>(null)
  const PDF_BACKGROUND_COLOR = '#ffffff'
  const PDF_TEXT_COLOR = '#000000'
  const PDF_PAGE_WIDTH_PX = 816

  const TAILWIND_COLOR_VARIABLES = [
    '--color-white',
    '--color-black',
    '--color-gray-50',
    '--color-gray-100',
    '--color-gray-200',
    '--color-gray-300',
    '--color-gray-400',
    '--color-gray-500',
    '--color-gray-600',
    '--color-gray-700',
    '--color-gray-800',
    '--color-gray-900',
    '--color-blue-50',
    '--color-blue-100',
    '--color-blue-200',
    '--color-blue-400',
    '--color-blue-600',
    '--color-blue-800',
    '--color-blue-900',
    '--color-green-50',
    '--color-green-100',
    '--color-green-200',
    '--color-green-400',
    '--color-green-600',
    '--color-green-800',
    '--color-green-900',
    '--color-yellow-200',
    '--color-yellow-100',
    '--color-yellow-800',
    '--color-yellow-900',
    '--color-red-200',
    '--color-red-100',
    '--color-red-800',
    '--color-red-900',
  ]

  const clamp = (value: number, min = 0, max = 1) => {
    return Math.min(max, Math.max(min, value))
  }

  const parseCssNumber = (token: string) => {
    const match = token.trim().match(/^([-+]?\d*\.?\d+)([a-z%]*)$/i)
    if (!match) {
      return { value: Number.NaN, unit: '' }
    }
    return { value: Number.parseFloat(match[1]), unit: match[2].toLowerCase() }
  }

  const parseAlphaValue = (token?: string) => {
    if (!token) {
      return 1
    }
    const { value, unit } = parseCssNumber(token)
    if (!Number.isFinite(value)) {
      return 1
    }
    if (unit === '%') {
      return clamp(value / 100)
    }
    return clamp(value)
  }

  const parseHueValue = (token: string) => {
    const { value, unit } = parseCssNumber(token)
    if (!Number.isFinite(value)) {
      return 0
    }
    switch (unit) {
      case 'rad':
        return (value * 180) / Math.PI
      case 'turn':
        return value * 360
      case 'grad':
        return value * 0.9
      default:
        return value
    }
  }

  const formatRgb = (r: number, g: number, b: number, alpha = 1) => {
    const red = Math.round(clamp(r) * 255)
    const green = Math.round(clamp(g) * 255)
    const blue = Math.round(clamp(b) * 255)
    const safeAlpha = clamp(alpha)
    if (safeAlpha < 1) {
      return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(3))})`
    }
    return `rgb(${red}, ${green}, ${blue})`
  }

  const linearToSrgb = (value: number) => {
    const clamped = clamp(value)
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
  }

  const parseFunctionArgs = (value: string, name: string) => {
    const normalized = value.trim()
    if (!normalized.toLowerCase().startsWith(`${name}(`)) {
      return null
    }
    const content = normalized.slice(name.length + 1, -1)
    const [componentsPart, alphaPart] = content.split('/').map(part => part.trim())
    const components = componentsPart.replace(/,/g, ' ').split(/\s+/).filter(Boolean)
    return { components, alpha: alphaPart }
  }

  const parseOklab = (value: string) => {
    const parsed = parseFunctionArgs(value, 'oklab')
    if (!parsed || parsed.components.length < 3) {
      return null
    }
    const [lToken, aToken, bToken] = parsed.components
    const lParsed = parseCssNumber(lToken)
    let L = lParsed.value
    if (!Number.isFinite(L)) {
      return null
    }
    if (lParsed.unit === '%') {
      L = L / 100
    } else if (L > 1) {
      L = L / 100
    }
    const aParsed = parseCssNumber(aToken)
    const bParsed = parseCssNumber(bToken)
    if (!Number.isFinite(aParsed.value) || !Number.isFinite(bParsed.value)) {
      return null
    }
    const a = aParsed.unit === '%' ? aParsed.value / 100 : aParsed.value
    const b = bParsed.unit === '%' ? bParsed.value / 100 : bParsed.value
    return { L, a, b, alpha: parseAlphaValue(parsed.alpha) }
  }

  const parseOklch = (value: string) => {
    const parsed = parseFunctionArgs(value, 'oklch')
    if (!parsed || parsed.components.length < 3) {
      return null
    }
    const [lToken, cToken, hToken] = parsed.components
    const lParsed = parseCssNumber(lToken)
    let L = lParsed.value
    if (!Number.isFinite(L)) {
      return null
    }
    if (lParsed.unit === '%') {
      L = L / 100
    } else if (L > 1) {
      L = L / 100
    }
    const cParsed = parseCssNumber(cToken)
    if (!Number.isFinite(cParsed.value)) {
      return null
    }
    const C = cParsed.unit === '%' ? cParsed.value / 100 : cParsed.value
    const H = parseHueValue(hToken)
    const a = C * Math.cos((H * Math.PI) / 180)
    const b = C * Math.sin((H * Math.PI) / 180)
    return { L, a, b, alpha: parseAlphaValue(parsed.alpha) }
  }

  const parseLab = (value: string) => {
    const parsed = parseFunctionArgs(value, 'lab')
    if (!parsed || parsed.components.length < 3) {
      return null
    }
    const [lToken, aToken, bToken] = parsed.components
    const lParsed = parseCssNumber(lToken)
    let L = lParsed.value
    if (!Number.isFinite(L)) {
      return null
    }
    if (lParsed.unit === '%') {
      L = L
    } else if (L <= 1) {
      L = L * 100
    }
    const aParsed = parseCssNumber(aToken)
    const bParsed = parseCssNumber(bToken)
    if (!Number.isFinite(aParsed.value) || !Number.isFinite(bParsed.value)) {
      return null
    }
    const a = aParsed.value
    const b = bParsed.value
    return { L, a, b, alpha: parseAlphaValue(parsed.alpha) }
  }

  const oklabToRgb = (L: number, a: number, b: number, alpha: number) => {
    const l = L + 0.3963377774 * a + 0.2158037573 * b
    const m = L - 0.1055613458 * a - 0.0638541728 * b
    const s = L - 0.0894841775 * a - 1.291485548 * b

    const l3 = l * l * l
    const m3 = m * m * m
    const s3 = s * s * s

    const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

    return formatRgb(
      linearToSrgb(rLinear),
      linearToSrgb(gLinear),
      linearToSrgb(bLinear),
      alpha
    )
  }

  const labToRgb = (L: number, a: number, b: number, alpha: number) => {
    const fy = (L + 16) / 116
    const fx = a / 500 + fy
    const fz = fy - b / 200

    const epsilon = 216 / 24389
    const kappa = 24389 / 27

    const fx3 = fx * fx * fx
    const fz3 = fz * fz * fz

    const xr = fx3 > epsilon ? fx3 : (116 * fx - 16) / kappa
    const yr = L > kappa * epsilon ? Math.pow((L + 16) / 116, 3) : L / kappa
    const zr = fz3 > epsilon ? fz3 : (116 * fz - 16) / kappa

    const X = xr * 0.96422
    const Y = yr * 1.0
    const Z = zr * 0.82521

    const xD65 = 0.9554734 * X + -0.0230985 * Y + 0.0632593 * Z
    const yD65 = -0.0283697 * X + 1.0099956 * Y + 0.0210414 * Z
    const zD65 = 0.012314 * X + -0.0205077 * Y + 1.3303659 * Z

    const rLinear = 3.2404542 * xD65 - 1.5371385 * yD65 - 0.4985314 * zD65
    const gLinear = -0.969266 * xD65 + 1.8760108 * yD65 + 0.041556 * zD65
    const bLinear = 0.0556434 * xD65 - 0.2040259 * yD65 + 1.0572252 * zD65

    return formatRgb(
      linearToSrgb(rLinear),
      linearToSrgb(gLinear),
      linearToSrgb(bLinear),
      alpha
    )
  }

  const normalizeColorValue = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return trimmed
    }
    const lower = trimmed.toLowerCase()
    if (lower.includes('color-mix(')) {
      return '#000000'
    }
    if (lower.startsWith('oklch(')) {
      const parsed = parseOklch(trimmed)
      if (parsed) {
        return oklabToRgb(parsed.L, parsed.a, parsed.b, parsed.alpha)
      }
    }
    if (lower.startsWith('oklab(')) {
      const parsed = parseOklab(trimmed)
      if (parsed) {
        return oklabToRgb(parsed.L, parsed.a, parsed.b, parsed.alpha)
      }
    }
    if (lower.startsWith('lab(')) {
      const parsed = parseLab(trimmed)
      if (parsed) {
        return labToRgb(parsed.L, parsed.a, parsed.b, parsed.alpha)
      }
    }
    return trimmed
  }

  const buildColorVariableOverrides = () => {
    if (typeof window === 'undefined') {
      return ''
    }
    const rootStyles = window.getComputedStyle(document.documentElement)
    const overrides = TAILWIND_COLOR_VARIABLES.map(variable => {
      const raw = rootStyles.getPropertyValue(variable).trim()
      if (!raw) {
        return null
      }
      const normalized = normalizeColorValue(raw)
      return `${variable}: ${normalized};`
    }).filter(Boolean)

    return overrides.join(' ')
  }

  const waitForInvoiceAssets = async (element: HTMLDivElement) => {
    if (document.fonts?.ready) {
      await document.fonts.ready
    }

    const images = Array.from(element.querySelectorAll('img'))
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve()
        }

        return new Promise<void>(resolve => {
          const handleDone = () => {
            img.removeEventListener('load', handleDone)
            img.removeEventListener('error', handleDone)
            resolve()
          }
          img.addEventListener('load', handleDone)
          img.addEventListener('error', handleDone)
        })
      })
    )
  }

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true)
        const response = await fetch(`/api/invoices/${invoiceId}`)
        if (response.ok) {
          const data = await response.json()
          setInvoice(data.invoice)
          setLines(data.lines)
          setCompany(data.company)
          setDepositApplications(data.deposit_applications || [])
          setPaymentApplications(data.payment_applications || [])
        }
      } catch (error) {
        console.error('Error fetching invoice:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [invoiceId])

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current || !invoice) {
      console.error('Invoice ref or invoice data not available')
      return
    }

    setDownloadingPDF(true)
    try {
      const shouldNormalizeColor = (value: string) => {
        const normalized = value.toLowerCase()
        return (
          normalized.includes('lab(') ||
          normalized.includes('oklab(') ||
          normalized.includes('oklch(') ||
          normalized.includes('color-mix')
        )
      }

      const colorVariableOverrides = buildColorVariableOverrides()
      await waitForInvoiceAssets(invoiceRef.current)
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: PDF_BACKGROUND_COLOR,
        onclone: (doc) => {
          const clone = doc.querySelector('[data-invoice-content]')
          if (!clone) {
            return
          }
          doc.documentElement.style.width = `${PDF_PAGE_WIDTH_PX}px`
          doc.documentElement.style.margin = '0'
          doc.documentElement.style.padding = '0'
          doc.body.style.width = `${PDF_PAGE_WIDTH_PX}px`
          doc.body.style.margin = '0'
          doc.body.style.padding = '0'
          clone.setAttribute('style', `${clone.getAttribute('style') || ''}; width: ${PDF_PAGE_WIDTH_PX}px; max-width: none; margin: 0; box-sizing: border-box;`)
          const styleLines: string[] = []
          if (colorVariableOverrides) {
            styleLines.push(`[data-invoice-content]{${colorVariableOverrides}}`)
          }
          styleLines.push(
            `[data-invoice-content], [data-invoice-content] * { background-color: ${PDF_BACKGROUND_COLOR} !important; background-image: none !important; box-shadow: none !important; text-shadow: none !important; color: ${PDF_TEXT_COLOR} !important; }`
          )
          if (styleLines.length > 0) {
            const style = doc.createElement('style')
            style.textContent = styleLines.join('\n')
            doc.head.appendChild(style)
          }
          const sourceRoot = invoiceRef.current
          if (sourceRoot) {
            const sourceWalker = document.createTreeWalker(
              sourceRoot,
              NodeFilter.SHOW_ELEMENT
            )
            const cloneWalker = doc.createTreeWalker(
              clone,
              NodeFilter.SHOW_ELEMENT
            )
            const colorProps = [
              'border-top-color',
              'border-right-color',
              'border-bottom-color',
              'border-left-color',
              'outline-color',
              'text-decoration-color',
              'caret-color',
              'fill',
              'stroke',
            ]

            let sourceNode = sourceWalker.currentNode as Element | null
            let cloneNode = cloneWalker.currentNode as Element | null

            while (sourceNode && cloneNode) {
              const sourceStyle = window.getComputedStyle(sourceNode)
              const cloneElement = cloneNode as HTMLElement

              if (cloneElement.tagName !== 'IMG') {
                cloneElement.style.setProperty('background-color', PDF_BACKGROUND_COLOR, 'important')
                cloneElement.style.setProperty('background-image', 'none', 'important')
                cloneElement.style.setProperty('color', PDF_TEXT_COLOR, 'important')
              }

              colorProps.forEach((property) => {
                const value = sourceStyle.getPropertyValue(property).trim()
                if (!value) {
                  return
                }
                const normalized = shouldNormalizeColor(value)
                  ? normalizeColorValue(value)
                  : value
                cloneElement.style.setProperty(property, normalized, 'important')
              })

              const boxShadow = sourceStyle.getPropertyValue('box-shadow').trim()
              if (boxShadow && shouldNormalizeColor(boxShadow)) {
                cloneElement.style.setProperty('box-shadow', 'none', 'important')
              }

              const textShadow = sourceStyle.getPropertyValue('text-shadow').trim()
              if (textShadow && shouldNormalizeColor(textShadow)) {
                cloneElement.style.setProperty('text-shadow', 'none', 'important')
              }

              const backgroundImage = sourceStyle.getPropertyValue('background-image').trim()
              if (backgroundImage && shouldNormalizeColor(backgroundImage)) {
                cloneElement.style.setProperty('background-image', 'none', 'important')
              }

              sourceNode = sourceWalker.nextNode() as Element | null
              cloneNode = cloneWalker.nextNode() as Element | null
            }
          }
          const images = Array.from(clone.querySelectorAll('img'))
          images.forEach(img => {
            img.setAttribute('crossorigin', 'anonymous')
          })
        },
      })

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      })

      const imgData = canvas.toDataURL('image/png', 1.0)
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Create filename with customer name and invoice number
      const customerName = invoice.customers?.name || 'Customer'
      const invoiceNumber = invoice.invoice_number || invoiceId
      const safeCustomerName = customerName.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `Invoice_${invoiceNumber}_${safeCustomerName}.pdf`

      pdf.save(filename)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDownloadingPDF(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'partial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'issued':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'void':
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoice not found
          </h2>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const customer = invoice.customers

  const billToAddress = [
    customer?.billing_address,
    customer?.billing_address_line_2,
    [customer?.billing_city, customer?.billing_state, customer?.billing_zipcode].filter(Boolean).join(' ').trim() || null,
  ].filter(Boolean).join(', ')

  const billToLine = [customer?.name || 'Customer', billToAddress].filter(Boolean).join(', ')

  // Filter out backend-only lines (like "Services for job [uuid]" with $0)
  const filteredLines = lines.filter(line => {
    const desc = line.description?.toLowerCase() || ''
    const amount = Number(line.unit_price || 0)

    // Filter out "Services for job" lines with UUID pattern and $0 amount
    if (desc.includes('service') && desc.includes('for job') && amount === 0) {
      // Check if description contains a UUID pattern
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      if (uuidPattern.test(line.description || '')) {
        return false
      }
    }

    return true
  })

  // Group lines by job
  const groupedLines: { [key: string]: any[] } = {}
  const standaloneLines: any[] = []

  filteredLines.forEach(line => {
    if (line.job_id && line.jobs) {
      if (!groupedLines[line.job_id]) {
        groupedLines[line.job_id] = []
      }
      groupedLines[line.job_id].push(line)
    } else {
      standaloneLines.push(line)
    }
  })

  // Calculate subtotal (excluding deposits)
  const subtotal = filteredLines
    .filter(line => line.line_type !== 'deposit_applied')
    .reduce((sum, line) => {
      const lineTotal = Number(line.line_total || 0)
      return sum + lineTotal
    }, 0)

  // Calculate tax
  const taxTotal = filteredLines
    .filter(line => line.line_type !== 'deposit_applied')
    .reduce((sum, line) => {
      const lineTotal = Number(line.line_total || 0)
      const taxRate = Number(line.tax_rate || 0)
      return sum + (lineTotal * taxRate)
    }, 0)

  // Total = subtotal + tax
  const total = subtotal + taxTotal

  // Deposits applied (negative amounts)
  const depositsApplied = filteredLines
    .filter(line => line.line_type === 'deposit_applied')
    .reduce((sum, line) => sum + Math.abs(Number(line.line_total || 0)), 0)

  // Payments applied separately
  const paymentsApplied = Number(invoice.total_paid || 0)

  // Balance = total - deposits - payments
  const balance = total - depositsApplied - paymentsApplied

  const paymentTermDays =
    invoice.invoice_date && invoice.due_date
      ? Math.max(
          0,
          Math.round(
            (new Date(invoice.due_date).getTime() - new Date(invoice.invoice_date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 print:p-0 print:bg-white print:min-h-0">
        {/* Header Actions - Hidden when printing */}
        <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloadingPDF ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

      {/* Invoice Template */}
      <div
        ref={invoiceRef}
        data-invoice-content
        className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none print:bg-white print:max-w-none"
      >
        {/* Invoice Header */}
        <div className="border-b-4 border-blue-600 p-8 pb-6 print:bg-white">
          <div className="flex justify-between items-start gap-6">
            {/* Company Info with Logo */}
            <div className="flex items-start gap-4 flex-1">
              {/* Company Logo */}
              {company?.logo_url && (
                <div className="flex-shrink-0">
                  <img
                    src={company.logo_url}
                    alt={company.name || 'Company Logo'}
                    className="w-20 h-20 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {/* Company Details */}
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white print:text-gray-900 mb-2">
                  {company?.name || 'Company Name'}
                </h1>
                <div className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 space-y-1">
                  {company?.show_address_on_invoice && company?.address && <div>{company.address}</div>}
                  {company?.show_address_on_invoice && company?.address_line_2 && <div>{company.address_line_2}</div>}
                  {company?.show_address_on_invoice && company?.city && (
                    <div>
                      {company.city}, {company.state} {company.zipcode}
                    </div>
                  )}
                  {company?.phone && <div>Phone: {company.phone}</div>}
                  {company?.email && <div>Email: {company.email}</div>}
                </div>
              </div>
            </div>

            {/* Invoice Info */}
            <div className="text-right flex-shrink-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                INVOICE
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Invoice #:
                  </span>
                  <span className="text-gray-900 dark:text-white font-mono">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Date:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDate(invoice.invoice_date)}
                  </span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Due Date:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                )}
                {paymentTermDays !== null && (
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Payment Term:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {paymentTermDays} day{paymentTermDays === 1 ? '' : 's'} from invoice date
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Status:
                  </span>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Section */}
        <div className="p-8 pb-6">
          <div className="mb-6 grid md:grid-cols-2 gap-6 items-start">
            <div>
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Bill To
              </h3>
              <div className="text-gray-900 dark:text-white space-y-1">
                <div className="font-semibold text-base">
                  {billToLine}
                </div>
                {(customer?.email || customer?.phone) && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {customer?.email && <span>{customer.email}</span>}
                    {customer?.email && customer?.phone && <span className="mx-2">•</span>}
                    {customer?.phone && <span>{customer.phone}</span>}
                  </div>
                )}
              </div>
            </div>

            {invoice.notes && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="px-8 pb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Description
                </th>
                <th className="text-center py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-24">
                  Quantity
                </th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-32">
                  Unit Price
                </th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-32">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Render grouped job lines */}
              {Object.entries(groupedLines).map(([jobId, jobLines]) => {
                const job = (jobLines[0].jobs as any)
                return (
                  <React.Fragment key={jobId}>
                    {/* Job Title Header */}
                    <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <td colSpan={4} className="py-3 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {job?.title || 'Job'}
                        </div>
                      </td>
                    </tr>
                    {/* Job Line Items - Indented */}
                    {jobLines.map((line, index) => (
                      <tr
                        key={line.id}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''
                        }`}
                      >
                        <td className="py-3 pr-4 pl-8">
                          <div className="text-gray-900 dark:text-white">
                            {line.description}
                          </div>
                          {line.line_type !== 'service' && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {line.line_type}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-center text-gray-900 dark:text-white">
                          {Number(line.quantity).toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-gray-900 dark:text-white">
                          {formatCurrency(Number(line.unit_price))}
                        </td>
                        <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(Number(line.line_total))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}

              {/* Render standalone lines (not linked to jobs) */}
              {standaloneLines.map((line, index) => (
                <tr
                  key={line.id}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    index % 2 === 0 && Object.keys(groupedLines).length % 2 === 0
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : index % 2 === 1 && Object.keys(groupedLines).length % 2 === 1
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : ''
                  }`}
                >
                  <td className="py-4 pr-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {line.description}
                    </div>
                    {line.line_type !== 'service' && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {line.line_type}
                      </div>
                    )}
                  </td>
                  <td className="py-4 text-center text-gray-900 dark:text-white">
                    {Number(line.quantity).toFixed(2)}
                  </td>
                  <td className="py-4 text-right text-gray-900 dark:text-white">
                    {formatCurrency(Number(line.unit_price))}
                  </td>
                  <td className="py-4 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Number(line.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="px-8 pb-8">
          <div className="flex justify-between items-start gap-8">
            {/* Payment Details Section - Left Side */}
            {(company?.paypal_handle || company?.zelle_phone || company?.zelle_email || company?.check_payable_to || company?.accept_cash || company?.accept_credit_debit) && (
              <div className="flex-1 max-w-md">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Payment Details
                </h3>
                <div className="space-y-2 text-sm">
                  {company?.accept_cash && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Cash:</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        Accepted
                      </span>
                    </div>
                  )}
                  {company?.accept_credit_debit && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Credit/Debit Card:</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        Accepted
                      </span>
                    </div>
                  )}
                  {company?.paypal_handle && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">PayPal:</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        @{company.paypal_handle}
                      </span>
                    </div>
                  )}
                  {company?.zelle_phone && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Zelle (Phone):</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        {company.zelle_phone}
                      </span>
                    </div>
                  )}
                  {company?.zelle_email && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Zelle (Email):</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        {company.zelle_email}
                      </span>
                    </div>
                  )}
                  {company?.check_payable_to && (
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Checks Payable To:</span>
                      <span className="text-gray-900 dark:text-white ml-2">
                        {company.check_payable_to}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Totals - Right Side */}
            <div className="w-80 flex-shrink-0">
              <div className="space-y-3 border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(taxTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-gray-900 dark:text-white">Total:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(total)}
                  </span>
                </div>
                {depositsApplied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Deposits Applied:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(depositsApplied)}
                    </span>
                  </div>
                )}
                {paymentsApplied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Payments Applied:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(paymentsApplied)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-gray-900 dark:text-white">Balance Due:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposits and Payments Applied Section */}
        {(depositApplications.length > 0 || paymentApplications.length > 0) && (
          <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Deposits & Payments Applied
            </h3>
            <div className="space-y-3">
              {/* Deposit Applications */}
              {depositApplications.map((app, index) => (
                <div
                  key={`deposit-${index}`}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-green-900 dark:text-green-100">
                        {formatCurrency(Number(app.applied_amount))}
                      </div>
                      <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Deposit
                        {app.payments?.deposit_type && ` - ${app.payments.deposit_type}`}
                      </Badge>
                    </div>
                    {app.payments?.memo && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {app.payments.memo}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {app.applied_at && formatDate(app.applied_at)}
                  </div>
                </div>
              ))}

              {/* Payment Applications */}
              {paymentApplications.map((app, index) => (
                <div
                  key={`payment-${index}`}
                  className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {formatCurrency(Number(app.applied_amount))}
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        Payment
                        {app.payments?.payment_method && ` - ${app.payments.payment_method.replace('_', ' ')}`}
                      </Badge>
                    </div>
                    {app.payments?.memo && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {app.payments.memo}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {app.applied_at && formatDate(app.applied_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes/Terms Section */}
        {(company?.late_fee_enabled || company?.phone || company?.email) && (
          <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
            {company?.late_fee_enabled && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Late Fee Policy
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Late fees start the day after the invoice due date. An additional <strong>{formatCurrency(company.late_fee_amount)}</strong> is applied every <strong>{company.late_fee_days} days</strong> after the due date until paid.
                </p>
              </div>
            )}
            {(company?.phone || company?.email) && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Need help with this bill? Call {company?.phone || 'our office'} or email {company?.email || 'our team'}.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-8 py-6 text-center border-t border-gray-200 dark:border-gray-700 print:bg-white print:border-gray-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-600">
            Thank you for your business!
          </p>
        </div>
      </div>
    </div>
  )
}
