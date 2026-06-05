#!/usr/bin/env python3
"""Swap Recent Work + Field Notes images in apps/web/app/page.tsx. Safe to re-run."""
import pathlib, shutil, sys

TARGET = pathlib.Path("apps/web/app/page.tsx")

SWAPS = [
    ("rosedale",
     "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=75",
     "https://images.unsplash.com/photo-1560449752-3fd4bdbe7df0?auto=format&fit=crop&w=1400&q=80"),
    ("leslieville",
     "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=75",
     "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80"),
    ("forest-hill",
     "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=75",
     "https://images.unsplash.com/photo-1580398814575-816cf5faebad?auto=format&fit=crop&w=900&q=80"),
    ("distillery",
     "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1400&q=75",
     "https://images.unsplash.com/photo-1723897917319-3958c7b4aaa1?auto=format&fit=crop&w=1400&q=80"),
    ("cabbagetown(TEMP-replace-with-staircase)",
     "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=900&q=75",
     "https://images.unsplash.com/photo-1721274501580-6366b96a6050?auto=format&fit=crop&w=900&q=80"),
    ("yorkville",
     "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=75",
     "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=900&q=80"),
    ("field-notes-1",
     "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=70",
     "https://images.unsplash.com/32/Mc8kW4x9Q3aRR3RkP5Im_IMG_4417.jpg?auto=format&fit=crop&w=900&q=80"),
    ("field-notes-2",
     "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=900&q=70",
     "https://images.unsplash.com/photo-1721274501580-6366b96a6050?auto=format&fit=crop&w=900&q=80"),
    ("field-notes-3",
     "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=70",
     "https://images.unsplash.com/photo-1721838449374-722202a68197?auto=format&fit=crop&w=900&q=80"),
]

def main():
    if not TARGET.exists():
        print(f"ERROR: {TARGET} not found. Run from the repo root."); return 1
    text = TARGET.read_text()
    pending = []
    for label, old, new in SWAPS:
        if new in text and old not in text:
            print(f"  = {label}: already applied, skipping"); continue
        n = text.count(old)
        if n != 1:
            print(f"ERROR: {label}: expected OLD url once, found {n}. Aborting."); return 2
        pending.append((label, old, new))
    if not pending:
        print("Nothing to do — all images already swapped."); return 0
    backup = TARGET.with_suffix(TARGET.suffix + ".bak")
    if not backup.exists():
        shutil.copy2(TARGET, backup); print(f"Backup written: {backup}")
    for label, old, new in pending:
        text = text.replace(old, new); print(f"  + {label}: swapped")
    TARGET.write_text(text)
    print(f"\nDone. {len(pending)} image(s) updated in {TARGET}."); return 0

if __name__ == "__main__":
    sys.exit(main())
