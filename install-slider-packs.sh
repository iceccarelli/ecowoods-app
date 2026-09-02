set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
for z in ecowoods-slider-pack.zip ecowoodssliderpack.zip ecowoods-slider-pack-02.zip ecowoodssliderpack02.zip \
         ecowoods-proof-plates.zip ecowoodsproofplates.zip ecowoods-proof-plates-batch-02.zip ecowoodsproofplatesbatch02.zip; do
  [ -f "$z" ] && { echo "unzip $z"; unzip -n -q "$z" -x 'PROOF_README.md' 'PROOF_BATCH_02_README.md' 'AGENT_PROMPT.md'; }
done
# screen-recoat shipped a 1712x1152 before against a 1168x784 after. A handle
# cannot track across two pixel grids. Same aspect to 3 dp, so this resamples.
python3 - <<'PY'
from PIL import Image
for ext,kw in (('webp',{'quality':88,'method':6}),('jpg',{'quality':90})):
    p=f'apps/web/public/proof/screen-recoat-before.{ext}'
    im=Image.open(p)
    if im.size!=(1168,784):
        im.resize((1168,784), Image.LANCZOS).save(p, **kw); print(f'  normalised {ext}: (1712, 1152) -> (1168, 784)')
    else: print(f'  {ext} already normalised')
PY
rm -f apps/web/app/data/proof-plates.ts apps/web/app/data/proof-plates-batch-02.ts
node scripts/gen-slider-imports.mjs
echo
echo "webp: $(ls apps/web/public/images/sliders/*.webp | wc -l) slider + $(ls apps/web/public/proof/*.webp | wc -l) proof"
node scripts/verify-sliders.mjs
