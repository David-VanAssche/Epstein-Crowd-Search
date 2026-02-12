// app/(public)/datasets/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const DATASETS = [
  { number: 1, name: 'Dataset 1: Initial Release', description: 'First batch of DOJ documents' },
  { number: 2, name: 'Dataset 2: Court Filings', description: 'Civil and criminal court documents' },
  { number: 3, name: 'Dataset 3: FBI Reports', description: 'FBI 302 interview reports and summaries' },
  { number: 4, name: 'Dataset 4: Flight Logs', description: 'Aircraft flight manifests and records' },
  { number: 5, name: 'Dataset 5: Financial Records', description: 'Banking and financial documents' },
  { number: 6, name: 'Dataset 6: Correspondence', description: 'Letters, emails, and messages' },
  { number: 7, name: 'Dataset 7: Property Records', description: 'Real estate and property documents' },
  { number: 8, name: 'Dataset 8: Depositions', description: 'Sworn testimony transcripts' },
  { number: 9, name: 'Dataset 9: Photographs', description: 'Photos and images from evidence' },
  { number: 10, name: 'Dataset 10: Police Reports', description: 'Law enforcement reports and investigations' },
  { number: 11, name: 'Dataset 11: Estate Documents', description: 'Estate and trust documents' },
  { number: 12, name: 'Dataset 12: Miscellaneous', description: 'Additional documents and evidence' },
]

export default function DatasetsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold">DOJ Datasets</h1>
      <p className="mb-8 text-muted-foreground">
        The U.S. Department of Justice released the Epstein files across 12 datasets.
        Each dataset is being processed for AI-powered search, entity extraction, and redaction analysis.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {DATASETS.map((ds) => (
          <Card key={ds.number} className="border-border bg-surface">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{ds.name}</CardTitle>
                <Badge variant="outline">Pending</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{ds.description}</p>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span>0 documents</span>
                <span>0%</span>
              </div>
              <Progress value={0} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
