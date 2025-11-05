# Deploying Firestore Indexes and Rules

This guide explains how to deploy the Firestore indexes and security rules for the Univers (Univer Ubora) feature.

## Prerequisites

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```
   This will open your browser for authentication.

3. **Verify Firebase project** (check if `.firebaserc` exists):
   ```bash
   firebase projects:list
   ```
   
   If you need to set the project:
   ```bash
   firebase use <your-project-id>
   ```

## Deployment Methods

### Method 1: Deploy Both Rules and Indexes Together (Recommended)

Deploy both Firestore rules and indexes in one command:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

This is the **fastest method** and ensures both are deployed together.

### Method 2: Deploy Separately

If you prefer to deploy them separately:

**Deploy Rules Only:**
```bash
firebase deploy --only firestore:rules
```

**Deploy Indexes Only:**
```bash
firebase deploy --only firestore:indexes
```

## What Gets Deployed

### Firestore Rules (`firestore.rules`)
- Security rules for the `univers` collection
- Security rules for the `universInstances` collection
- Rules for reading, creating, updating, and deleting Univers templates
- Agency isolation and ownership validation

### Firestore Indexes (`firestore.indexes.json`)
- **5 new indexes** for Univers collections:
  1. `univers` collection: `ownership.createdBy` + `ownership.agencyId` + `metadata.createdAt`
  2. `univers` collection: `ownership.agencyId` + `ownership.isMarketplaceTemplate` + `metadata.createdAt`
  3. `univers` collection: `ownership.isMarketplaceTemplate` + `ownership.approvalStatus` + `usage.totalUsages`
  4. `universInstances` collection: `userId` + `agencyId` + `createdAt`
  5. `universInstances` collection: `universId` + `createdAt`

## Index Deployment Process

⚠️ **Important**: Index deployment can take several minutes because:
- Firestore builds indexes in the background
- Indexes are built progressively as data is added
- Large collections may take longer to index

**After deployment, you will see:**
```
✔  Deploy complete!

⚠  Indexes will be created shortly. 
   Visit https://console.firebase.google.com/project/YOUR-PROJECT/firestore/indexes
   to view their status.
```

## Verify Deployment

### Verify Rules
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to **Firestore Database** > **Rules**
3. Check that the Univers rules are present:
   - Look for `match /univers/{universId}`
   - Look for `match /universInstances/{instanceId}`

### Verify Indexes
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to **Firestore Database** > **Indexes**
3. Check that the new indexes appear:
   - Filter by collection group: `univers`
   - Filter by collection group: `universInstances`
4. Wait for indexes to build (status will show "Building..." then "Enabled")

## Troubleshooting

### Issue: "Project not found"
**Solution**: Set the Firebase project:
```bash
firebase use <your-project-id>
```

### Issue: "Permission denied"
**Solution**: Make sure you're logged in and have the correct permissions:
```bash
firebase login
firebase projects:list
```

### Issue: "Index build taking too long"
**Solution**: This is normal for large collections. Check status in Firebase Console:
- Indexes build in the background
- Can take several minutes to hours depending on collection size
- The app will work even while indexes are building (but queries may be slower)

### Issue: "Rules deployment failed"
**Solution**: 
1. Check syntax errors in `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules --debug
   ```
2. Verify all helper functions are defined
3. Check that collection names match your code

### Issue: "Index already exists"
**Solution**: This is normal - Firebase will skip existing indexes. No action needed.

## Testing After Deployment

Once deployed, test your Univers feature:

1. **Test Rules**: Try creating a Univers (should work if you're a directeur)
2. **Test Indexes**: 
   - Create a Univers
   - Query by user/agency
   - Check for any query performance warnings in console

If you see errors about missing indexes, check the Firebase Console Indexes page for build status.

## Quick Reference Commands

```bash
# Login
firebase login

# Set project
firebase use <project-id>

# Deploy everything
firebase deploy --only firestore:rules,firestore:indexes

# Deploy rules only
firebase deploy --only firestore:rules

# Deploy indexes only
firebase deploy --only firestore:indexes

# View project info
firebase projects:list

# Debug deployment
firebase deploy --only firestore:rules,firestore:indexes --debug
```

## Next Steps

After successful deployment:
1. ✅ Univers collections are secured
2. ✅ Indexes are building (check Firebase Console)
3. ✅ You can proceed with implementing the Univers wizard steps
4. ✅ Test Univers creation functionality

---

**Note**: Index building is asynchronous. The app will function even while indexes are being built, but queries may be slower until indexing completes.

