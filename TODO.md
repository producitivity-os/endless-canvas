- [x] Organize imports using `index.ts`
- [x] fix import issues `Failed to resolve import "@/core" from "playground/App.tsx". Does the file exist?`
- [x] Selection outline rendering
- [ ] Make card selection frame rounded and without common resize handles
- [ ] Hover rendering
- [ ] resize handle and rotation handles

# Migrate processing to Rust backend

- [ ]
- [ ] element hover function
- [ ] card hover style
- [ ] render resize handle,

- [ ] All elements: select, delete, resize, move, edit, create
- [ ] elements: card, arrow, shape, images
- [ ] Shapes: rectangle, circle, oval, line, path
- [ ] Marquee selection
- [ ] History: undo, redo
- [ ] Persistence: persist to tauri backend
- [ ] Spatial indexing and caching on tauri backend
- [ ] plugins
- [ ] Add loading display state

## TAURI

selected objects -> serialize JSON/Binary -> clipboard
clipboard -> serializeJson/Binary -> object

- persistence via tauri
- file drag and drop
- MacOS notification
- Scan from iPhone
- MenuBar application
- floating property panels
