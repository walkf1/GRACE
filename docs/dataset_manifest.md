# GRACE Project: Test Dataset Manifest

This document records the provenance of the public dataset used for developing and testing the GRACE platform.

* **Dataset Name:** Gene Expression in Human Pancreatic Islets
* **Accession Number:** GSE84465
* **Source URL:** `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE84465`
* **Description:** A study of gene expression in human pancreatic islets from donors with and without Type 2 Diabetes.

## Dataset Selection Rationale

This dataset was selected because:
1. It represents a real-world genomic research dataset
2. It's publicly available and well-documented
3. It includes both raw and processed data
4. It's linked to a published scientific paper, making it ideal for testing reproducibility workflows

## Data Verification Process

The verification process involves:
1. Downloading the dataset from the GEO repository
2. Calculating SHA256 hashes for all files to establish baseline integrity
3. Uploading to the GRACE S3 bucket with integrity verification
4. Recording all hashes in this manifest for future verification

## Implementation Note

For the hackathon demonstration, we will use a subset of this dataset to showcase the GRACE verification workflow. The complete dataset is approximately 1.5GB in size.

### File Integrity

| File Name | SHA256 Hash | Verification Date |
| :--- | :--- | :--- |
| `GSE84465_RAW.tar` | `[To be calculated during implementation]` | `[Date]` |

### Verification Commands

```bash
# Download the dataset
curl -L -o GSE84465_RAW.tar "https://www.ncbi.nlm.nih.gov/geo/download/?acc=GSE84465&format=file"

# Calculate SHA256 hash
shasum -a 256 GSE84465_RAW.tar

# Upload to S3
aws s3 cp GSE84465_RAW.tar s3://grace-kirocomp-data/datasets/

# Verify integrity after upload
aws s3 cp s3://grace-kirocomp-data/datasets/GSE84465_RAW.tar ./GSE84465_RAW_verification.tar
shasum -a 256 GSE84465_RAW_verification.tar
```

## References

* GEO Accession: [GSE84465](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE84465)
* Publication: Fadista J, et al. "Global genomic and transcriptomic analysis of human pancreatic islets reveals novel genes influencing glucose metabolism." Proc Natl Acad Sci U S A. 2014.