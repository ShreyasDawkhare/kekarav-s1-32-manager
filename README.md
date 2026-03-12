# Kekarav S1-32 Manager

A simple Kanban-style task manager for tracking tasks.

## How to Run

1. Double-click `start.bat`
2. Open: http://localhost:132/kekarav-s132

## How to Stop

- Press `Ctrl+C` in the terminal, or
- Double-click `stop.bat`

## Features

- Create, edit, delete tasks
- Drag and drop tasks (one state forward/backward)
- Task states: New → InProgress → Completed → Reviewed → Done
- Deadline with overdue highlighting
- User management
- Comments on tasks
- State transition history
- Export/Import data

## Files

| File | Description |
|------|-------------|
| `index.html` | Main page |
| `styles.css` | Styles |
| `app.js` | Frontend logic |
| `server.js` | Node.js server |
| `data.json` | Your data |
| `start.bat` | Start server |
| `stop.bat` | Stop server |
