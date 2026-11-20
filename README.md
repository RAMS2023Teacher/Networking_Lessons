# Packet Express 📦

Interactive networking lessons for grades 6 to 8: three courses of ten lessons each, built on the Massachusetts Digital Literacy and Computer Science standards. A plain web app (no Apps Script, no build step, no outside services) made to sit beside Pixel Trail on Ready4AI.

Students are couriers. Each finished lesson connects another station on their line, so the network map grows as they learn.

| Grade | Course | What it covers |
| --- | --- | --- |
| 6 | Connected | What a network is, wired and wireless, routers and switches, LAN and WAN, mobile networks, bits, text and pictures as data, troubleshooting |
| 7 | How the Internet Works | Network of networks, IP addresses, DNS, packets, routing, lost packets, protocols, bandwidth and latency, the cloud |
| 8 | Secure and Design | Client-server and layers, threats, passwords, encryption, HTTPS, firewalls, ethical hacking, data trails, access and equity |

The full lesson list with standards is in [docs/CURRICULUM.md](docs/CURRICULUM.md).

## Try it

Needs Node 22 or newer. Nothing to install.

```bash
npm start
```

Open http://localhost:8080. Join as a student with class code `DEMO6`, `DEMO7` or `DEMO8`, or open the teacher desk.

## What is in it

**For students**
- Every lesson has four stages: **Mission** (story, goal, vocabulary, partner talk), **Build** (three or four hands-on steps), **Quiz** (four questions, three to pass, unlimited tries) and **Deliver** (a written reflection with a sentence starter, plus a stretch challenge).
- 14 kinds of hands-on lab: build a network by connecting devices, route packets hop by hop, find the fastest path, rebuild a message from shuffled packets and ask for a lost one, flip binary switches, draw a picture from bits, deliver by IP address, encrypt, decrypt and crack a cipher, test password strength, run troubleshooting cases, race two connections, and sorting, ordering, matching and predict questions.
- XP, 12 levels, 8 badges, a courier with rides that unlock by level, and a network map that lights up one station per lesson.
- Buttons that are not ready stay clickable and say what is missing. An idle hint points at the next thing to do after 45 seconds.
- "I'm stuck" help requests, "Confusing?" on every step and question, and a lesson rating.
- Display settings: colors (light, dark, high contrast), font, text size, line spacing, less motion, sounds. Read aloud on every step.

**For teachers**
- Classes by grade with a join code; a progress grid showing where every student is; each student's partner talk, first quiz try and reflection.
- Help request queue with a chime.
- Share and assign: a join link and a link with instructions for each lesson, to paste into any learning system.
- Lesson plans with answer keys for all 30 lessons, printable.
- Feedback report (ratings, confusing steps, help requests, questions missed on the first try) with no student names, to copy or download.
- Standards coverage in the framework's own words.
- Student view: use any course as a pretend student who is in no class.
- Problem reports, and backup and restore of all data.

## Where work is saved

**Right now, in the browser only.** Each device keeps its own work. A student's progress shows on the teacher pages only if the teacher uses that same browser. This is enough to teach from and to try every lesson, but not to track a class across Chromebooks. Tracking a class needs the Ready4AI server to answer this course's calls; [docs/READY4AI.md](docs/READY4AI.md) lists exactly what.

## Checks

```bash
npm test
```

Checks that every lesson is complete and every lab can be solved, plus the XP rules and the data store (14 tests).

```bash
npm run test:browser
```

With `npm start` running and Playwright on the machine: a pretend student finishes all 30 lessons by clicking through the real page, then the teacher pages are opened.

## Layout

| Path | What it holds |
| --- | --- |
| `js/curriculum/` | The lessons (`grade6.js`, `grade7.js`, `grade8.js`), the standards and the validator |
| `js/labs/` | The interactive labs, and `logic.js` with the rules they check |
| `js/game/rules.js` | XP, levels and badges, all worked out from saved progress |
| `js/data/` | Storage: `local.js` (this browser) and `hosted.js` (Ready4AI) |
| `js/views/` | The screens |
| `tests/`, `e2e/` | Checks |
| `tools/` | Local server, and `scope.mjs` which writes `docs/CURRICULUM.md` |

To add or change a lesson, edit its grade file and run `npm test`. Steps are saved by id, so do not reuse or rename the id of a step students have started.

## Not built yet

The class projector screen, arcade and shop, partners, rubric grading, translation, and slides and worksheets.
