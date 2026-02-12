import Link from 'next/link'
import { Github, ExternalLink, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container max-w-content py-8 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              The Epstein Archive
            </h3>
            <p className="text-sm text-muted-foreground">
              Open-source platform for searching 3.5 million pages of
              DOJ-released Epstein files. MIT Licensed.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  About &amp; Methodology
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/David-VanAssche/Epstein-Crowd-Search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <Github className="h-3.5 w-3.5" />
                  Source Code
                </a>
              </li>
              <li>
                <a
                  href="https://www.gofundme.com/f/the-epstein-archive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Support This Project
                </a>
              </li>
              <li>
                <Link
                  href="/prosecutors"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  For Prosecutors
                </Link>
              </li>
            </ul>
          </div>

          {/* Processing Status */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Processing Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pages processed</span>
                <span className="text-foreground font-mono">0 / 3,500,000</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Help us process the rest.{' '}
                <a
                  href="https://www.gofundme.com/f/the-epstein-archive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Donate &rarr;
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          MIT License. All data sourced from public DOJ releases.
        </div>
      </div>
    </footer>
  )
}
