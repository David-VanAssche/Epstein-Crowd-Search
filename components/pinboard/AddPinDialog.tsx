// components/pinboard/AddPinDialog.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AddPinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPin: (pin: { type: string; title: string; description?: string; referenceId?: string }) => void
}

export function AddPinDialog({ open, onOpenChange, onAddPin }: AddPinDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [activeTab, setActiveTab] = useState('search')

  const handleAddNote = () => {
    if (!noteTitle.trim()) return
    onAddPin({ type: 'note', title: noteTitle, description: noteText })
    setNoteTitle('')
    setNoteText('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Pin to Board</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">Search</TabsTrigger>
            <TabsTrigger value="note" className="flex-1">Text Note</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Search documents, entities, or images</Label>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="min-h-32 rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
              {searchQuery
                ? 'Search results will appear here once the API is connected.'
                : 'Enter a search query to find items to pin.'}
            </div>
          </TabsContent>

          <TabsContent value="note" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Note Title</Label>
              <Input
                placeholder="e.g., Theory: Financial connection"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Note Text</Label>
              <Textarea
                placeholder="Your notes..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleAddNote} disabled={!noteTitle.trim()} className="w-full">
              Add Note Pin
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
