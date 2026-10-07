# Task 2

This program reads `file1.txt` and `file2.txt` asynchronously with `fs.readFile`.
After both reads succeed, it emits the `files:ready` event through an
`EventEmitter`, merges the two contents, and writes the result asynchronously
to `merged.txt`.

## Run

```bash
npm start
```

The command creates or updates `merged.txt` in this folder.
