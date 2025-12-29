# How to Sync Changes to GitHub

## Quick Method (Using the Script)

1. **Open Terminal** in your project folder
2. **Run the sync script:**
   ```bash
   ./sync-to-github.sh "Description of your changes"
   ```

   Example:
   ```bash
   ./sync-to-github.sh "Fix login button issue"
   ```

## Manual Method (Step by Step)

### 1. Check what changed:
```bash
git status
```

### 2. Add all changes:
```bash
git add .
```
(Or add specific files: `git add js/config.js js/auth.js`)

### 3. Commit with a message:
```bash
git commit -m "Description of your changes"
```

### 4. Push to GitHub:
```bash
git push
```

## Common Workflow

Every time you make changes:

```bash
# 1. See what changed
git status

# 2. Add, commit, and push in one go
git add .
git commit -m "Your change description"
git push
```

## Quick Commands Reference

| Command | What it does |
|---------|--------------|
| `git status` | See what files changed |
| `git add .` | Stage all changes |
| `git add filename.js` | Stage specific file |
| `git commit -m "message"` | Save changes with message |
| `git push` | Upload to GitHub |
| `git pull` | Download latest from GitHub |

## Tips

- **Always write descriptive commit messages**: "Fix login bug" is better than "update"
- **Check status first**: Run `git status` to see what will be committed
- **Push regularly**: Don't wait too long between pushes
- **Pull before push**: If working with others, run `git pull` first

## Troubleshooting

**If push fails:**
```bash
git pull
# Resolve any conflicts, then:
git push
```

**If you want to undo changes:**
```bash
git restore filename.js  # Undo changes to a file
git restore .            # Undo all changes
```

**If you want to see commit history:**
```bash
git log --oneline
```

