# Putting Packet Express on Ready4AI

Packet Express is laid out the way Ready4AI serves a course: `index.html`, `js/` and `css/`, plain JavaScript modules, no build step and nothing loaded from another site.

## What already fits

- **Serving.** Copy `index.html`, `js/` and `css/` to `courses/packet-express/` and add one line to `COURSES` in `server/src/http.ts`: `'packet-express': { dir: path.join(ROOT, 'courses', 'packet-express'), served: ['index.html', 'js', 'css'] }`. The page works under the course security rules as they are.
- **Fonts.** The page asks for `/fonts/fonts.css`, which the platform serves. Anywhere else that request fails quietly and system fonts are used.
- **One storage interface.** Every screen calls the store in `js/data/`. `local.js` keeps work in the browser. `hosted.js` sends the same calls to `/api/rpc`.
- **Checks the server can rerun.** `js/curriculum/` and `js/labs/logic.js` have no page code, so the server can import them to grade quizzes and validate lessons, as it imports Pixel Trail's engine today.

## What the platform still needs

The server's `rpc.ts` only answers Pixel Trail's methods. Until it answers the ones below, the course runs in practice mode: each browser keeps its own work, and a teacher sees only the students who used that same browser.

1. Add `<meta name="r4a-store" content="hosted">` to the copy of `index.html` on the platform. That switches the page to `hosted.js`.
2. Answer the methods listed in `METHODS` in `js/data/hosted.js`. `js/data/local.js` is the reference for what each one checks and returns. The ones that matter most:
   - `saveProgress(lessonId, patch)`: the lesson must be in the student's course and open; the server grades the quiz from the answers; step ids must exist.
   - `classBoard`, `helpRequests`, `feedback`: teacher only, limited to the teacher's own classes. `feedback` returns no names.
3. Replace the sign-in. Practice mode has no passwords: a class code and a name. The platform's own student and teacher sign-in should sit in `js/views/auth.js`, as it does in Pixel Trail.
4. Lab steps are reported by the browser ("step c is solved"). The quiz is the part the server grades. To have the server verify labs too, send the student's final lab state and check it with the functions in `logic.js`.

## Not built yet

Compared with the other courses: the class projector screen, arcade and shop, partners, rubric grading, translation, and slides and worksheets. See the README.
