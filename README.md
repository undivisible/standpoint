# this is standpoint

_an atechnology company project, but it's actually a school project_

## Imagine this

You have a set of things, and you want to show how much you like each item with your friends. What do you do?

You go over to Tiermaker, spend like 20 minutes collecting all the photos to download them to your computer, then upload them to the site, and then by the time you've finished doing all of that, your friends are all gone, you're feeling demotivated, you've wasted 20 minutes and literally don't want to do anything.

Okay, lets say that in the very limited repository of tier lists, Tiermaker actually already has one from it's extremely dead community, you make your own copy, but it doesnt have everything you want, it also doesn't have the look you want and the pictures are either wrong or theres no text so you don't really know what you're ranking or the other 50 problems that you may have.

Every single person born in the age of the New Internet can relate to this, and I think we all agree that this needs to change in the form of a new implementation and I'm here for it.

I want to make an app that people actually find useful and fun, that is made with modern day technology for a modern age of people that do want a purpose-built tool that is expressive and doesn't look like it stopped evolving since 2012. I also want to make sure that its done in the most efficient, beautiful manner that exceeds your expectations on every open, something that goes against design norms to create a piece of art in an user interface that is fun to use.

Standpoint is a platform built for the New Internet centered around sharing opinions and creating tierlists. AI-powered, blazing quick and literally just my school project.

### note

one day im going to have to pay for a bunch of gemini api credits and then im going to cry a lot.

## standpoint is made with

- **Frontend**: Svelte + SvelteKit + TailwindCSS
- **Server**: SvelteKit endpoints, Cloudflare Workers, Durable Objects
- **Database**: Cloudflare D1 and R2
- **Authentication**: Google OIDC on SvelteKit endpoints
- **AI**: Gemini 2.5 Flash Lite
- **Hosting**: Cloudflare

# run dev server

```bash
bun install
bun run dev
```

# run checks

```bash
bun run format
bun run lint
bun run check
bun run test
```

# cloudflare spectrum rooms

Standpoint uses D1 for app and room persistence, R2 for uploads, and a `RoomDO` Durable Object for realtime WebSocket gameplay.

```bash
bunx wrangler d1 execute standpoint-db --file=migrations/0001_init.sql
bunx wrangler d1 execute standpoint-db --file=migrations/0002_seed_cards.sql
bunx wrangler d1 execute standpoint-db --file=migrations/0003_room_visibility.sql
bunx wrangler d1 execute standpoint-db --file=migrations/0004_cloudflare_backend.sql
bunx wrangler dev
```

## Version History

### v0.7.1

- visual improvements
- (need to fix a few things i cbf rn)
- will put this on lts sometime i got other things to do

### v0.7.0 - Pure SvelteKit Release

- **removed Python/Sanic backend entirely** - now pure SvelteKit
- **migrated Stripe to SvelteKit server routes** - checkout and verification working
- **XSS prevention & security hardening** - input sanitization, CSP headers, validated inputs
- **notification system with bundling** - like/comment/fork notifications bundle together intelligently
- **upload progress indicators** - visual progress for image uploads
- **image deduplication** - perceptual hashing prevents duplicate uploads
- **theme system** - 10 beautiful themes (Dark, Light, Sepia, Nord, Dracula, Neo Tokyo, Taiga, Sunset, Midnight, Sakura)
- **fork attribution** - tierlists properly link back to originals
- **profile picture loading** - fixed avatar display in header
- all data operations now use SvelteKit endpoints directly (polls, tierlists, votes)
- simplified architecture: one runtime, one deployment
- fixed polls page preloading error
- fixed all TypeScript and accessibility warnings
- updated dev workflow to single `bun run dev` command
- editing tierlists

### v0.6.0

- mobile version
- fixed tierlist sizing

### v0.5.3

- included gemini fallback in frontend

### v0.5.2

- fixed bugs in adding tiers to tierlists and viewing it
- fixed statistic bars

### v0.5.1

- weird z index issues (wasn't in my browser) on create page

### v0.5.0 - beta

- bug fixes with tierlist creation
- accent color
- polls actually make sense
- anything but fixing tierlist editing
- enforced character limits on comments
- file size limits and typechecking for images in tierlists
- sequential uploading
- other bug fixes, visual and uniformity improvements and microoptimisations

### v0.4.1

- things i forgot

### v0.4.0 - alpha

- made sure non users dont have access to ai tools
- redid heading for creating tierlists without being logged in
- fixed polls with proximity to items and mistmatch between colors and titles
- fixed comment count outside of tierlists
- removed deleting polls (paving future for preserving polls indefinitely and removing voting after x time)
- added unlisted tierlists that are hidden from mainpage
- added local tierlists for users that arent logged in
- fixed a bug where dragging an item over near the tier name and buttons made it impossible to interact with
- spacebar no longer triggers add item modal so you can now edit names
- forking dynamic tierlists now works and you can add items
- cleaned redundant comments
- new version number

### v0.3.2

- updated font to mozilla text
- refined login design and styling
- various optimizations

### v0.3.1

- fixed dynamic tierlists and various typing issues

### v0.3.0 - pre-alpha

_i want to sleep so bad_

- searching
- homepage redesign
- draft autosave (finally)
- forking
- commenting
- liking
- half baked half done mobile version (not a priority)
- settings page
- profile page
- stripe integration (i have no idea whether my payments are gonna work)
- paste to upload
- critical bug fixes
- non logged in users have tierlists that only save to their device

### v0.2.0 - Data Integration

- data integrations
- authentication and tierlist ownership
- updated to gemini 2.5 flash lite (from 2.0 flash)
- added banner images
- renaming tierlists now renames the title of the webpage
- other minor refinements, fixes and improvements

### v0.1.3

- redesigned add modal with animations
- ai suggestions for tierlists with images
- simplified drag and drop logic

### v0.1.2

- fixed tierlist creations
  - converting dynamic to classic tierlists
  - scrolling for more images in image search
  - resizable items

### v0.1.1

- added proper tier list viewing
- revised backend to work with posting tierlists
- revised google images fetching to work with this project
- seperated sidebars for tierlist and polls

## im drowning

### things i need done

- saving tierlist as images
- items can belong to groups which show in statistics and you can choose to see only certain groups
- algorithmic feed and comments
- half redesign -- in progress
- change image api
- multiplayer
- live
- multiplayer tierlists with shared live editing, presence, cursors/selection, conflict handling, autosave, permissions, history and undo
- make search more efficient
- image logic after transferring to new implementation is cooked
- image cropping after placing and more tools
- item colors
- on hover parse items to gemini to explain them
- ai powered pattern analysis in polls and tierlists
- update accents to be part of poll presets
- localisation in various languages

### things i wanna do

- mobile app
- multiple themes
- moderation
- sharing links create a toast that allows you to follow people
- add more themes
- quizzes like 8values

## licensed under mpl 2 i really dont care what you do though
