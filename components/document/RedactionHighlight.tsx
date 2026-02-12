// components/document/RedactionHighlight.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RedactionHighlightProps {
  status: 'unsolved' | 'proposed' | 'corroborated' | 'confirmed' | 'disputed'
  text: string
  resolvedText?: string | null
  solvedBy?: string | null
}

export function RedactionHighlight({ status, text, resolvedText, solvedBy }: RedactionHighlightProps) {
  const isSolved = status === 'confirmed'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              isSolved
                ? 'border border-solid border-green-500 bg-green-950/20 px-1'
                : 'border border-dashed border-red-600 bg-black px-1'
            }
          >
            {isSolved ? resolvedText || text : '████████'}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isSolved ? (
            <p>Solved{solvedBy ? ` by @${solvedBy}` : ''}</p>
          ) : (
            <p>Redacted — Help solve this</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
