# Gradely

**Gradely** is a lightweight, responsive web application for tracking **SGPA and CGPA** across semesters.

It allows students to add semesters, enter subjects, credits, and marks, and automatically calculates grades, SGPA, and overall CGPA.

## Features

- Semester and subject management
- Automatic grade calculation
- SGPA and CGPA calculation
- Semester history
- Import / export of academic data
- Local browser storage
- Responsive desktop and mobile interface

## Grading System

| Marks | Grade | Points |
|---|---|---:|
| 90–100 | S | 10 |
| 79–89 | A | 9 |
| 68–78 | B | 8 |
| 57–67 | C | 7 |
| 46–56 | D | 6 |
| 35–45 | E | 5 |
| Below 35 | F | 0 |

## Tech Stack

- **HTML5** — application structure
- **CSS3** — styling and responsive layout
- **JavaScript** — calculations, state management, and UI interactions
- **LocalStorage** — client-side data persistence

## Architecture

Gradely is a **client-side application** with no backend or database.

```text
index.html
   │
   ├── styles.css
   │
   └── app.js
         ├── Grade calculation
         ├── SGPA / CGPA calculation
         ├── Semester management
         ├── Subject management
         ├── Import / Export
         └── LocalStorage