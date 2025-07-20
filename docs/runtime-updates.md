# Runtime Updates

## Node.js 18.x to Node.js 20.x Migration

### Background
AWS announced the deprecation of Node.js 18.x runtime for Lambda functions. All functions using this runtime needed to be updated to Node.js 20.x.

### Actions Taken
On July 20, 2025, we updated the following Lambda functions from Node.js 18.x to Node.js 20.x:

| Function Name | Region | Original Runtime | New Runtime |
|---------------|--------|-----------------|------------|
| GraceS3Stack-TagUpdateFunction18A23E7D-FbhoM0ZWm79s | eu-west-2 | nodejs18.x | nodejs20.x |

### Verification
After the update, we verified that:
1. All functions were successfully updated to Node.js 20.x
2. No Node.js 18.x functions remain in any AWS region

### Script Used
We created a script at `/scripts/update-nodejs-runtime.sh` that can be used to update any future Node.js Lambda functions that need runtime updates.

Usage:
```bash
bash scripts/update-nodejs-runtime.sh [region]
```

### Next Steps
- Monitor the functions to ensure they continue to operate correctly with the new runtime
- Update any development workflows to use Node.js 20.x for new Lambda functions