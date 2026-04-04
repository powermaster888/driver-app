import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy'
import { shareAsync } from 'expo-sharing'
import type { JobSummary } from '../api/jobs'

const CSV_HEADERS = [
  'DO Reference',
  'Sales Order',
  'Customer',
  'Address',
  'Warehouse',
  'Scheduled Date',
  'Status',
  'Collection Required',
  'Collection Method',
  'Collection Amount',
]

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function jobToRow(job: JobSummary): string {
  return [
    job.odoo_reference,
    job.sales_order_ref || '',
    job.customer_name,
    job.address || '',
    job.warehouse,
    new Date(job.scheduled_date).toLocaleDateString('en-GB'),
    job.status,
    job.collection_required ? 'Yes' : 'No',
    job.collection_method || '',
    job.expected_collection_amount?.toString() || '',
  ]
    .map(escapeCSV)
    .join(',')
}

export async function exportJobsCSV(jobs: JobSummary[], filename?: string): Promise<void> {
  const header = CSV_HEADERS.join(',')
  const rows = jobs.map(jobToRow)
  const csv = [header, ...rows].join('\n')

  const name = filename || `deliveries_${new Date().toISOString().slice(0, 10)}.csv`
  const path = `${cacheDirectory}${name}`

  await writeAsStringAsync(path, csv, {
    encoding: EncodingType.UTF8,
  })

  await shareAsync(path, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  })
}
