# this is standpoint

my year 11 vce unit 3 applied computing software development that i still maintain for some reason
built with svelte and previously firebase + gemini api

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

### things i need done

- saving tierlist as images
- items can belong to groups which show in statistics and you can choose to see only certain groups
- algorithmic feed and comments
- half redesign -- in progress
- change image api
- multiplayer
- live
- multiplayer tierlists with shared live editing, presence, cursors/selection, conflict handling, autosave, permissions, history and undo
- image logic after transferring to new implementation is cooked
- image cropping after placing and more tools
- item colors
- update accents to be part of poll presets
- localisation in various languages

### things i wanna do

- mobile app
- sharing links create a toast that allows you to follow people
- quizzes like 8values

## licensed under mpl2
