# Phase 3: All DOJ ZIP Datasets

**Time:** ~4-8 hours
**Run on:** Cloud VM (see `cloud-vm-setup.md`)
**Cost:** ~$3 (VM time)
**Prerequisites:** Phase 2 complete (pipeline validated)
**Result:** Datasets 1-8 and 12 (~13GB) uploaded to Supabase Storage

## Tasks

- [ ] 3.1: Provision cloud VM
- [ ] 3.2: Upload Dataset 1 (~1.26GB)
- [ ] 3.3: Upload Dataset 2 (~631MB)
- [ ] 3.4: Upload Dataset 3 (~595MB)
- [ ] 3.5: Upload Dataset 4 (~352MB)
- [ ] 3.6: Upload Dataset 7 (~97MB)
- [ ] 3.7: Upload Dataset 8 (~10.2GB) ← largest ZIP
- [ ] 3.8: Upload Dataset 12 (~114MB)
- [ ] 3.9: Verify all uploads, update progress

---

### Execution

SSH into cloud VM, then run inside `tmux`:

```bash
tmux new -s uploader

# Upload all ZIP datasets (skips 5+6 if already done)
python scripts/upload-to-supabase.py doj-zips --all
```

The tool should:
- Skip datasets already marked complete in `upload-progress.json`
- Process datasets in order: smallest first (already done: 5, 6), then 7, 12, 4, 3, 2, 1, 8
- Log progress with `rich` progress bars
- Retry failed uploads with exponential backoff

### Dataset 8 Note

Dataset 8 is ~10.2GB — the largest ZIP. At 50 Mbps download, this takes ~30 minutes to stream. The ZIP streaming approach handles this fine since individual PDFs within are small.

## Acceptance Criteria

- [ ] All ZIP-based datasets (1-8, 12) in Supabase Storage
- [ ] Documents table populated with all PDFs
- [ ] Progress tracker shows all ZIP datasets complete
- [ ] Storage dashboard shows ~13GB used
