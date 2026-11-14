# Aalto LPBF image anomaly research — NOT prebuild failure prediction

Public dataset: Xinyi Yin et al. (2025), "Annotated Image Dataset for defects detection in Laser Powder Bed Fusion," https://doi.org/10.5281/zenodo.14996806 (CC BY 4.0).

**Target:** Classify the source's *visible image annotations* as "Good" or "Defects". The collection contains powder-bed and optical tomography images from a 316L EOS M290 experiment. This is **not** a CT-confirmed lack-of-fusion label or an STL-to-build-failure training set. The current ORIENTAI uploaded-STL analysis cannot use this model to assert part-failure probabilities.

## Get and inventory the source dataset
Download **Croped Defects and Classification.zip** (~395 MB) from https://zenodo.org/records/14996806 into a local research workspace, not the public app repository.

```bash
python -m pip install -r ml/requirements-reproduction.txt
python ml/prepare_aalto_images.py \
  --zip "/path/Croped Defects and Classification.zip" \
  --manifest "/tmp/aalto_manifest.csv" \
  --audit "/tmp/aalto_audit.json"
```

Importer reads the original ZIP in place, accepts only unambiguous Good/Defects folder labels, hashes each image and archive, checks for exact duplicates and archives a manifest with **blank** `source_group_id` and `source_modality`. Failure to identify folders is an audit issue, **not** permission to invent class labels.

Before training, a researcher must inspect the original acquisition metadata and fill in the actual independent build/scan-group identities and modality (PB vs OT). Do **not** assign group IDs by image number or arbitrary prefixes without supporting source records. Keep full-frame and cropped data distinct: different image dimensions or field of view by class can create spurious classification accuracy. The script blocks image resolution sets with no overlap, but this is not sufficient to prove artifact-free evaluation.

## Run an exploratory benchmark only with reviewed grouping

```bash
python ml/train_aalto_images.py \
  --zip "/path/Croped Defects and Classification.zip" \
  --manifest "/tmp/aalto_manifest_reviewed.csv" \
  --report "/tmp/aalto_research_metrics.json"
```

The baseline uses grayscale 32×32 pixels and logistic regression, splits by independently reviewed source group (seed 42) and produces accuracy diagnostics with immutable archive and manifest hashes. It **does not save a model**, provide an app inference endpoint, or enable any risk score for an unprinted STL. It requires at least six independent groups, at least 60 labeled images and both classes in the fixed grouped holdout. Such gates alone do not establish adequate generalization.

This baseline is an initial smoke test: it can be superseded by image-size-matched CNN training and external holdouts after group mapping is independently reviewed. If the dataset cannot establish genuinely independent acquisitions, it remains usable for qualitative image-recognition experiments but not credible defect-generalization claims.

For prebuild lack-of-fusion prediction, use the separate `ml/train_lack_of_fusion.py` workflow requiring **real inspected specimens** linked to measured process parameters across independently manufactured builds. Public Aalto image labels must not be relabeled or joined as such measurements.

The dataset is public, but do not put its 395 MB archive, any proprietary engineering data, or trained model weights into this repository. Record source license and attribution in resulting research materials.
